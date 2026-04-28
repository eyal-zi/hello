import { useEffect } from 'react';
import { CropRect } from '../ImageCropper.types';
import { generateCroppedBlob } from '../utils/generateCroppedBlob';

interface UseCropBlobArguments {
  imageSource: string;
  selectionRect: CropRect | null;
  /** True while the user is actively dragging — we only emit on settle. */
  isDragging: boolean;
  /** Receives the cropped Blob (or null if no valid selection). */
  onCroppedBlobChange: (blob: Blob | null) => void;
}

/**
 * Whenever the selection rectangle settles (a drag has just ended) and is
 * non-empty, generate a JPEG Blob of the selected region and emit it.
 */
export const useCropBlob = ({
  imageSource,
  selectionRect,
  isDragging,
  onCroppedBlobChange,
}: UseCropBlobArguments): void => {
  useEffect(() => {
    if (isDragging) return;

    if (!selectionRect || selectionRect.width < 1 || selectionRect.height < 1) {
      onCroppedBlobChange(null);
      return;
    }

    let isCancelled = false;
    (async () => {
      const blob = await generateCroppedBlob(imageSource, selectionRect);
      if (!isCancelled) onCroppedBlobChange(blob);
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectionRect, isDragging, imageSource, onCroppedBlobChange]);
};
