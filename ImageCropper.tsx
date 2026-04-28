import React, { useCallback, useEffect, useRef } from 'react';
import { ImageCropperProps } from './ImageCropper.types';
import {
  CropperRoot,
  CropperStage,
  HintText,
  SizeBadge,
  StageImage,
  TransformLayer,
  ZoomBadge,
} from './ImageCropper.styles';
import {
  HANDLE_SIZE_PIXELS,
  SELECTION_BORDER_PIXELS,
  ZOOM_STEP_FACTOR,
} from './utils/constants';
import { useImageNaturalSize } from './hooks/useImageNaturalSize';
import { useViewTransform } from './hooks/useViewTransform';
import { useWheelZoom } from './hooks/useWheelZoom';
import { useSpaceKey } from './hooks/useSpaceKey';
import { useCropDrag } from './hooks/useCropDrag';
import { useCropBlob } from './hooks/useCropBlob';
import SelectionOverlay from './SelectionOverlay';
import CropperToolbar from './CropperToolbar';

/**
 * Snipping Tool–style image cropper:
 *  - click and drag to draw a selection rectangle
 *  - scroll wheel zooms anchored at the cursor
 *  - Space + drag (or middle-click drag) to pan
 *  - 8 resize handles + drag-to-move on the selection
 *
 * The selection is stored in the image's natural pixel coordinates so it
 * remains exact at any zoom level. The cropped JPEG Blob is regenerated
 * each time the selection settles after a drag.
 */
const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  onCropChange,
}) => {
  const stageElementRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const { imageNaturalSize, handleImageElementLoad } = useImageNaturalSize();
  const isSpaceHeld = useSpaceKey();

  const {
    viewTransform,
    setViewTransform,
    zoomAtViewportPoint,
    zoomAtStageCenter,
    fitImageToStage,
    viewportPointToImagePoint,
  } = useViewTransform({
    stageElementRef,
    imageNaturalSize,
    isUserInteractingRef: isDraggingRef,
  });

  const {
    selectionRect,
    setSelectionRect,
    isDragging,
    handleStagePointerDown,
    handleSelectionPointerDown,
    handleResizeHandlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useCropDrag({
    imageNaturalSize,
    viewTransform,
    setViewTransform,
    viewportPointToImagePoint,
    isSpaceHeld,
  });

  // Keep the ref in sync so the view-transform hook can read it.
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useWheelZoom({ stageElementRef, zoomAtViewportPoint });

  useCropBlob({
    imageSource: imageSrc,
    selectionRect,
    isDragging,
    onCroppedBlobChange: onCropChange,
  });

  const handleResetSelectionAndView = useCallback(() => {
    fitImageToStage();
    setSelectionRect(null);
  }, [fitImageToStage, setSelectionRect]);

  // CSS variables that counter-scale handles and borders so they keep a
  // constant on-screen size regardless of the current zoom level.
  const counterScaledCssVariables = {
    ['--handle-size' as string]: `${HANDLE_SIZE_PIXELS / viewTransform.scale}px`,
    ['--handle-border' as string]: `${SELECTION_BORDER_PIXELS / viewTransform.scale}px`,
    ['--selection-border' as string]: `${SELECTION_BORDER_PIXELS / viewTransform.scale}px`,
  } as React.CSSProperties;

  const hasVisibleSelection =
    !!selectionRect && selectionRect.width > 0 && selectionRect.height > 0;

  return (
    <CropperRoot>
      <CropperToolbar
        onZoomIn={() => zoomAtStageCenter(ZOOM_STEP_FACTOR)}
        onZoomOut={() => zoomAtStageCenter(1 / ZOOM_STEP_FACTOR)}
        onFitToView={fitImageToStage}
        onResetSelection={handleResetSelectionAndView}
      />

      <CropperStage
        ref={stageElementRef}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {imageNaturalSize ? (
          <TransformLayer
            style={{
              transform:
                `translate(${viewTransform.tx}px, ${viewTransform.ty}px) ` +
                `scale(${viewTransform.scale})`,
              width: imageNaturalSize.width,
              height: imageNaturalSize.height,
              ...counterScaledCssVariables,
            }}
          >
            <StageImage
              src={imageSrc}
              alt="crop source"
              draggable={false}
              style={{
                width: imageNaturalSize.width,
                height: imageNaturalSize.height,
              }}
            />
            <SelectionOverlay
              imageNaturalWidth={imageNaturalSize.width}
              imageNaturalHeight={imageNaturalSize.height}
              selectionRect={selectionRect}
              onSelectionPointerDown={handleSelectionPointerDown}
              onResizeHandlePointerDown={handleResizeHandlePointerDown}
            />
          </TransformLayer>
        ) : (
          // Hidden image used solely to capture natural dimensions on load.
          <StageImage
            src={imageSrc}
            alt=""
            draggable={false}
            onLoad={handleImageElementLoad}
            style={{ visibility: 'hidden', position: 'absolute' }}
          />
        )}

        <ZoomBadge>{Math.round(viewTransform.scale * 100)}%</ZoomBadge>

        {hasVisibleSelection && selectionRect && (
          <SizeBadge>
            {Math.round(selectionRect.width)} × {Math.round(selectionRect.height)}
          </SizeBadge>
        )}
      </CropperStage>

      <HintText variant="body2">
        {hasVisibleSelection
          ? 'Drag inside to move, drag handles to resize. Scroll to zoom, Space + drag to pan.'
          : 'Click and drag to draw a selection. Scroll to zoom, Space + drag to pan.'}
      </HintText>
    </CropperRoot>
  );
};

export default ImageCropper;
