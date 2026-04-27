export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageCropperProps {
  /** Object URL for the image being cropped */
  imageSrc: string;
  /** Called with the cropped Blob whenever the crop area changes */
  onCropChange: (croppedBlob: Blob | null) => void;
  /** Optional fixed aspect ratio (width / height). Pass undefined for free-form. */
  aspect?: number;
}
