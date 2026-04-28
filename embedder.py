"""DINOv3 backbone wrapper: model loading, preprocessing, and inference.

This module is deliberately framework-aware (torch, torchvision) but
domain-agnostic: it knows nothing about tracks, detections, or storage. It
turns a list of BGR crops into a tensor of L2-normalized embeddings.
"""
from __future__ import annotations

from typing import List, Optional, Sequence

import numpy as np
import torch
import torch.nn.functional as F
from torchvision.transforms import v2 as torchvision_transforms


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
        max_batch_size: int = 64,
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

        # Match the canonical DINOv3 inference preprocessing. ``antialias=True``
        # is important: without it, downsampled crops drift measurably from
        # the reference embeddings.
        self._preprocessing = torchvision_transforms.Compose([
            torchvision_transforms.ToImage(),
            torchvision_transforms.Resize(
                (input_size, input_size),
                antialias=True,
            ),
            torchvision_transforms.ToDtype(torch.float32, scale=True),
            torchvision_transforms.Normalize(
                mean=IMAGENET_MEAN,
                std=IMAGENET_STD,
            ),
        ])

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

        batch = self._preprocess_batch(bgr_crops)
        embeddings = self._embed_in_chunks(batch)
        return embeddings.detach().to("cpu").numpy().astype(np.float32, copy=False)

    # -------------------------------------------------------- preprocessing

    def _preprocess_one(self, bgr_crop: np.ndarray) -> torch.Tensor:
        """Single BGR HxWx3 ``uint8`` ndarray -> CHW float tensor on CPU."""
        # BGR -> RGB. The slice is a non-contiguous view; the transform
        # pipeline will copy, but we make it contiguous first to avoid a
        # stride warning from negative-step views.
        rgb_crop = np.ascontiguousarray(bgr_crop[:, :, ::-1])
        return self._preprocessing(rgb_crop)

    def _preprocess_batch(self, bgr_crops: Sequence[np.ndarray]) -> torch.Tensor:
        """Stack variable-size BGR crops into a single ``(N, 3, H, W)`` tensor
        on ``self.device``.

        Resizing happens on the CPU side so that we can stack into one tensor
        before doing a single host-to-device copy; this avoids issuing N
        separate ``F.interpolate`` launches on the GPU.
        """
        cpu_tensors = [self._preprocess_one(crop) for crop in bgr_crops]
        cpu_batch = torch.stack(cpu_tensors, dim=0)
        return cpu_batch.to(self.device, non_blocking=True)

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
