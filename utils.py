"""Pure helper functions: bounding box clipping, quality scoring, and
L2-normalization.

These are kept dependency-light (math + numpy + typing) so they can be
unit-tested without standing up a model or an ES client.
"""
from __future__ import annotations

import math
from typing import Tuple

import numpy as np


def clip_bounding_box(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    frame_width: int,
    frame_height: int,
) -> Tuple[int, int, int, int]:
    """Clip a float bbox to integer pixel coords inside a frame.

    Guarantees a non-empty crop: if the input coordinates collapse, the
    returned box is widened by one pixel inside the frame.
    """
    x1_int = max(0, min(frame_width  - 1, int(x1)))
    y1_int = max(0, min(frame_height - 1, int(y1)))
    x2_int = max(0, min(frame_width,      int(math.ceil(x2))))
    y2_int = max(0, min(frame_height,     int(math.ceil(y2))))
    if x2_int <= x1_int:
        x2_int = min(frame_width,  x1_int + 1)
    if y2_int <= y1_int:
        y2_int = min(frame_height, y1_int + 1)
    return x1_int, y1_int, x2_int, y2_int


def compute_quality_score(
    confidence: float,
    crop_width: int,
    crop_height: int,
    reference_size: int,
) -> float:
    """Score how good a detection snapshot is for representing its track.

    Higher is better. The score is ``confidence * min(1, area / ref_area)``
    where ``ref_area = reference_size**2``. Rationale:

    * Detection ``confidence`` is the simplest signal that the box is
      actually the object and not background or heavy occlusion.
    * Crop **absolute** area in pixels matters more than area-as-fraction-
      of-frame: a 200x400 person crop is similarly useful regardless of
      whether the source video is 720p or 4K.
    * The ratio is **capped at 1**: once a crop exceeds the model's
      reference resolution, more pixels stop helping (the resize throws
      them away). Without this cap, gigantic boxes would dominate
      regardless of confidence.

    Args:
        confidence: detection confidence in [0, 1].
        crop_width: crop width in pixels (after clipping to the frame).
        crop_height: crop height in pixels.
        reference_size: the model's input edge size in pixels (e.g. 224).
            Used to cap the area benefit.
    """
    crop_area = max(1, crop_width * crop_height)
    reference_area = max(1, reference_size * reference_size)
    area_factor = min(1.0, crop_area / reference_area)
    return float(confidence) * area_factor


def l2_normalize(vector: np.ndarray, epsilon: float = 1e-12) -> np.ndarray:
    """Return ``vector`` divided by its L2 norm, in float32.

    ``epsilon`` guards against division by zero for an all-zero vector,
    which would otherwise produce NaNs.
    """
    vector_float32 = vector.astype(np.float32, copy=False)
    norm = float(np.linalg.norm(vector_float32))
    if norm < epsilon:
        return vector_float32
    return vector_float32 / norm
