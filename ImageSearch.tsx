import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Button, CircularProgress, Tooltip, IconButton } from '@mui/material';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';

import ImageDropzone from './ImageDropzone';
import ImageCropper from './ImageCropper';
import { ImageSearchProps, ImageSearchStep } from './ImageSearch.types';
import {
  SearchIconButton,
  StyledDialog,
  StyledDialogTitle,
  TitleRow,
  TitleLeftGroup,
  StyledDialogContent,
  StyledDialogActions,
  ErrorBox,
  SendButton,
} from './ImageSearch.styles';

const DEFAULT_URL = 'https://httpbin.org/post';
const DEFAULT_FIELD = 'image';

const ImageSearch: React.FC<ImageSearchProps> = ({
  uploadUrl = DEFAULT_URL,
  fieldName = DEFAULT_FIELD,
  onUploadSuccess,
  onUploadError,
  ...iconButtonProps
}) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImageSearchStep>('dropzone');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const resetState = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl(null);
    setCroppedBlob(null);
    setError(null);
    setStep('dropzone');
  }, [imageUrl]);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    setTimeout(resetState, 200);
  }, [submitting, resetState]);

  const handleImageSelected = useCallback((file: File, previewUrl: string) => {
    setImageFile(file);
    setImageUrl(previewUrl);
    setStep('crop');
  }, []);

  const handleBack = useCallback(() => {
    resetState();
  }, [resetState]);

  const handleSubmit = useCallback(async () => {
    if (!croppedBlob || !imageFile) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      const baseName = imageFile.name.replace(/\.[^.]+$/, '') || 'image';
      formData.append(fieldName, croppedBlob, `${baseName}-cropped.jpg`);

      const response = await axios.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onUploadSuccess?.(response.data);
      setOpen(false);
      setTimeout(resetState, 200);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.message
          ? err.message
          : 'Upload failed. Please try again.';
      setError(message);
      onUploadError?.(err);
    } finally {
      setSubmitting(false);
    }
  }, [
    croppedBlob,
    imageFile,
    fieldName,
    uploadUrl,
    onUploadSuccess,
    onUploadError,
    resetState,
  ]);

  return (
    <>
      <Tooltip title="Search by image">
        <SearchIconButton
          onClick={handleOpen}
          aria-label="search by image"
          {...iconButtonProps}
        >
          <ImageSearchIcon />
        </SearchIconButton>
      </Tooltip>

      <StyledDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <StyledDialogTitle>
          <TitleRow>
            <TitleLeftGroup>
              {step === 'crop' && (
                <IconButton size="small" onClick={handleBack} aria-label="back">
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              )}
              {step === 'dropzone' ? 'Upload an image' : 'Crop your image'}
            </TitleLeftGroup>
            <IconButton
              size="small"
              onClick={handleClose}
              aria-label="close"
              disabled={submitting}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </TitleRow>
        </StyledDialogTitle>

        <StyledDialogContent>
          {step === 'dropzone' && (
            <ImageDropzone onImageSelected={handleImageSelected} />
          )}
          {step === 'crop' && imageUrl && (
            <ImageCropper imageSrc={imageUrl} onCropChange={setCroppedBlob} />
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
        </StyledDialogContent>

        <StyledDialogActions>
          <Button onClick={handleClose} disabled={submitting} color="inherit">
            Cancel
          </Button>
          <SendButton
            onClick={handleSubmit}
            variant="contained"
            disabled={step !== 'crop' || !croppedBlob || submitting}
            startIcon={
              submitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SendIcon />
              )
            }
          >
            {submitting ? 'Sending...' : 'Send'}
          </SendButton>
        </StyledDialogActions>
      </StyledDialog>
    </>
  );
};

export default ImageSearch;
