import { useCallback, useState } from 'react';
import {
  CropRect,
  DragHandle,
  DragState,
  ViewTransform,
} from '../ImageCropper.types';
import { ImageNaturalSize } from './useImageNaturalSize';
import { computeRectAfterDrag } from '../utils/computeRectAfterDrag';

interface UseCropDragArguments {
  imageNaturalSize: ImageNaturalSize | null;
  viewTransform: ViewTransform;
  setViewTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
  viewportPointToImagePoint: (
    clientX: number,
    clientY: number,
    overrideTransform?: ViewTransform,
  ) => { x: number; y: number };
  isSpaceHeld: boolean;
}

export interface UseCropDragResult {
  selectionRect: CropRect | null;
  setSelectionRect: React.Dispatch<React.SetStateAction<CropRect | null>>;
  isDragging: boolean;
  /** Pointer down on empty stage area: starts new selection, or pan if space/middle. */
  handleStagePointerDown: (event: React.PointerEvent) => void;
  /** Pointer down inside the selection body: starts moving (or panning if space). */
  handleSelectionPointerDown: (event: React.PointerEvent) => void;
  /** Pointer down on a resize handle: starts resizing. */
  handleResizeHandlePointerDown: (
    handle: DragHandle,
  ) => (event: React.PointerEvent) => void;
  /** Pointer move while dragging anything. */
  handlePointerMove: (event: React.PointerEvent) => void;
  /** Pointer up / cancel: ends the active drag. */
  handlePointerUp: () => void;
}

/**
 * Owns the selection rectangle and the drag state machine that mutates it
 * (and the view transform, when panning) in response to pointer events.
 */
export const useCropDrag = ({
  imageNaturalSize,
  viewTransform,
  setViewTransform,
  viewportPointToImagePoint,
  isSpaceHeld,
}: UseCropDragArguments): UseCropDragResult => {
  const [selectionRect, setSelectionRect] = useState<CropRect | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const beginDrag = useCallback(
    (
      handle: DragHandle,
      event: React.PointerEvent,
      originalRect: CropRect,
    ) => {
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      setDragState({
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        origRect: originalRect,
        origTx: viewTransform.tx,
        origTy: viewTransform.ty,
      });
    },
    [viewTransform.tx, viewTransform.ty],
  );

  const handleStagePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const isMiddleClick = event.button === 1;
      const isPanRequested = isMiddleClick || (event.button === 0 && isSpaceHeld);

      if (isPanRequested) {
        event.preventDefault();
        beginDrag(
          'pan',
          event,
          selectionRect ?? { x: 0, y: 0, width: 0, height: 0 },
        );
        return;
      }

      if (event.button !== 0) return;

      // Start drawing a fresh selection rectangle
      const startPointInImage = viewportPointToImagePoint(
        event.clientX,
        event.clientY,
      );
      const initialRect: CropRect = {
        x: startPointInImage.x,
        y: startPointInImage.y,
        width: 0,
        height: 0,
      };
      setSelectionRect(initialRect);
      beginDrag('new', event, initialRect);
    },
    [isSpaceHeld, selectionRect, viewportPointToImagePoint, beginDrag],
  );

  const handleSelectionPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!selectionRect || event.button !== 0) return;
      event.stopPropagation();

      if (isSpaceHeld) {
        beginDrag('pan', event, selectionRect);
        return;
      }
      beginDrag('move', event, selectionRect);
    },
    [selectionRect, isSpaceHeld, beginDrag],
  );

  const handleResizeHandlePointerDown = useCallback(
    (handle: DragHandle) => (event: React.PointerEvent) => {
      if (!selectionRect || event.button !== 0) return;
      event.stopPropagation();
      beginDrag(handle, event, selectionRect);
    },
    [selectionRect, beginDrag],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragState || !imageNaturalSize) return;

      // Pan moves the view, leaves the selection alone
      if (dragState.handle === 'pan') {
        const deltaX = event.clientX - dragState.startClientX;
        const deltaY = event.clientY - dragState.startClientY;
        setViewTransform((previous) => ({
          ...previous,
          tx: dragState.origTx + deltaX,
          ty: dragState.origTy + deltaY,
        }));
        return;
      }

      // Everything else mutates the selection rectangle
      const startPointInImage = viewportPointToImagePoint(
        dragState.startClientX,
        dragState.startClientY,
      );
      const currentPointInImage = viewportPointToImagePoint(
        event.clientX,
        event.clientY,
      );

      const updatedRect = computeRectAfterDrag({
        handle: dragState.handle,
        originalRect: dragState.origRect,
        startPointInImage,
        currentPointInImage,
        imageNaturalSize: {
          width: imageNaturalSize.width,
          height: imageNaturalSize.height,
        },
      });

      setSelectionRect(updatedRect);
    },
    [dragState, imageNaturalSize, viewportPointToImagePoint, setViewTransform],
  );

  const handlePointerUp = useCallback(() => {
    setDragState(null);
  }, []);

  return {
    selectionRect,
    setSelectionRect,
    isDragging: dragState !== null,
    handleStagePointerDown,
    handleSelectionPointerDown,
    handleResizeHandlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
};
