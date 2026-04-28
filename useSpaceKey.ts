import { useEffect, useState } from 'react';

/**
 * Tracks whether the spacebar is currently held down anywhere on the window.
 * Used to enable a temporary pan mode while drawing/resizing.
 */
export const useSpaceKey = (): boolean => {
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpaceHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpaceHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return isSpaceHeld;
};
