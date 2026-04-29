"""Track embedding manager: orchestrates embedding and Elasticsearch upload.

The heavy lifting lives in :class:`Dinov3Embedder` and
:class:`ElasticsearchSink`. This module wires them together and owns the
"best snapshot per track id" bookkeeping.
"""
from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple

import numpy as np

from .embedder import Dinov3Embedder
from .elasticsearch_sink import ElasticsearchSink
from .types import PendingCrop, TrackRecord, _Snapshot
from .utils import clip_bounding_box, compute_quality_score, l2_normalize


class TrackEmbeddingManager:
    """Computes DINOv3 embeddings for tracked detections and keeps a single
    representative embedding per track id, suitable for image-based
    retrieval later.

    Per track, the manager keeps the top-K highest-quality snapshots and
    exposes their L2-normalized **mean** embedding as the representative.
    Averaging over a few good snapshots is more robust to single-frame bad
    luck (blur, partial occlusion, off-pose) than picking one. With
    ``max_snapshots_per_track=1`` this reduces to "best single snapshot".

    Typical use::

        from elasticsearch import Elasticsearch
        from track_embeddings import TrackEmbeddingManager

        elasticsearch_client = Elasticsearch("http://localhost:9200")

        manager = TrackEmbeddingManager(
            repo_dir="/path/to/dinov3",
            weights_path="/path/to/dinov3_vitb16_pretrain_lvd1689m-73cec8be.pth",
            elasticsearch_client=elasticsearch_client,
            elasticsearch_index="track-embeddings",
            device="cuda",
        )
        for frames, detections in stream:        # frames: list[np.ndarray BGR]
            manager.update(frames, detections)   # detections: list[list[dict]]

        manager.upload_to_elasticsearch()
    """

    def __init__(
        self,
        repo_dir: Optional[str] = None,
        weights_path: Optional[str] = None,
        elasticsearch_client: Any = None,
        elasticsearch_index: str = "track-embeddings",
        device: Optional[str] = None,
        model_name: str = "dinov3_vitb16",
        input_size: int = 224,
        max_batch_size: int = 64,
        min_crop_size: int = 8,
        use_amp: bool = True,
        max_snapshots_per_track: int = 5,
        embedder: Optional[Dinov3Embedder] = None,
        elasticsearch_sink: Optional[ElasticsearchSink] = None,
    ) -> None:
        """Construct a manager.

        The simple path is to pass ``repo_dir``, ``weights_path``, and
        optionally ``elasticsearch_client`` + ``elasticsearch_index``;
        the embedder and sink are built internally.

        For tests or custom backbones, pass a pre-built ``embedder`` and/or
        ``elasticsearch_sink`` directly. In that case the corresponding
        construction args (``repo_dir``, ``device``, ``model_name``, etc.
        for the embedder; ``elasticsearch_client``, ``elasticsearch_index``
        for the sink) must NOT be provided -- mixing the two construction
        modes would silently ignore some arguments.
        """
        if min_crop_size <= 0:
            raise ValueError(f"min_crop_size must be positive; got {min_crop_size}")
        if max_snapshots_per_track <= 0:
            raise ValueError(
                f"max_snapshots_per_track must be positive; got "
                f"{max_snapshots_per_track}"
            )
        self.min_crop_size = min_crop_size
        self.max_snapshots_per_track = max_snapshots_per_track

        self.embedder = self._build_or_validate_embedder(
            embedder=embedder,
            repo_dir=repo_dir,
            weights_path=weights_path,
            device=device,
            model_name=model_name,
            input_size=input_size,
            max_batch_size=max_batch_size,
            use_amp=use_amp,
        )

        self.elasticsearch_sink = self._build_or_validate_sink(
            elasticsearch_sink=elasticsearch_sink,
            elasticsearch_client=elasticsearch_client,
            elasticsearch_index=elasticsearch_index,
        )

        # Track id -> TrackRecord
        self.tracks: Dict[Any, TrackRecord] = {}

        # Monotonic global frame counter (incremented inside update()).
        self._global_frame_counter: int = 0

    # ------------------------------------------------- construction helpers

    @staticmethod
    def _build_or_validate_embedder(
        embedder: Optional[Dinov3Embedder],
        repo_dir: Optional[str],
        weights_path: Optional[str],
        device: Optional[str],
        model_name: str,
        input_size: int,
        max_batch_size: int,
        use_amp: bool,
    ) -> Dinov3Embedder:
        if embedder is not None:
            if repo_dir is not None or weights_path is not None:
                raise ValueError(
                    "Pass either `embedder` OR (`repo_dir`+`weights_path`), "
                    "not both. Mixing the two would silently ignore some args."
                )
            return embedder

        if repo_dir is None or weights_path is None:
            raise ValueError(
                "Either pass an `embedder`, or provide both `repo_dir` "
                "and `weights_path` so one can be constructed."
            )
        return Dinov3Embedder(
            repo_dir=repo_dir,
            weights_path=weights_path,
            device=device,
            model_name=model_name,
            input_size=input_size,
            max_batch_size=max_batch_size,
            use_amp=use_amp,
        )

    def _build_or_validate_sink(
        self,
        elasticsearch_sink: Optional[ElasticsearchSink],
        elasticsearch_client: Any,
        elasticsearch_index: str,
    ) -> Optional[ElasticsearchSink]:
        if elasticsearch_sink is not None:
            if elasticsearch_client is not None:
                raise ValueError(
                    "Pass either `elasticsearch_sink` OR "
                    "`elasticsearch_client`, not both."
                )
            return elasticsearch_sink

        if elasticsearch_client is not None:
            return ElasticsearchSink(
                client=elasticsearch_client,
                index_name=elasticsearch_index,
                embedding_dim=self.embedder.embedding_dim,
            )

        return None

    # ------------------------------------------------------------- exposed

    @property
    def embedding_dim(self) -> int:
        """Dimensionality D of stored embeddings."""
        return self.embedder.embedding_dim

    # ----------------------------------------------------------------- main

    def update(
        self,
        frames: Sequence[np.ndarray],
        detections_per_frame: Sequence[Sequence[Dict[str, Any]]],
    ) -> None:
        """Embed the worth-embedding detections in this batch in a single
        forward pass and update the per-track top-K snapshots.

        For each detection we compute its quality score *before* embedding.
        If the detection's track already has its top-K slots filled and the
        candidate's score is no better than the worst stored snapshot, we
        skip the (expensive) embedding entirely and only bump the track's
        ``num_observations`` counter. For long-lived tracks this avoids
        running the model on the vast majority of detections after the
        first few good ones.

        Args:
            frames: list of HxWx3 BGR ``uint8`` ndarrays.
            detections_per_frame: parallel list; ``detections_per_frame[i]``
                is a list of dicts with keys ``label``, ``confidence``,
                ``trackId`` and ``boundingBox`` ``= [x1, y1, x2, y2]``.
        """
        if len(frames) != len(detections_per_frame):
            raise ValueError(
                f"frames ({len(frames)}) and detections_per_frame "
                f"({len(detections_per_frame)}) must have the same length"
            )

        candidates = list(self._iter_pending_crops(frames, detections_per_frame))

        # Always advance the global frame counter, regardless of how many
        # detections (if any) survived filtering.
        self._global_frame_counter += len(frames)

        if not candidates:
            return

        crops_to_embed: List[PendingCrop] = []
        skipped_track_ids: List[Any] = []
        for candidate in candidates:
            if self._candidate_can_improve_track(candidate):
                crops_to_embed.append(candidate)
            else:
                skipped_track_ids.append(candidate.track_id)

        # Skipped candidates contributed no embedding but are still
        # observations -- count them.
        for track_id in skipped_track_ids:
            existing = self.tracks.get(track_id)
            if existing is not None:
                existing.num_observations += 1

        if not crops_to_embed:
            return

        embeddings = self.embedder.embed([crop.image for crop in crops_to_embed])
        for embedding, pending in zip(embeddings, crops_to_embed):
            self._integrate_embedding(embedding, pending)

    def _candidate_can_improve_track(self, candidate: PendingCrop) -> bool:
        """Cheap pre-embedding check: would this candidate plausibly get a
        slot in the track's top-K snapshots?

        Tracks below capacity always accept (we need the snapshots).
        At-capacity tracks accept only if the candidate's quality score
        beats the worst stored snapshot.
        """
        existing = self.tracks.get(candidate.track_id)
        if existing is None:
            return True
        if len(existing.snapshots) < self.max_snapshots_per_track:
            return True
        worst_stored = min(
            snapshot.quality_score for snapshot in existing.snapshots
        )
        return candidate.quality_score > worst_stored

    # -------------------------------------------------------- crop gather

    def _iter_pending_crops(
        self,
        frames: Sequence[np.ndarray],
        detections_per_frame: Sequence[Sequence[Dict[str, Any]]],
    ) -> Iterator[PendingCrop]:
        """Yield one :class:`PendingCrop` per usable detection in the batch."""
        reference_size = self.embedder.input_size

        for local_frame_index, (frame, detections) in enumerate(
            zip(frames, detections_per_frame)
        ):
            if frame is None or not detections:
                continue

            global_frame_index = self._global_frame_counter + local_frame_index
            frame_height, frame_width = frame.shape[:2]

            for detection in detections:
                pending = self._build_pending_crop(
                    detection=detection,
                    frame=frame,
                    frame_width=frame_width,
                    frame_height=frame_height,
                    global_frame_index=global_frame_index,
                    reference_size=reference_size,
                )
                if pending is not None:
                    yield pending

    def _build_pending_crop(
        self,
        detection: Dict[str, Any],
        frame: np.ndarray,
        frame_width: int,
        frame_height: int,
        global_frame_index: int,
        reference_size: int,
    ) -> Optional[PendingCrop]:
        """Convert a single detection dict into a :class:`PendingCrop`, or
        ``None`` if the box is too small or degenerate to embed.
        """
        bounding_box = detection["boundingBox"]
        x1, y1, x2, y2 = (float(value) for value in bounding_box[:4])

        x1_int, y1_int, x2_int, y2_int = clip_bounding_box(
            x1, y1, x2, y2, frame_width, frame_height,
        )
        crop_width = x2_int - x1_int
        crop_height = y2_int - y1_int
        if crop_width < self.min_crop_size or crop_height < self.min_crop_size:
            return None

        crop_image = frame[y1_int:y2_int, x1_int:x2_int]
        if crop_image.size == 0:
            return None

        confidence = float(detection.get("confidence", 1.0))
        quality_score = compute_quality_score(
            confidence=confidence,
            crop_width=crop_width,
            crop_height=crop_height,
            reference_size=reference_size,
        )

        return PendingCrop(
            image=crop_image,
            track_id=detection["trackId"],
            label=detection.get("label"),
            confidence=confidence,
            bounding_box=(x1_int, y1_int, x2_int, y2_int),
            frame_index=global_frame_index,
            quality_score=quality_score,
        )

    # ---------------------------------------------------------- bookkeeping

    def _integrate_embedding(
        self, embedding: np.ndarray, pending: PendingCrop,
    ) -> None:
        """Fold a fresh embedding into the per-track top-K snapshot store
        and recompute the track's mean representative embedding.
        """
        new_snapshot = _Snapshot(
            embedding=embedding.astype(np.float32, copy=False),
            quality_score=pending.quality_score,
            confidence=pending.confidence,
            bounding_box=pending.bounding_box,
            frame_index=pending.frame_index,
        )
        existing = self.tracks.get(pending.track_id)

        if existing is None:
            self.tracks[pending.track_id] = self._make_track_record(
                track_id=pending.track_id,
                label=pending.label,
                snapshots=[new_snapshot],
                num_observations=1,
            )
            return

        existing.num_observations += 1
        if not self._should_keep(new_snapshot, existing.snapshots):
            return  # not in top-K, ignore

        # In the top-K: insert and trim.
        snapshots = existing.snapshots + [new_snapshot]
        snapshots.sort(key=lambda snapshot: snapshot.quality_score, reverse=True)
        existing.snapshots = snapshots[: self.max_snapshots_per_track]

        # Refresh metadata to point at the current best snapshot.
        best_snapshot = existing.snapshots[0]
        existing.label = pending.label  # latest label wins -- usually stable
        existing.confidence = best_snapshot.confidence
        existing.bounding_box = best_snapshot.bounding_box
        existing.frame_index = best_snapshot.frame_index
        existing.embedding = self._mean_embedding(existing.snapshots)
        existing.is_dirty = True

    def _should_keep(
        self, candidate: _Snapshot, current: Sequence[_Snapshot],
    ) -> bool:
        """Whether ``candidate`` deserves a slot in the top-K list."""
        if len(current) < self.max_snapshots_per_track:
            return True
        worst = min(snapshot.quality_score for snapshot in current)
        return candidate.quality_score > worst

    def _make_track_record(
        self,
        track_id: Any,
        label: Any,
        snapshots: List[_Snapshot],
        num_observations: int,
    ) -> TrackRecord:
        best_snapshot = max(snapshots, key=lambda snapshot: snapshot.quality_score)
        return TrackRecord(
            track_id=track_id,
            label=label,
            embedding=self._mean_embedding(snapshots),
            confidence=best_snapshot.confidence,
            bounding_box=best_snapshot.bounding_box,
            frame_index=best_snapshot.frame_index,
            num_observations=num_observations,
            is_dirty=True,
            snapshots=snapshots,
        )

    @staticmethod
    def _mean_embedding(snapshots: Sequence[_Snapshot]) -> np.ndarray:
        """L2-normalized mean of the snapshots' (already-normalized) embeddings."""
        if len(snapshots) == 1:
            return snapshots[0].embedding
        stacked = np.stack([snapshot.embedding for snapshot in snapshots], axis=0)
        return l2_normalize(stacked.mean(axis=0))

    # ----------------------------------------------------------- elastic

    def upload_to_elasticsearch(
        self,
        only_dirty: bool = True,
        ensure_index: bool = True,
        chunk_size: int = 500,
        refresh: bool = False,
    ) -> Tuple[int, int]:
        """Push tracked embeddings into Elasticsearch via the bulk helper.

        Each track is upserted with ``_id = str(track_id)`` so re-uploading
        the same track replaces its previous document.

        Args:
            only_dirty: when ``True`` (default), push only tracks whose
                representative embedding has changed since the last upload.
                ``False`` re-pushes every record currently held.
            ensure_index: create the index with the right mapping if missing.
            chunk_size: bulk helper chunk size.
            refresh: when ``True``, force a refresh so newly indexed docs
                are searchable immediately. Slower; useful in tests.

        Returns:
            ``(success_count, error_count)``.
        """
        if self.elasticsearch_sink is None:
            raise RuntimeError(
                "Cannot upload: no Elasticsearch client or sink was provided."
            )

        records_to_upload: List[TrackRecord] = [
            record for record in self.tracks.values()
            if (not only_dirty) or record.is_dirty
        ]
        if not records_to_upload:
            return (0, 0)

        success_count, failed_ids = self.elasticsearch_sink.bulk_upload(
            records_to_upload,
            chunk_size=chunk_size,
            refresh=refresh,
            ensure_index=ensure_index,
        )

        for record in records_to_upload:
            if str(record.track_id) not in failed_ids:
                record.is_dirty = False

        return (success_count, len(failed_ids))

    # -------------------------------------------------------------- mgmt

    def get(self, track_id: Any) -> Optional[TrackRecord]:
        return self.tracks.get(track_id)

    def all_track_ids(self) -> List[Any]:
        return list(self.tracks.keys())

    def remove_track(self, track_id: Any) -> bool:
        return self.tracks.pop(track_id, None) is not None

    def clear(self) -> None:
        self.tracks.clear()
        self._global_frame_counter = 0

    def __len__(self) -> int:
        return len(self.tracks)

    def __contains__(self, track_id: Any) -> bool:
        return track_id in self.tracks
