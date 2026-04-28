import React from 'react';
import { Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Toolbar, ToolbarButton, ToolbarGroup } from './ImageCropper.styles';

interface CropperToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  onResetSelection: () => void;
}

const CropperToolbar: React.FC<CropperToolbarProps> = ({
  onZoomIn,
  onZoomOut,
  onFitToView,
  onResetSelection,
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
      <Tooltip title="Reset selection & view">
        <ToolbarButton size="small" onClick={onResetSelection}>
          <RestartAltIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
    </ToolbarGroup>
  </Toolbar>
);

export default CropperToolbar;
