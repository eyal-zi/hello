import { CropRect, DragHandle } from '../ImageCropper.types';
import { clamp } from './math';
import { MINIMUM_SELECTION_SIZE_NATURAL } from './constants';

interface ApplyDragArguments {
  /** Which handle (or operation) is being dragged */
  handle: DragHandle;
  /** The selection rectangle as it was when the drag started */
  originalRect: CropRect;
  /** Where the drag started, in image-natural coordinates */
  startPointInImage: { x: number; y: number };
  /** Current pointer position, in image-natural coordinates */
  currentPointInImage: { x: number; y: number };
  /** Image natural dimensions, for clamping */
  imageNaturalSize: { width: number; height: number };
}

/**
 * Given the current drag operation and pointer position, compute the new
 * selection rectangle. All coordinates are in the image's natural pixel space.
 */
export const computeRectAfterDrag = ({
  handle,
  originalRect,
  startPointInImage,
  currentPointInImage,
  imageNaturalSize,
}: ApplyDragArguments): CropRect => {
  const minimumSize = MINIMUM_SELECTION_SIZE_NATURAL;
  const imageWidth = imageNaturalSize.width;
  const imageHeight = imageNaturalSize.height;

  const deltaX = currentPointInImage.x - startPointInImage.x;
  const deltaY = currentPointInImage.y - startPointInImage.y;

  let nextX = originalRect.x;
  let nextY = originalRect.y;
  let nextWidth = originalRect.width;
  let nextHeight = originalRect.height;

  switch (handle) {
    case 'new': {
      // Free draw between the start point and current point
      const x1 = clamp(startPointInImage.x, 0, imageWidth);
      const y1 = clamp(startPointInImage.y, 0, imageHeight);
      const x2 = clamp(currentPointInImage.x, 0, imageWidth);
      const y2 = clamp(currentPointInImage.y, 0, imageHeight);
      nextX = Math.min(x1, x2);
      nextY = Math.min(y1, y2);
      nextWidth = Math.abs(x2 - x1);
      nextHeight = Math.abs(y2 - y1);
      break;
    }

    case 'move': {
      nextX = clamp(originalRect.x + deltaX, 0, imageWidth - originalRect.width);
      nextY = clamp(originalRect.y + deltaY, 0, imageHeight - originalRect.height);
      break;
    }

    case 'e': {
      nextWidth = clamp(
        originalRect.width + deltaX,
        minimumSize,
        imageWidth - originalRect.x,
      );
      break;
    }

    case 'w': {
      const newLeft = clamp(
        originalRect.x + deltaX,
        0,
        originalRect.x + originalRect.width - minimumSize,
      );
      nextWidth = originalRect.width + (originalRect.x - newLeft);
      nextX = newLeft;
      break;
    }

    case 's': {
      nextHeight = clamp(
        originalRect.height + deltaY,
        minimumSize,
        imageHeight - originalRect.y,
      );
      break;
    }

    case 'n': {
      const newTop = clamp(
        originalRect.y + deltaY,
        0,
        originalRect.y + originalRect.height - minimumSize,
      );
      nextHeight = originalRect.height + (originalRect.y - newTop);
      nextY = newTop;
      break;
    }

    case 'ne': {
      nextWidth = clamp(
        originalRect.width + deltaX,
        minimumSize,
        imageWidth - originalRect.x,
      );
      const newTop = clamp(
        originalRect.y + deltaY,
        0,
        originalRect.y + originalRect.height - minimumSize,
      );
      nextHeight = originalRect.height + (originalRect.y - newTop);
      nextY = newTop;
      break;
    }

    case 'nw': {
      const newLeft = clamp(
        originalRect.x + deltaX,
        0,
        originalRect.x + originalRect.width - minimumSize,
      );
      const newTop = clamp(
        originalRect.y + deltaY,
        0,
        originalRect.y + originalRect.height - minimumSize,
      );
      nextWidth = originalRect.width + (originalRect.x - newLeft);
      nextHeight = originalRect.height + (originalRect.y - newTop);
      nextX = newLeft;
      nextY = newTop;
      break;
    }

    case 'se': {
      nextWidth = clamp(
        originalRect.width + deltaX,
        minimumSize,
        imageWidth - originalRect.x,
      );
      nextHeight = clamp(
        originalRect.height + deltaY,
        minimumSize,
        imageHeight - originalRect.y,
      );
      break;
    }

    case 'sw': {
      const newLeft = clamp(
        originalRect.x + deltaX,
        0,
        originalRect.x + originalRect.width - minimumSize,
      );
      nextWidth = originalRect.width + (originalRect.x - newLeft);
      nextHeight = clamp(
        originalRect.height + deltaY,
        minimumSize,
        imageHeight - originalRect.y,
      );
      nextX = newLeft;
      break;
    }

    // 'pan' is handled by the view-transform, not by the rect.
    case 'pan':
      break;
  }

  return { x: nextX, y: nextY, width: nextWidth, height: nextHeight };
};
