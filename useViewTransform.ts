import { RefObject, useCallback, useEffect, useState } from 'react';
import { ViewTransform } from '../ImageCropper.types';
import { clamp } from '../utils/math';
import {
  MAXIMUM_ZOOM_SCALE,
  MINIMUM_ZOOM_SCALE,
} from '../utils/constants';
import { ImageNaturalSize } from './useImageNaturalSize';

export interface UseViewTransformResult {
  viewTransform: ViewTransform;
  setViewTransform: React.Dispatch<React.SetStateAction<ViewTransform>>;
  /** Apply a multiplicative zoom anchored at a viewport point (clientX/clientY). */
  zoomAtViewportPoint: (factor: number, clientX: number, clientY: number) => void;
  /** Zoom by a multiplicative factor anchored at the stage center. */
  zoomAtStageCenter: (factor: number) => void;
  /** Reset the view to fit the image inside the stage. */
  fitImageToStage: () => void;
  /** Convert a viewport point to the image's natural pixel coordinates. */
  viewportPointToImagePoint: (
    clientX: number,
    clientY: number,
    overrideTransform?: ViewTransform,
  ) => { x: number; y: number };
}

interface UseViewTransformArguments {
  stageElementRef: RefObject<HTMLElement>;
  imageNaturalSize: ImageNaturalSize | null;
  /** Ref pointing to the current "is the user dragging" state. We use a ref
   *  rather than a value to break a circular dep with the drag hook. */
  isUserInteractingRef: RefObject<boolean>;
}

/**
 * Owns the pan + zoom state of the image inside the stage and exposes
 * helpers for cursor-anchored zoom and viewport→image coordinate mapping.
 */
export const useViewTransform = ({
  stageElementRef,
  imageNaturalSize,
  isUserInteractingRef,
}: UseViewTransformArguments): UseViewTransformResult => {
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    tx: 0,
    ty: 0,
    scale: 1,
  });

  const computeFitTransform = useCallback(
    (size: ImageNaturalSize): ViewTransform => {
      const stageElement = stageElementRef.current;
      if (!stageElement) return { tx: 0, ty: 0, scale: 1 };
      const stageWidth = stageElement.clientWidth;
      const stageHeight = stageElement.clientHeight;
      const scale = Math.min(
        stageWidth / size.width,
        stageHeight / size.height,
        1,
      );
      const tx = (stageWidth - size.width * scale) / 2;
      const ty = (stageHeight - size.height * scale) / 2;
      return { tx, ty, scale };
    },
    [stageElementRef],
  );

  const fitImageToStage = useCallback(() => {
    if (!imageNaturalSize) return;
    setViewTransform(computeFitTransform(imageNaturalSize));
  }, [imageNaturalSize, computeFitTransform]);

  // Initial fit once we know the image size
  useEffect(() => {
    if (imageNaturalSize) fitImageToStage();
  }, [imageNaturalSize, fitImageToStage]);

  // Re-fit when the stage resizes (only when the user isn't mid-drag)
  useEffect(() => {
    const stageElement = stageElementRef.current;
    if (!stageElement || !imageNaturalSize) return;
    const resizeObserver = new ResizeObserver(() => {
      if (isUserInteractingRef.current) return;
      setViewTransform(computeFitTransform(imageNaturalSize));
    });
    resizeObserver.observe(stageElement);
    return () => resizeObserver.disconnect();
  }, [imageNaturalSize, computeFitTransform, stageElementRef, isUserInteractingRef]);

  const zoomAtViewportPoint = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const stageElement = stageElementRef.current;
      if (!stageElement) return;
      const stageRect = stageElement.getBoundingClientRect();
      const localX = clientX - stageRect.left;
      const localY = clientY - stageRect.top;

      setViewTransform((previous) => {
        const nextScale = clamp(
          previous.scale * factor,
          MINIMUM_ZOOM_SCALE,
          MAXIMUM_ZOOM_SCALE,
        );
        if (nextScale === previous.scale) return previous;
        // Keep the image point under the cursor stationary
        const imagePointX = (localX - previous.tx) / previous.scale;
        const imagePointY = (localY - previous.ty) / previous.scale;
        return {
          scale: nextScale,
          tx: localX - imagePointX * nextScale,
          ty: localY - imagePointY * nextScale,
        };
      });
    },
    [stageElementRef],
  );

  const zoomAtStageCenter = useCallback(
    (factor: number) => {
      const stageElement = stageElementRef.current;
      if (!stageElement) return;
      const stageRect = stageElement.getBoundingClientRect();
      zoomAtViewportPoint(
        factor,
        stageRect.left + stageElement.clientWidth / 2,
        stageRect.top + stageElement.clientHeight / 2,
      );
    },
    [stageElementRef, zoomAtViewportPoint],
  );

  const viewportPointToImagePoint = useCallback(
    (clientX: number, clientY: number, overrideTransform?: ViewTransform) => {
      const stageElement = stageElementRef.current;
      const transform = overrideTransform ?? viewTransform;
      if (!stageElement) return { x: 0, y: 0 };
      const stageRect = stageElement.getBoundingClientRect();
      return {
        x: (clientX - stageRect.left - transform.tx) / transform.scale,
        y: (clientY - stageRect.top - transform.ty) / transform.scale,
      };
    },
    [viewTransform, stageElementRef],
  );

  return {
    viewTransform,
    setViewTransform,
    zoomAtViewportPoint,
    zoomAtStageCenter,
    fitImageToStage,
    viewportPointToImagePoint,
  };
};
