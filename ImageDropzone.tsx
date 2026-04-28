import React, { useCallback, useRef, useState } from 'react';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { ImageDropzoneProps } from './ImageDropzone.types';
import {
  DropzoneRoot,
  DropzoneIconWrap,
  DropzoneStack,
  DropzoneTitle,
  DropzoneHint,
  BrowseButton,
  HiddenInput,
} from './ImageDropzone.styles';

const DEFAULT_ACCEPT = 'image/*';
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ImageDropzone: React.FC<ImageDropzoneProps> = ({
  onImageSelected,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > maxSize) return;
      const previewUrl = URL.createObjectURL(file);
      onImageSelected(file, previewUrl);
    },
    [onImageSelected, maxSize],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <DropzoneRoot
      isDragging={isDragging}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={openPicker}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
    >
      <DropzoneIconWrap>
        <CloudUploadOutlinedIcon fontSize="large" />
      </DropzoneIconWrap>

      <DropzoneStack>
        <DropzoneTitle variant="body1">
          {isDragging ? 'Drop your image here' : 'Drag & drop an image'}
        </DropzoneTitle>
        <DropzoneHint variant="body2">
          PNG, JPG, or WEBP — up to {Math.round(maxSize / (1024 * 1024))}MB
        </DropzoneHint>
      </DropzoneStack>

      <BrowseButton
        variant="outlined"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
      >
        Browse files
      </BrowseButton>

      <HiddenInput
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          // reset so selecting the same file twice still triggers change
          e.target.value = '';
        }}
      />
    </DropzoneRoot>
  );
};

export default ImageDropzone;
