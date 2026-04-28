"""Elasticsearch storage layer for ``TrackRecord`` objects.

This module owns the index name, the mapping, and the document shape.
Keeping all three in one place is intentional: they must agree, and a
mismatch is a silent bug.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, Sequence, Set, Tuple

from .types import TrackRecord

logger = logging.getLogger(__name__)


class ElasticsearchSink:
    """Pushes ``TrackRecord`` objects into an Elasticsearch index.

    The sink does not hold its own state about which records are dirty;
    callers pass the records to upload, and the sink reports back which
    ``track_id`` strings (if any) failed so the caller can decide what to
    retry.
    """

    def __init__(
        self,
        client: Any,
        index_name: str,
        embedding_dim: int,
        similarity: str = "cosine",
    ) -> None:
        if client is None:
            raise ValueError("Elasticsearch client must not be None.")
        if embedding_dim <= 0:
            raise ValueError(f"embedding_dim must be positive; got {embedding_dim}")

        self.client = client
        self.index_name = index_name
        self.embedding_dim = embedding_dim
        self.similarity = similarity

    # ------------------------------------------------------------- index

    def ensure_index(self) -> None:
        """Create the index with a ``dense_vector`` mapping if it does not
        already exist. Safe to call repeatedly.
        """
        if self.client.indices.exists(index=self.index_name):
            return
        self.client.indices.create(
            index=self.index_name,
            body=self._build_mapping(),
        )

    def _build_mapping(self) -> Dict[str, Any]:
        return {
            "mappings": {
                "properties": {
                    "track_id":           {"type": "keyword"},
                    "label":              {"type": "keyword"},
                    "confidence":         {"type": "float"},
                    "best_quality_score": {"type": "float"},
                    "num_snapshots":      {"type": "integer"},
                    "frame_index":        {"type": "long"},
                    "num_observations":   {"type": "integer"},
                    "bounding_box":       {"type": "integer"},
                    "embedding": {
                        "type": "dense_vector",
                        "dims": self.embedding_dim,
                        "index": True,
                        "similarity": self.similarity,
                    },
                }
            }
        }

    # -------------------------------------------------------------- bulk

    def bulk_upload(
        self,
        records: Sequence[TrackRecord],
        chunk_size: int = 500,
        refresh: bool = False,
        ensure_index: bool = True,
    ) -> Tuple[int, Set[str]]:
        """Upsert records via the bulk helper.

        Each record is keyed by ``str(track_id)`` so re-uploading the same
        track replaces its previous document.

        Returns:
            ``(success_count, failed_track_ids)``. ``failed_track_ids`` is a
            set of ``str(track_id)`` values whose upsert failed; it is empty
            on full success.
        """
        if not records:
            return (0, set())

        # Lazy import so the module doesn't hard-require the package at
        # import time; only at upload time.
        from elasticsearch.helpers import bulk

        if ensure_index:
            self.ensure_index()

        success_count, errors = bulk(
            self.client,
            self._build_actions(records),
            chunk_size=chunk_size,
            refresh=refresh,
            raise_on_error=False,
        )

        failed_ids = self._extract_failed_ids(errors)
        if failed_ids:
            logger.warning(
                "Elasticsearch bulk upload reported %d errors", len(failed_ids),
            )
        return (success_count, failed_ids)

    def _build_actions(
        self, records: Sequence[TrackRecord],
    ) -> Iterable[Dict[str, Any]]:
        """Yield one Elasticsearch bulk action per record."""
        for record in records:
            yield {
                "_op_type": "index",      # index = create-or-replace
                "_index":   self.index_name,
                "_id":      str(record.track_id),
                "_source":  self._record_to_document(record),
            }

    @staticmethod
    def _record_to_document(record: TrackRecord) -> Dict[str, Any]:
        """Serialize a ``TrackRecord`` for the Elasticsearch ``_source``."""
        return {
            "track_id":         str(record.track_id),
            "label":            None if record.label is None else str(record.label),
            "confidence":       float(record.confidence),
            "best_quality_score": float(record.best_quality_score),
            "num_snapshots":    len(record.snapshots),
            "frame_index":      int(record.frame_index),
            "num_observations": int(record.num_observations),
            "bounding_box":     list(record.bounding_box),
            "embedding":        record.embedding.tolist(),
        }

    @staticmethod
    def _extract_failed_ids(errors: Any) -> Set[str]:
        """Pull ``_id`` out of each failed action in a bulk error list.

        Each error item looks like ``{op_name: {"_id": ..., "error": ...}}``
        where ``op_name`` is e.g. ``"index"``. We do not assume the op name.
        """
        failed_ids: Set[str] = set()
        if not isinstance(errors, list):
            return failed_ids
        for error_item in errors:
            if not isinstance(error_item, dict):
                continue
            for operation in error_item.values():
                if isinstance(operation, dict) and "_id" in operation:
                    failed_ids.add(str(operation["_id"]))
        return failed_ids
