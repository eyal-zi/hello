import { styled } from '@mui/material/styles';
import { Box, Stack, Typography, Button } from '@mui/material';

interface DropzoneRootProps {
  isDragging?: boolean;
}

export const DropzoneRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isDragging',
})<DropzoneRootProps>(({ theme, isDragging }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(5, 3),
  borderRadius: 12,
  border: `2px dashed ${
    isDragging ? theme.palette.primary.main : theme.palette.divider
  }`,
  backgroundColor: isDragging
    ? theme.palette.action.hover
    : theme.palette.background.default,
  cursor: 'pointer',
  transition: theme.transitions.create(
    ['border-color', 'background-color', 'transform'],
    { duration: theme.transitions.duration.shorter },
  ),
  textAlign: 'center',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

export const DropzoneIconWrap = styled(Box)(({ theme }) => ({
  width: 56,
  height: 56,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.primary.main + '14', // ~8% alpha
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(2),
}));

export const DropzoneStack = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(0.5),
  alignItems: 'center',
}));

export const DropzoneTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

export const DropzoneHint = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.8125rem',
}));

export const BrowseButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textTransform: 'none',
  fontWeight: 500,
  borderRadius: 8,
}));

// Hidden file input rendered as a styled MUI Box (component="input")
export const HiddenInput = styled(Box)({
  display: 'none',
});
