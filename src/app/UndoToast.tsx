import { useEffect } from 'react';
import { undoLast, useUndo } from '@/data/undo';

const VISIBLE_MS = 5000;

export function UndoToast() {
  const toast = useUndo((s) => s.toast);
  const dismiss = useUndo((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="absolute bottom-5 left-5 z-40 flex items-center gap-3 rounded-lg bg-ink py-2 pl-3.5 pr-2 text-[13px] text-canvas shadow-pop"
    >
      <span>{toast.label}</span>
      <button
        type="button"
        onClick={() => void undoLast()}
        className="rounded-md px-2 py-1 font-medium text-canvas underline-offset-2 hover:underline"
      >
        Undo
      </button>
    </div>
  );
}
