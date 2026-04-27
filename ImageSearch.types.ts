import { IconButtonProps } from '@mui/material';

export interface ImageSearchProps extends Omit<IconButtonProps, 'onSubmit'> {
  /** Endpoint to send the cropped image to */
  uploadUrl?: string;
  /** Form field name for the image */
  fieldName?: string;
  /** Called after successful upload */
  onUploadSuccess?: (response: unknown) => void;
  /** Called when upload fails */
  onUploadError?: (error: unknown) => void;
}

export type ImageSearchStep = 'dropzone' | 'crop';
