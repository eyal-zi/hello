import { styled } from '@mui/material/styles';
import {
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Button,
} from '@mui/material';

export const SearchIconButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(1.25),
  transition: theme.transitions.create(
    ['background-color', 'border-color', 'transform'],
    { duration: theme.transitions.duration.shorter },
  ),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-1px)',
  },
}));

export const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    minWidth: 480,
    [theme.breakpoints.down('sm')]: {
      minWidth: '90vw',
      margin: theme.spacing(2),
    },
  },
}));

export const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '1.125rem',
  paddingBottom: theme.spacing(1),
}));

export const TitleRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
});

export const TitleLeftGroup = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(2),
}));

export const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.divider}`,
  gap: theme.spacing(1),
}));

export const StatusBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
}));

export const ErrorBox = styled(StatusBox)(({ theme }) => ({
  color: theme.palette.error.main,
}));

export const SendButton = styled(Button)({
  textTransform: 'none',
  borderRadius: 8,
  fontWeight: 600,
});
