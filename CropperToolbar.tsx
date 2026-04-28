import React from 'react';
import { Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import { Toolbar, ToolbarButton, ToolbarGroup } from './ImageCropper.styles';

interface CropperToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onClearSelection: () => void;
  onResetSelection: () => void;
  /** Disables the clear-selection button when there is nothing to clear. */
  isClearDisabled: boolean;
}

const CropperToolbar: React.FC<CropperToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onFitToView,
  onClearSelection,
  onResetSelection,
  isClearDisabled,
}) => (
  <Toolbar>
    <ToolbarGroup>
      <Tooltip title="Zoom out">
        <ToolbarButton size="small" onClick={onZoomOut}>
          <ZoomOutIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
      <Tooltip title="Zoom in">
        <ToolbarButton size="small" onClick={onZoomIn}>
          <ZoomInIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
      <Tooltip title="Fit to view">
        <ToolbarButton size="small" onClick={onFitToView}>
          <CenterFocusStrongIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
    </ToolbarGroup>
    <ToolbarGroup>
      <Tooltip title="Clear selection (Backspace)">
        {/* Wrap disabled button in a span so the Tooltip still works */}
        <span>
          <ToolbarButton
            size="small"
            onClick={onClearSelection}
            disabled={isClearDisabled}
          >
            <DeleteIcon fontSize="small" />
          </ToolbarButton>
        </span>
      </Tooltip>
      <Tooltip title="Reset selection & view">
        <ToolbarButton size="small" onClick={onResetSelection}>
          <RestartAltIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
    </ToolbarGroup>
  </Toolbar>
);

export default CropperToolbar;
