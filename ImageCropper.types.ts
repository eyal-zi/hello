export interface CropRect {
  /** Left in image-natural pixels */
  x: number;
  /** Top in image-natural pixels */
  y: number;
  /** Width in image-natural pixels */
  width: number;
  /** Height in image-natural pixels */
  height: number;
}

export interface ImageCropperProps {
  /** Object URL of the image being cropped */
  imageSrc: string;
  /** Called whenever the crop selection settles, with a JPEG Blob of the selected area */
  onCropChange: (croppedBlob: Blob | null) => void;
}

/** Drag mode for the selection rectangle */
export type DragHandle =
  | 'move'
  | 'new'
  | 'pan'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

/** Resize-handle placements (the 8 corners + edges) */
export type HandlePlacement =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export interface DragState {
  handle: DragHandle;
  /** Pointer start in viewport coords */
  startClientX: number;
  startClientY: number;
  /** Selection rect at drag start (image-natural pixels) */
  origRect: CropRect;
  /** View transform at drag start (used for panning) */
  origTx: number;
  origTy: number;
}

/** Pan + zoom transform applied to the image. */
export interface ViewTransform {
  /** Translation in container pixels */
  tx: number;
  ty: number;
  /** Scale multiplier */
  scale: number;
}
