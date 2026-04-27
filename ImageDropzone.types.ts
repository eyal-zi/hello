export interface ImageDropzoneProps {
  /** Called when a valid image file is selected */
  onImageSelected: (file: File, previewUrl: string) => void;
  /** Accepted MIME types */
  accept?: string;
  /** Max file size in bytes */
  maxSize?: number;
}
