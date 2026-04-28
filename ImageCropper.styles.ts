import { styled } from '@mui/material/styles';
import { Box, Stack, Typography, IconButton } from '@mui/material';
import { HandlePlacement } from './ImageCropper.types';

export const CropperRoot = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1.25),
  width: '100%',
}));

/**
 * The stage. Fixed-height viewport that clips the (possibly zoomed) image.
 * All pointer interactions happen here.
 */
export const CropperStage = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: 420,
  borderRadius: 12,
  overflow: 'hidden',
  backgroundColor: theme.palette.grey[900],
  border: `1px solid ${theme.palette.divider}`,
  userSelect: 'none',
  touchAction: 'none',
  cursor: 'crosshair',
}));

/**
 * The transformed layer: holds the image + the selection overlay together,
 * so when we pan/zoom the layer, the selection stays aligned with the image.
 * Position is set via inline transform from React state (dynamic geometry only).
 */
export const TransformLayer = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  transformOrigin: '0 0',
  willChange: 'transform',
});

/** The image itself - rendered at its natural size inside the transform layer. */
export const StageImage = styled('img')({
  display: 'block',
  pointerEvents: 'none',
  // Use natural pixel dimensions; the parent transforms it.
  // width/height are set inline from React state because they depend on the loaded image.
});

/**
 * Container for the snipping mask + selection. Sits on top of the image at
 * the same coordinate system (natural-pixel space inside the transform layer).
 */
export const SnipLayer = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  // width/height set inline from React state to match the natural image size
});

/** Dark overlay piece outside the selection. */
export const MaskPiece = styled(Box)({
  position: 'absolute',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  pointerEvents: 'none',
});

/**
 * The selection rectangle. Border thickness is kept visually consistent
 * regardless of zoom by using a CSS variable that the parent updates.
 */
export const SelectionRect = styled(Box)(({ theme }) => ({
  position: 'absolute',
  outline: `var(--selection-border, 2px) solid ${theme.palette.primary.main}`,
  outlineOffset: 'calc(-1 * var(--selection-border, 2px))',
  cursor: 'move',
  boxSizing: 'border-box',
}));

interface HandleProps {
  placement: HandlePlacement;
}

const handleOffsets: Record<
  HandlePlacement,
  { top: string; left: string; cursor: string }
> = {
  nw: { top: '0%', left: '0%', cursor: 'nwse-resize' },
  n:  { top: '0%', left: '50%', cursor: 'ns-resize' },
  ne: { top: '0%', left: '100%', cursor: 'nesw-resize' },
  e:  { top: '50%', left: '100%', cursor: 'ew-resize' },
  se: { top: '100%', left: '100%', cursor: 'nwse-resize' },
  s:  { top: '100%', left: '50%', cursor: 'ns-resize' },
  sw: { top: '100%', left: '0%', cursor: 'nesw-resize' },
  w:  { top: '50%', left: '0%', cursor: 'ew-resize' },
};

/**
 * A resize handle. Its actual on-screen size is constant regardless of zoom,
 * achieved by counter-scaling: width/height are set in CSS units that the
 * parent counter-scales via a CSS variable --handle-size.
 */
export const ResizeHandle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'placement',
})<HandleProps>(({ theme, placement }) => {
  const o = handleOffsets[placement];
  return {
    position: 'absolute',
    width: 'var(--handle-size, 12px)',
    height: 'var(--handle-size, 12px)',
    top: o.top,
    left: o.left,
    transform: 'translate(-50%, -50%)',
    backgroundColor: theme.palette.background.paper,
    border: 'var(--handle-border, 2px) solid ' + theme.palette.primary.main,
    borderRadius: 2,
    cursor: o.cursor,
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
    '&:hover': {
      backgroundColor: theme.palette.primary.main,
    },
  };
});

/** Live size readout while drawing/resizing. */
export const SizeBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(1),
  right: theme.spacing(1),
  paddingInline: theme.spacing(1),
  paddingBlock: theme.spacing(0.25),
  borderRadius: 6,
  backgroundColor: 'rgba(0,0,0,0.75)',
  color: theme.palette.common.white,
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  pointerEvents: 'none',
  zIndex: 2,
}));

/** Floating zoom-level badge in the top-left of the stage. */
export const ZoomBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  left: theme.spacing(1),
  paddingInline: theme.spacing(1),
  paddingBlock: theme.spacing(0.25),
  borderRadius: 6,
  backgroundColor: 'rgba(0,0,0,0.75)',
  color: theme.palette.common.white,
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  pointerEvents: 'none',
  zIndex: 2,
}));

/** Toolbar above the stage. */
export const Toolbar = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  paddingInline: theme.spacing(0.5),
}));

export const ToolbarGroup = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

export const ToolbarButton = styled(IconButton)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(0.75),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
  },
}));

export const HintText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.8125rem',
  textAlign: 'center',
}));
