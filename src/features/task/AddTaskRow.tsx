import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { TaskDay } from '@/data/types';
import { createFromText } from './createFromText';

/** Inline add at the top of a list. Stays focused after Enter so several tasks can be typed in a row. */
export function AddTaskRow({ day }: { day: TaskDay }) {
  const [title, setTitle] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const submitted = title;
    if (!submitted.trim()) return;
    // Clear before saving, so typing the next task straight away never mixes with this one.
    setTitle('');
    try {
      await createFromText(submitted, { day });
    } catch {
      setTitle((current) => current || submitted);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex items-center gap-2.5 rounded-lg border border-dashed border-line-strong px-3 py-2 text-ink-3 focus-within:border-accent focus-within:text-ink"
    >
      <Plus size={15} />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        placeholder="Add task"
        aria-label={`Add task to ${day}`}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
      />
    </form>
  );
}
