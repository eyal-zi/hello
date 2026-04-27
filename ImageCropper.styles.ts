import { styled } from '@mui/material/styles';
import { Box, Stack, Typography, Slider, ToggleButtonGroup } from '@mui/material';

export const CropperRoot = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(2),
}));

export const CropperStage = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: 320,
  borderRadius: 12,
  overflow: 'hidden',
  backgroundColor: theme.palette.grey[900],
  boxShadow: 'inset 0 0 0 1px ' + theme.palette.divider,
}));

export const ControlsRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
}));

export const ControlLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.8125rem',
  color: theme.palette.text.secondary,
  minWidth: 56,
}));

export const StyledSlider = styled(Slider)(({ theme }) => ({
  flex: 1,
  minWidth: 140,
  color: theme.palette.primary.main,
  '& .MuiSlider-thumb': {
    width: 16,
    height: 16,
  },
  '& .MuiSlider-rail': {
    opacity: 0.3,
  },
}));

export const AspectToggleGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontWeight: 500,
    paddingInline: theme.spacing(1.5),
    paddingBlock: theme.spacing(0.5),
    borderRadius: 8,
    fontSize: '0.8125rem',
  },
}));
