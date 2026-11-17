import { create } from 'zustand';
import { serial } from './db';

export interface UndoEntry {
  id: number;
  label: string;
  /** Reverses the command. */
  undo: () => Promise<void>;
  /** Show a toast with an Undo button for this entry. */
  announce: boolean;
}

interface UndoState {
  stack: UndoEntry[];
  /** The entry the toast is currently showing, if any. */
  toast: UndoEntry | null;
  dismissToast: () => void;
}

const MAX_ENTRIES = 50;
let nextId = 1;

export const useUndo = create<UndoState>((set) => ({
  stack: [],
  toast: null,
  dismissToast: () => set({ toast: null }),
}));

/** Every command registers how to reverse itself. */
export function recordUndo(label: string, undo: () => Promise<void>, announce = false): void {
  const entry: UndoEntry = { id: nextId++, label, undo, announce };
  useUndo.setState((s) => ({
    stack: [...s.stack, entry].slice(-MAX_ENTRIES),
    toast: announce ? entry : s.toast,
  }));
}

/**
 * Reverses the most recent command. Returns its label, or null if there was
 * nothing to undo. It waits its turn in the command queue, so an undo
 * pressed while a command is still finishing reverses that command rather
 * than finding nothing there.
 */
export function undoLast(): Promise<string | null> {
  return serial(async () => {
    const { stack } = useUndo.getState();
    const entry = stack[stack.length - 1];
    if (!entry) return null;
    useUndo.setState((s) => ({
      stack: s.stack.slice(0, -1),
      toast: s.toast?.id === entry.id ? null : s.toast,
    }));
    await entry.undo();
    return entry.label;
  });
}

export function clearUndo(): void {
  useUndo.setState({ stack: [], toast: null });
}
