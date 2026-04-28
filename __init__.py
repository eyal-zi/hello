"""Track embedding manager backed by DINOv3 ViT-B/16.

Public API:

    TrackEmbeddingManager  -- the orchestrator, this is what you usually want
    Dinov3Embedder         -- wraps the DINOv3 model + preprocessing
    ElasticsearchSink      -- pushes records to an Elasticsearch index
    TrackRecord            -- dataclass: best stored snapshot per track id
    PendingCrop            -- dataclass: crop awaiting embedding (mostly internal)
    clip_bounding_box      -- pure helper: clip a bbox to integer frame coords
    compute_quality_score  -- pure helper: snapshot quality score
"""
from .embedder import Dinov3Embedder
from .elasticsearch_sink import ElasticsearchSink
from .manager import TrackEmbeddingManager
from .types import PendingCrop, TrackRecord
from .utils import clip_bounding_box, compute_quality_score

__all__ = [
    "TrackEmbeddingManager",
    "Dinov3Embedder",
    "ElasticsearchSink",
    "TrackRecord",
    "PendingCrop",
    "clip_bounding_box",
    "compute_quality_score",
]
