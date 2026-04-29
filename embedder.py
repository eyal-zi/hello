"""DINOv3 backbone wrapper: model loading, preprocessing, and inference.

This module is deliberately framework-aware (torch, torchvision) but
domain-agnostic: it knows nothing about tracks, detections, or storage. It
turns a list of BGR crops into a tensor of L2-normalized embeddings.

Performance notes
-----------------
The preprocessing pipeline is GPU-side: each variable-size BGR crop is
uploaded as ``uint8``, then resized + colour-corrected + normalized on the
device. For large batches (hundreds of crops) this is dramatically faster
than CPU-side resizing because:

* CPU antialiased bilinear resize is single-threaded per call and N
  separate calls don't parallelize across cores well from Python.
* The GPU performs all N tiny resizes concurrently (kernels queue and
  overlap), and the H2D byte transfer of raw uint8 crops is small even for
  hundreds of detections.
* The float conversion + normalization run as one batched op once all
  crops share the same shape.
"""
from __future__ import annotations

from typing import List, Optional, Sequence

import numpy as np
import torch
import torch.nn.functional as F


# ImageNet stats - DINOv3 LVD-1689M weights expect these.
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

# DINOv3 patch size - input height/width must be a multiple of this.
PATCH_SIZE = 16


class Dinov3Embedder:
    """Loads a local DINOv3 ViT checkpoint and produces image embeddings.

    The output of :meth:`embed` is L2-normalized along the feature dim, so
    cosine similarity reduces to a dot product downstream.
    """

    def __init__(
        self,
        repo_dir: str,
        weights_path: str,
        device: Optional[str] = None,
        model_name: str = "dinov3_vitb16",
        input_size: int = 224,
        max_batch_size: int = 256,
        use_amp: bool = True,
    ) -> None:
        if input_size % PATCH_SIZE != 0:
            raise ValueError(
                f"input_size must be a multiple of the patch size "
                f"({PATCH_SIZE}); got {input_size}"
            )
        if max_batch_size <= 0:
            raise ValueError(f"max_batch_size must be positive; got {max_batch_size}")

        self.device = torch.device(
            device if device is not None
            else ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.input_size = input_size
        self.max_batch_size = max_batch_size
        self.use_amp = use_amp and self.device.type == "cuda"

        # ``trust_repo=True`` skips the interactive prompt the first time a
        # local repo is loaded via torch.hub on this machine.
        model = torch.hub.load(
            repo_dir,
            model_name,
            source="local",
            weights=weights_path,
            trust_repo=True,
        )
        model.eval().to(self.device)
        self.model = model

        # Cached normalization tensors on-device, broadcast-ready.
        self._mean_chw = torch.tensor(IMAGENET_MEAN, device=self.device).view(1, 3, 1, 1)
        self._std_chw = torch.tensor(IMAGENET_STD, device=self.device).view(1, 3, 1, 1)

        # Discovered lazily on first access.
        self._embedding_dim: Optional[int] = None

    # ------------------------------------------------------------------ api

    @property
    def embedding_dim(self) -> int:
        """Dimensionality D of produced embeddings (768 for ViT-B/16)."""
        if self._embedding_dim is None:
            self._embedding_dim = self._discover_embedding_dim()
        return self._embedding_dim

    def embed(self, bgr_crops: Sequence[np.ndarray]) -> np.ndarray:
        """Embed a sequence of BGR HxWx3 ``uint8`` crops.

        Returns an ``(N, D)`` float32 numpy array of L2-normalized vectors.
        Empty input returns a ``(0, D)`` array.
        """
        if not bgr_crops:
            return np.empty((0, self.embedding_dim), dtype=np.float32)

        batch = self._preprocess_to_batch(bgr_crops)
        embeddings = self._embed_in_chunks(batch)
        return embeddings.detach().to("cpu").numpy().astype(np.float32, copy=False)

    # -------------------------------------------------------- preprocessing

    @torch.inference_mode()
    def _preprocess_to_batch(
        self, bgr_crops: Sequence[np.ndarray],
    ) -> torch.Tensor:
        """Turn variable-size BGR ``uint8`` crops into one normalized
        ``(N, 3, input_size, input_size)`` float tensor on ``self.device``.

        Steps, all on-device after the H2D upload:
          1. Per-crop H2D upload as ``uint8``.
          2. Per-crop ``F.interpolate`` resize (antialiased bilinear) into a
             pre-allocated batch slot.
          3. Single batched ``uint8 -> float`` cast, scale, and normalize.

        We resize each crop individually because they have different input
        sizes, but the resize kernels run concurrently on the GPU, and the
        only batched-shape work (the cast + normalize) is the expensive part
        that matters for memory bandwidth.
        """
        n = len(bgr_crops)

        # Pre-allocated uint8 batch on-device that each resize will write into.
        # uint8 is 4x smaller than float32, saving bandwidth and VRAM.
        resized_uint8 = torch.empty(
            (n, 3, self.input_size, self.input_size),
            dtype=torch.uint8,
            device=self.device,
        )

        for i, bgr_crop in enumerate(bgr_crops):
            # BGR -> RGB and HWC -> CHW done in numpy land before upload.
            # The negative-stride slice is made contiguous so torch can wrap
            # it without copying twice.
            rgb_chw = np.ascontiguousarray(bgr_crop[:, :, ::-1].transpose(2, 0, 1))
            crop_uint8 = torch.from_numpy(rgb_chw).to(
                self.device, non_blocking=True,
            )
            # interpolate needs a 4D batch dim. antialias=True works for
            # bilinear on CUDA in modern PyTorch.
            resized = F.interpolate(
                crop_uint8.unsqueeze(0),
                size=(self.input_size, self.input_size),
                mode="bilinear",
                align_corners=False,
                antialias=True,
            )
            resized_uint8[i] = resized.squeeze(0)

        # One batched cast + normalize for all N crops.
        batch_float = resized_uint8.float().div_(255.0)
        batch_float.sub_(self._mean_chw).div_(self._std_chw)
        return batch_float

    # ----------------------------------------------------------- inference

    @torch.inference_mode()
    def _embed_in_chunks(self, batch: torch.Tensor) -> torch.Tensor:
        """Run the model over chunks of ``<= max_batch_size`` rows."""
        total = batch.shape[0]
        if total <= self.max_batch_size:
            return self._forward(batch)
        chunks: List[torch.Tensor] = []
        for start in range(0, total, self.max_batch_size):
            chunk = batch[start : start + self.max_batch_size]
            chunks.append(self._forward(chunk))
        return torch.cat(chunks, dim=0)

    @torch.inference_mode()
    def _forward(self, batch: torch.Tensor) -> torch.Tensor:
        """Forward pass on a single ``<= max_batch_size`` batch.

        Returns L2-normalized class-token embeddings.
        """
        if self.use_amp:
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                features = self.model.forward_features(batch)
            class_token = features["x_norm_clstoken"].float()
        else:
            features = self.model.forward_features(batch)
            class_token = features["x_norm_clstoken"]
        return F.normalize(class_token, dim=-1)

    @torch.inference_mode()
    def _discover_embedding_dim(self) -> int:
        """Run a single dummy forward pass to find the model's output dim."""
        dummy = torch.zeros(
            (1, 3, self.input_size, self.input_size),
            dtype=torch.float32,
            device=self.device,
        )
        features = self.model.forward_features(dummy)
        return int(features["x_norm_clstoken"].shape[-1])
