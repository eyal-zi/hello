"""Pure data types used across the package.

Keeping these in their own module means downstream code (e.g. tests, or any
module that just wants to consume a ``TrackRecord``) does not need to import
torch, OpenCV or Elasticsearch.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Tuple

import numpy as np


@dataclass
class _Snapshot:
    """One stored observation of a track. Internal to ``TrackRecord``."""
    embedding: np.ndarray            # L2-normalized, shape (D,)
    quality_score: float
    confidence: float
    bounding_box: Tuple[int, int, int, int]
    frame_index: int


@dataclass
class TrackRecord:
    """The stored state for a single track id.

    The track keeps up to ``max_snapshots`` of its highest-quality
    observations. The exposed ``embedding`` is the L2-normalized mean of
    those snapshots' embeddings, which is a robust representative for
    retrieval (single snapshots can be unlucky -- blurred, partly occluded,
    poorly lit -- and averaging smooths that out).

    With ``max_snapshots = 1`` this collapses to "best single snapshot".
    """
    track_id: Any
    label: Any
    embedding: np.ndarray            # L2-normalized mean over snapshots
    confidence: float                # confidence of the best snapshot
    bounding_box: Tuple[int, int, int, int]   # bbox of the best snapshot
    frame_index: int                 # frame of the best snapshot
    num_observations: int = 0        # total times update() saw this track
    is_dirty: bool = True            # not yet synced to the sink (or
                                     # changed since the last sync)
    snapshots: List[_Snapshot] = field(default_factory=list)

    @property
    def best_quality_score(self) -> float:
        """Quality score of the highest-scoring stored snapshot."""
        if not self.snapshots:
            return 0.0
        return max(snapshot.quality_score for snapshot in self.snapshots)


@dataclass
class PendingCrop:
    """A crop awaiting embedding, bundled with the metadata needed to place
    its embedding back on the right track.

    This is an internal helper passed between the manager's gather and embed
    phases; it is not stored long-term.
    """
    image: np.ndarray                # HxWx3 BGR uint8
    track_id: Any
    label: Any
    confidence: float
    bounding_box: Tuple[int, int, int, int]
    frame_index: int
    quality_score: float
