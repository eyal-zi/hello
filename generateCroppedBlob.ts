import { CropRect } from '../ImageCropper.types';

/**
 * Loads an image as a fresh HTMLImageElement so we can read its raw pixel data
 * onto a canvas without any layout/transform interference.
 */
const loadImageElement = (imageSource: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const imageElement = new Image();
    imageElement.crossOrigin = 'anonymous';
    imageElement.onload = () => resolve(imageElement);
    imageElement.onerror = reject;
    imageElement.src = imageSource;
  });

/**
 * Produces a JPEG Blob of the selected region.
 * The rectangle is expressed in the image's natural pixel coordinates.
 */
export const generateCroppedBlob = async (
  imageSource: string,
  selectionRect: CropRect,
): Promise<Blob | null> => {
  if (selectionRect.width < 1 || selectionRect.height < 1) {
    return null;
  }

  const imageElement = await loadImageElement(imageSource);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(selectionRect.width));
  canvas.height = Math.max(1, Math.round(selectionRect.height));

  const drawingContext = canvas.getContext('2d');
  if (!drawingContext) return null;

  drawingContext.drawImage(
    imageElement,
    selectionRect.x,
    selectionRect.y,
    selectionRect.width,
    selectionRect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
};
