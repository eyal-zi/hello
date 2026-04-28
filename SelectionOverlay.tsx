import React from 'react';
import {
  MaskPiece,
  ResizeHandle,
  SelectionRect,
  SnipLayer,
} from './ImageCropper.styles';
import { CropRect, DragHandle, HandlePlacement } from './ImageCropper.types';

const HANDLE_PLACEMENTS: HandlePlacement[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

interface SelectionOverlayProps {
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  selectionRect: CropRect | null;
  onSelectionPointerDown: (event: React.PointerEvent) => void;
  onResizeHandlePointerDown: (
    handle: DragHandle,
  ) => (event: React.PointerEvent) => void;
}

/**
 * Renders the dark mask outside the selection, the selection rectangle
 * itself, and the 8 resize handles. Coordinates are in natural image pixels.
 */
const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  imageNaturalWidth,
  imageNaturalHeight,
  selectionRect,
  onSelectionPointerDown,
  onResizeHandlePointerDown,
}) => {
  if (!selectionRect) {
    // No selection yet → just darken the whole image so the user knows where to draw
    return (
      <SnipLayer
        style={{ width: imageNaturalWidth, height: imageNaturalHeight }}
      >
        <MaskPiece
          style={{
            left: 0,
            top: 0,
            width: imageNaturalWidth,
            height: imageNaturalHeight,
          }}
        />
      </SnipLayer>
    );
  }

  const { x, y, width, height } = selectionRect;

  const maskTop = { left: 0, top: 0, width: imageNaturalWidth, height: y };
  const maskBottom = {
    left: 0,
    top: y + height,
    width: imageNaturalWidth,
    height: Math.max(0, imageNaturalHeight - (y + height)),
  };
  const maskLeft = { left: 0, top: y, width: x, height };
  const maskRight = {
    left: x + width,
    top: y,
    width: Math.max(0, imageNaturalWidth - (x + width)),
    height,
  };

  const hasVisibleSelection = width > 0 && height > 0;

  return (
    <SnipLayer style={{ width: imageNaturalWidth, height: imageNaturalHeight }}>
      <MaskPiece style={maskTop} />
      <MaskPiece style={maskBottom} />
      <MaskPiece style={maskLeft} />
      <MaskPiece style={maskRight} />

      {hasVisibleSelection && (
        <SelectionRect
          onPointerDown={onSelectionPointerDown}
          style={{ left: x, top: y, width, height }}
        >
          {HANDLE_PLACEMENTS.map((placement) => (
            <ResizeHandle
              key={placement}
              placement={placement}
              onPointerDown={onResizeHandlePointerDown(placement)}
            />
          ))}
        </SelectionRect>
      )}
    </SnipLayer>
  );
};

export default SelectionOverlay;
