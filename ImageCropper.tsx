import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ToggleButton } from '@mui/material';
import { CropArea, ImageCropperProps } from './ImageCropper.types';
import {
  CropperRoot,
  CropperStage,
  ControlsRow,
  ControlLabel,
  StyledSlider,
  AspectToggleGroup,
} from './ImageCropper.styles';

const ASPECT_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];

/**
 * Produce a cropped Blob from the source image and pixel crop area.
 */
const getCroppedBlob = async (
  imageSrc: string,
  pixelCrop: CropArea,
): Promise<Blob | null> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
};

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  onCropChange,
  aspect: initialAspect = 1,
}) => {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [aspect, setAspect] = useState<number | undefined>(initialAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(
    null,
  );

  const handleCropComplete = useCallback(
    (_: CropArea, croppedPixels: CropArea) => {
      setCroppedAreaPixels(croppedPixels);
    },
    [],
  );

  // Whenever the cropped area settles, generate a fresh blob for the parent.
  useEffect(() => {
    let cancelled = false;
    if (!croppedAreaPixels) return;
    (async () => {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      if (!cancelled) onCropChange(blob);
    })();
    return () => {
      cancelled = true;
    };
  }, [croppedAreaPixels, imageSrc, onCropChange]);

  return (
    <CropperRoot>
      <CropperStage>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          restrictPosition
          showGrid
        />
      </CropperStage>

      <ControlsRow>
        <ControlLabel>Zoom</ControlLabel>
        <StyledSlider
          value={zoom}
          min={1}
          max={3}
          step={0.05}
          onChange={(_, v) => setZoom(v as number)}
          aria-label="Zoom"
        />
      </ControlsRow>

      <ControlsRow>
        <ControlLabel>Aspect</ControlLabel>
        <AspectToggleGroup
          value={aspect ?? 'free'}
          exclusive
          size="small"
          onChange={(_, value) => {
            if (value === null) return;
            setAspect(value === 'free' ? undefined : (value as number));
          }}
        >
          {ASPECT_OPTIONS.map((opt) => (
            <ToggleButton
              key={opt.label}
              value={opt.value ?? 'free'}
              aria-label={opt.label}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </AspectToggleGroup>
      </ControlsRow>
    </CropperRoot>
  );
};

export default ImageCropper;
