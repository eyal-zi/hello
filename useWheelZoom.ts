import { RefObject, useEffect } from 'react';
import { ZOOM_STEP_FACTOR } from '../utils/constants';

interface UseWheelZoomArguments {
  stageElementRef: RefObject<HTMLElement>;
  zoomAtViewportPoint: (factor: number, clientX: number, clientY: number) => void;
}

/**
 * Wires a non-passive wheel listener on the stage element so we can
 * preventDefault and zoom anchored at the cursor position.
 */
export const useWheelZoom = ({
  stageElementRef,
  zoomAtViewportPoint,
}: UseWheelZoomArguments): void => {
  useEffect(() => {
    const stageElement = stageElementRef.current;
    if (!stageElement) return;

    const handleWheelEvent = (event: WheelEvent) => {
      event.preventDefault();
      const zoomFactor =
        event.deltaY < 0 ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR;
      zoomAtViewportPoint(zoomFactor, event.clientX, event.clientY);
    };

    stageElement.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => stageElement.removeEventListener('wheel', handleWheelEvent);
  }, [stageElementRef, zoomAtViewportPoint]);
};
