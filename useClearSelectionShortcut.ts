import { useEffect } from 'react';

interface UseClearSelectionShortcutArguments {
  /** Called when the user presses Backspace or Delete outside of an input. */
  onClearSelection: () => void;
  /** When false, the listener is not attached. */
  isEnabled: boolean;
}

/**
 * Listens for Backspace / Delete key presses globally (ignoring presses
 * inside inputs/textareas/contenteditable) and triggers a clear callback.
 */
export const useClearSelectionShortcut = ({
  onClearSelection,
  isEnabled,
}: UseClearSelectionShortcutArguments): void => {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;

      // Don't hijack the keys when the user is typing in a field
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName;
      const isEditable =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isEditable) return;

      event.preventDefault();
      onClearSelection();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClearSelection, isEnabled]);
};
