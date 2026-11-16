import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addSubtask, deleteSubtask, renameSubtask, setSubtaskCompleted } from '@/data/commands/subtasks';
import type { Id, Subtask } from '@/data/types';
import { CheckCircle } from '@/ui/CheckCircle';
import { useTaskFocus } from './taskFocus';

function SubtaskRow({ subtask, onEnter }: { subtask: Subtask; onEnter: () => void }) {
  const done = subtask.completedAt !== null;
  return (
    <li className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-hover">
      <CheckCircle
        size="sm"
        checked={done}
        onChange={(next) => void setSubtaskCompleted(subtask.id, next)}
        label={done ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
      />
      <input
        key={subtask.title}
        defaultValue={subtask.title}
        aria-label="Subtask"
        onBlur={(e) => void renameSubtask(subtask.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
            onEnter();
          } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
            e.preventDefault();
            void deleteSubtask(subtask.id);
          }
        }}
        className={`min-w-0 flex-1 bg-transparent text-[14px] outline-none ${done ? 'text-ink-3 line-through' : ''}`}
      />
      <button
        type="button"
        aria-label={`Delete ${subtask.title}`}
        onClick={() => void deleteSubtask(subtask.id)}
        className="grid h-5 w-5 place-items-center rounded text-ink-3 opacity-0 hover:text-over focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </li>
  );
}

export function Subtasks({ taskId, subtasks }: { taskId: Id; subtasks: Subtask[] }) {
  const [draft, setDraft] = useState('');
  const add = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = useTaskFocus.getState();
    if (focus.focusSubtaskOnOpen) {
      focus.setFocusSubtaskOnOpen(false);
      add.current?.focus();
    }
  }, [taskId]);

  async function submit() {
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    await addSubtask(taskId, text);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <ul className="flex flex-col gap-0.5">
        {subtasks.map((s) => (
          <SubtaskRow key={s.id} subtask={s} onEnter={() => add.current?.focus()} />
        ))}
      </ul>
      <div className="flex items-center gap-2.5 px-1 py-1 text-ink-3 focus-within:text-ink">
        <Plus size={14} />
        <input
          ref={add}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Add subtask"
          aria-label="Add subtask"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
    </div>
  );
}
