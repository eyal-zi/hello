import React, { useCallback, useEffect, useRef, useState } from 'react';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Tooltip } from '@mui/material';
import {
  CropRect,
  DragHandle,
  DragState,
  HandlePlacement,
  ImageCropperProps,
  ViewTransform,
} from './ImageCropper.types';
import {
  CropperRoot,
  CropperStage,
  TransformLayer,
  StageImage,
  SnipLayer,
  MaskPiece,
  SelectionRect,
  ResizeHandle,
  SizeBadge,
  ZoomBadge,
  Toolbar,
  ToolbarGroup,
  ToolbarButton,
  HintText,
} from './ImageCropper.styles';

const MIN_SIZE_NATURAL = 4; // minimum selection in natural image pixels
const MIN_SCALE = 0.1;
const MAX_SCALE = 20;
const ZOOM_STEP = 1.15; // multiplier per wheel notch / zoom button

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/** Generate a JPEG Blob of the selected region (in natural pixels). */
const cropToBlob = async (
  imageSrc: string,
  rect: CropRect,
): Promise<Blob | null> => {
  if (rect.width < 1 || rect.height < 1) return null;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(
    img,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  });
};

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  onCropChange,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Natural image dimensions (real pixels)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // Pan + zoom of the image inside the stage
  const [view, setView] = useState<ViewTransform>({ tx: 0, ty: 0, scale: 1 });

  // Selection rectangle in NATURAL pixel coordinates
  const [rect, setRect] = useState<CropRect | null>(null);

  // Active drag/pan/draw state
  const [drag, setDrag] = useState<DragState | null>(null);
  // Whether spacebar is held (engages pan mode for left-drag on empty area)
  const [spaceHeld, setSpaceHeld] = useState(false);

  // ----- helpers -----

  /** Compute initial "fit to stage" view transform. */
  const computeFitView = useCallback(
    (nat: { w: number; h: number }): ViewTransform => {
      const stage = stageRef.current;
      if (!stage) return { tx: 0, ty: 0, scale: 1 };
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const scale = Math.min(sw / nat.w, sh / nat.h, 1);
      const tx = (sw - nat.w * scale) / 2;
      const ty = (sh - nat.h * scale) / 2;
      return { tx, ty, scale };
    },
    [],
  );

  /** Convert a viewport point to natural-image coordinates. */
  const viewportToImage = useCallback(
    (clientX: number, clientY: number, v: ViewTransform = view) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };
      const r = stage.getBoundingClientRect();
      const localX = clientX - r.left;
      const localY = clientY - r.top;
      return {
        x: (localX - v.tx) / v.scale,
        y: (localY - v.ty) / v.scale,
      };
    },
    [view],
  );

  // ----- image load -----

  const handleImgLoad = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const nat = { w: el.naturalWidth, h: el.naturalHeight };
    setNatural(nat);
    const v = computeFitView(nat);
    setView(v);
    // default selection: full image
    setRect({ x: 0, y: 0, width: nat.w, height: nat.h });
  }, [computeFitView]);

  // Recompute fit when stage size changes
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !natural) return;
    const ro = new ResizeObserver(() => {
      // Only re-fit if user hasn't panned/zoomed manually? We always re-fit
      // when nothing is being dragged to keep the image visible.
      if (drag) return;
      setView(computeFitView(natural));
    });
    ro.observe(stage);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural]);

  // ----- spacebar = temporary pan mode -----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ----- wheel zoom (cursor-anchored) -----

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;

      setView((prev) => {
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const nextScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
        if (nextScale === prev.scale) return prev;
        // Anchor zoom at cursor: keep the image point under cursor stationary.
        const imgX = (px - prev.tx) / prev.scale;
        const imgY = (py - prev.ty) / prev.scale;
        const tx = px - imgX * nextScale;
        const ty = py - imgY * nextScale;
        return { tx, ty, scale: nextScale };
      });
    };

    // Must be non-passive to preventDefault on wheel
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  // ----- pointer interactions -----

  const beginDrag = useCallback(
    (handle: DragHandle, e: React.PointerEvent, origRect: CropRect) => {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setDrag({
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origRect,
        origTx: view.tx,
        origTy: view.ty,
      });
    },
    [view.tx, view.ty],
  );

  const onStagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        // Middle-click OR space+left-click = pan
        e.preventDefault();
        beginDrag(
          'pan',
          e,
          rect ?? { x: 0, y: 0, width: 0, height: 0 },
        );
        return;
      }
      if (e.button !== 0) return;
      // Start a new selection
      const p = viewportToImage(e.clientX, e.clientY);
      const startRect: CropRect = { x: p.x, y: p.y, width: 0, height: 0 };
      setRect(startRect);
      beginDrag('new', e, startRect);
    },
    [spaceHeld, rect, viewportToImage, beginDrag],
  );

  const onSelectionPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!rect || e.button !== 0) return;
      e.stopPropagation();
      if (spaceHeld) {
        // honor pan mode even over the selection
        beginDrag('pan', e, rect);
        return;
      }
      beginDrag('move', e, rect);
    },
    [rect, spaceHeld, beginDrag],
  );

  const onHandlePointerDown = useCallback(
    (handle: DragHandle) => (e: React.PointerEvent) => {
      if (!rect || e.button !== 0) return;
      e.stopPropagation();
      beginDrag(handle, e, rect);
    },
    [rect, beginDrag],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag || !natural) return;

      // Pan: move the view, leave the selection alone
      if (drag.handle === 'pan') {
        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;
        setView((prev) => ({
          ...prev,
          tx: drag.origTx + dx,
          ty: drag.origTy + dy,
        }));
        return;
      }

      // All other drags work in image-natural coordinates
      const p = viewportToImage(e.clientX, e.clientY);
      const o = drag.origRect;
      const W = natural.w;
      const H = natural.h;

      let nx = o.x;
      let ny = o.y;
      let nw = o.width;
      let nh = o.height;

      switch (drag.handle) {
        case 'new': {
          const startImg = viewportToImage(drag.startClientX, drag.startClientY);
          const x1 = clamp(startImg.x, 0, W);
          const y1 = clamp(startImg.y, 0, H);
          const x2 = clamp(p.x, 0, W);
          const y2 = clamp(p.y, 0, H);
          nx = Math.min(x1, x2);
          ny = Math.min(y1, y2);
          nw = Math.abs(x2 - x1);
          nh = Math.abs(y2 - y1);
          break;
        }
        case 'move': {
          const dxImg = p.x - viewportToImage(drag.startClientX, drag.startClientY).x;
          const dyImg = p.y - viewportToImage(drag.startClientX, drag.startClientY).y;
          nx = clamp(o.x + dxImg, 0, W - o.width);
          ny = clamp(o.y + dyImg, 0, H - o.height);
          nw = o.width;
          nh = o.height;
          break;
        }
        case 'e': {
          nw = clamp(p.x - o.x, MIN_SIZE_NATURAL, W - o.x);
          break;
        }
        case 'w': {
          const newX = clamp(p.x, 0, o.x + o.width - MIN_SIZE_NATURAL);
          nw = o.width + (o.x - newX);
          nx = newX;
          break;
        }
        case 's': {
          nh = clamp(p.y - o.y, MIN_SIZE_NATURAL, H - o.y);
          break;
        }
        case 'n': {
          const newY = clamp(p.y, 0, o.y + o.height - MIN_SIZE_NATURAL);
          nh = o.height + (o.y - newY);
          ny = newY;
          break;
        }
        case 'ne': {
          nw = clamp(p.x - o.x, MIN_SIZE_NATURAL, W - o.x);
          const newY = clamp(p.y, 0, o.y + o.height - MIN_SIZE_NATURAL);
          nh = o.height + (o.y - newY);
          ny = newY;
          break;
        }
        case 'nw': {
          const newX = clamp(p.x, 0, o.x + o.width - MIN_SIZE_NATURAL);
          const newY = clamp(p.y, 0, o.y + o.height - MIN_SIZE_NATURAL);
          nw = o.width + (o.x - newX);
          nh = o.height + (o.y - newY);
          nx = newX;
          ny = newY;
          break;
        }
        case 'se': {
          nw = clamp(p.x - o.x, MIN_SIZE_NATURAL, W - o.x);
          nh = clamp(p.y - o.y, MIN_SIZE_NATURAL, H - o.y);
          break;
        }
        case 'sw': {
          const newX = clamp(p.x, 0, o.x + o.width - MIN_SIZE_NATURAL);
          nw = o.width + (o.x - newX);
          nh = clamp(p.y - o.y, MIN_SIZE_NATURAL, H - o.y);
          nx = newX;
          break;
        }
      }

      setRect({ x: nx, y: ny, width: nw, height: nh });
    },
    [drag, natural, viewportToImage],
  );

  const onPointerUp = useCallback(() => {
    setDrag(null);
  }, []);

  // Emit cropped blob whenever the selection settles
  useEffect(() => {
    if (drag) return;
    if (!rect || !natural) return;
    if (rect.width < 1 || rect.height < 1) {
      onCropChange(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const blob = await cropToBlob(imageSrc, rect);
      if (!cancelled) onCropChange(blob);
    })();
    return () => {
      cancelled = true;
    };
  }, [rect, drag, natural, imageSrc, onCropChange]);

  // ----- toolbar handlers -----

  const zoomBy = useCallback((factor: number) => {
    setView((prev) => {
      const stage = stageRef.current;
      if (!stage) return prev;
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      // Zoom around stage center
      const cx = sw / 2;
      const cy = sh / 2;
      const nextScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
      if (nextScale === prev.scale) return prev;
      const imgX = (cx - prev.tx) / prev.scale;
      const imgY = (cy - prev.ty) / prev.scale;
      return {
        scale: nextScale,
        tx: cx - imgX * nextScale,
        ty: cy - imgY * nextScale,
      };
    });
  }, []);

  const handleFit = useCallback(() => {
    if (!natural) return;
    setView(computeFitView(natural));
  }, [natural, computeFitView]);

  const handleReset = useCallback(() => {
    if (!natural) return;
    setView(computeFitView(natural));
    setRect({ x: 0, y: 0, width: natural.w, height: natural.h });
  }, [natural, computeFitView]);

  // ----- derived render data -----

  const hasSelection = !!rect && rect.width > 0 && rect.height > 0;

  // Mask pieces around the selection (in natural coords)
  const masks = (() => {
    if (!natural || !rect) return null;
    const { x, y, width, height } = rect;
    return {
      top: { left: 0, top: 0, width: natural.w, height: y },
      bottom: {
        left: 0,
        top: y + height,
        width: natural.w,
        height: Math.max(0, natural.h - (y + height)),
      },
      left: { left: 0, top: y, width: x, height },
      right: {
        left: x + width,
        top: y,
        width: Math.max(0, natural.w - (x + width)),
        height,
      },
    };
  })();

  const handlePlacements: HandlePlacement[] = [
    'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w',
  ];

  // CSS variables that counter-scale handles & borders so they look constant
  // regardless of zoom. The transform layer is scaled by `view.scale`, and
  // these values are sized in natural-pixel units.
  const cssVars = {
    ['--handle-size' as string]: `${12 / view.scale}px`,
    ['--handle-border' as string]: `${2 / view.scale}px`,
    ['--selection-border' as string]: `${2 / view.scale}px`,
  } as React.CSSProperties;

  return (
    <CropperRoot>
      <Toolbar>
        <ToolbarGroup>
          <Tooltip title="Zoom out">
            <ToolbarButton size="small" onClick={() => zoomBy(1 / ZOOM_STEP)}>
              <ZoomOutIcon fontSize="small" />
            </ToolbarButton>
          </Tooltip>
          <Tooltip title="Zoom in">
            <ToolbarButton size="small" onClick={() => zoomBy(ZOOM_STEP)}>
              <ZoomInIcon fontSize="small" />
            </ToolbarButton>
          </Tooltip>
          <Tooltip title="Fit to view">
            <ToolbarButton size="small" onClick={handleFit}>
              <CenterFocusStrongIcon fontSize="small" />
            </ToolbarButton>
          </Tooltip>
        </ToolbarGroup>
        <ToolbarGroup>
          <Tooltip title="Reset selection & view">
            <ToolbarButton size="small" onClick={handleReset}>
              <RestartAltIcon fontSize="small" />
            </ToolbarButton>
          </Tooltip>
        </ToolbarGroup>
      </Toolbar>

      <CropperStage
        ref={stageRef}
        onPointerDown={onStagePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {natural && (
          <TransformLayer
            style={{
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
              width: natural.w,
              height: natural.h,
              ...cssVars,
            }}
          >
            <StageImage
              ref={imgRef}
              src={imageSrc}
              onLoad={handleImgLoad}
              alt="crop source"
              draggable={false}
              style={{ width: natural.w, height: natural.h }}
            />
            <SnipLayer style={{ width: natural.w, height: natural.h }}>
              {masks && (
                <>
                  <MaskPiece style={masks.top} />
                  <MaskPiece style={masks.bottom} />
                  <MaskPiece style={masks.left} />
                  <MaskPiece style={masks.right} />
                </>
              )}
              {hasSelection && rect && (
                <SelectionRect
                  onPointerDown={onSelectionPointerDown}
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.width,
                    height: rect.height,
                  }}
                >
                  {handlePlacements.map((h) => (
                    <ResizeHandle
                      key={h}
                      placement={h}
                      onPointerDown={onHandlePointerDown(h)}
                    />
                  ))}
                </SelectionRect>
              )}
            </SnipLayer>
          </TransformLayer>
        )}

        {/* Image-load fallback: hidden img so onLoad fires before natural is set */}
        {!natural && (
          <StageImage
            ref={imgRef}
            src={imageSrc}
            onLoad={handleImgLoad}
            alt="crop source"
            draggable={false}
            style={{ visibility: 'hidden', position: 'absolute' }}
          />
        )}

        <ZoomBadge>{Math.round(view.scale * 100)}%</ZoomBadge>

        {hasSelection && rect && (
          <SizeBadge>
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </SizeBadge>
        )}
      </CropperStage>

      <HintText variant="body2">
        Click and drag to snip. Scroll to zoom toward the cursor. Hold Space (or middle-click) and drag to pan.
      </HintText>
    </CropperRoot>
  );
};

export default ImageCropper;
