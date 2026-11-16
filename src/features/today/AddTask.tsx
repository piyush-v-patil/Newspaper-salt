import { Plus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useUi } from '@/app/uiStore';
import { createTask } from '@/data/commands/tasks';
import type { Day } from '@/domain/dates';

/** Inline add row. Stays focused after Enter so several tasks can be typed in a row. */
export function AddTask({ day }: { day: Day }) {
  const [title, setTitle] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const request = useUi((s) => s.addTaskRequest);

  useEffect(() => {
    if (request > 0) input.current?.focus();
  }, [request]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const submitted = title;
    if (!submitted.trim()) return;
    // Clear before saving, so typing the next task straight away never mixes with this one.
    setTitle('');
    try {
      await createTask({ title: submitted, day });
    } catch {
      setTitle((current) => current || submitted);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex items-center gap-2.5 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-ink-3 focus-within:border-accent focus-within:text-ink"
    >
      <Plus size={16} />
      <input
        ref={input}
        id="add-task"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        placeholder="Add task"
        aria-label="Add task"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />
    </form>
  );
}
