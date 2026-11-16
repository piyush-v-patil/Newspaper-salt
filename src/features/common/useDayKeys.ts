import { useEffect, useRef } from 'react';

interface Handlers {
  previous: () => void;
  next: () => void;
  today: () => void;
}

/** Shift+Left/Right moves a day; Shift+Space returns to today. */
export function useDayKeys(handlers: Handlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowLeft') latest.current.previous();
      else if (e.key === 'ArrowRight') latest.current.next();
      else if (e.key === ' ') {
        e.preventDefault();
        latest.current.today();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
