import { useCallback, useState } from 'react';

export interface ImageNaturalSize {
  width: number;
  height: number;
}

/**
 * Manages loading state for the source image and exposes its natural pixel
 * dimensions once available, plus an onLoad handler to wire onto an <img>.
 */
export const useImageNaturalSize = (): {
  imageNaturalSize: ImageNaturalSize | null;
  handleImageElementLoad: (event: React.SyntheticEvent<HTMLImageElement>) => void;
} => {
  const [imageNaturalSize, setImageNaturalSize] =
    useState<ImageNaturalSize | null>(null);

  const handleImageElementLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const imageElement = event.currentTarget;
      setImageNaturalSize({
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
      });
    },
    [],
  );

  return { imageNaturalSize, handleImageElementLoad };
};
