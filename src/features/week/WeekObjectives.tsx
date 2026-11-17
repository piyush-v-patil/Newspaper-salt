import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToday } from '@/app/useToday';
import { carryOverObjective, createObjective, deleteObjective, renameObjective, setObjectiveCompleted } from '@/data/commands/objectives';
import { createTask, setTaskCompleted } from '@/data/commands/tasks';
import { useEntriesBetween, useObjectives, useObjectiveTasks } from '@/data/queries';
import { BACKLOG, type Id, type Objective, type Task } from '@/data/types';
import { now } from '@/domain/clock';
import { formatMinutes, shiftDay, type Day } from '@/domain/dates';
import { relativeDayLabel } from '@/domain/dayLabels';
import { actualByTask, msToMinutes } from '@/domain/time';
import { useOpenTask } from '@/features/task/useOpenTask';
import { CheckCircle } from '@/ui/CheckCircle';

function LinkedTask({ task, current }: { task: Task; current: Day }) {
  const openTask = useOpenTask();
  const done = task.completedAt !== null;
  return (
    <li className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-hover">
      <CheckCircle size="sm" checked={done} onChange={(next) => void setTaskCompleted(task.id, next)} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} />
      <button type="button" onClick={() => openTask(task.id)} className={`min-w-0 flex-1 truncate text-left text-[13.5px] ${done ? 'text-ink-3 line-through' : ''}`}>
        {task.title}
      </button>
      <span className="shrink-0 text-[11.5px] text-ink-3">{task.day === BACKLOG ? 'Backlog' : relativeDayLabel(task.day, current)}</span>
      {task.plannedMin !== null && <span className="tabular shrink-0 text-[11.5px] text-ink-3">{formatMinutes(task.plannedMin)}</span>}
    </li>
  );
}

interface CardProps {
  objective: Objective;
  tasks: Task[];
  spentMin: number;
  /** The day new tasks for this objective are added to. */
  addDay: Day;
  current: Day;
}

function ObjectiveCard({ objective, tasks, spentMin, addDay, current }: CardProps) {
  const [draft, setDraft] = useState('');
  const done = objective.completedAt !== null;
  const planned = tasks.reduce((sum, t) => sum + (t.plannedMin ?? 0), 0);
  const finished = tasks.filter((t) => t.completedAt !== null).length;

  async function addTask() {
    const title = draft;
    if (!title.trim()) return;
    setDraft('');
    await createTask({ title, day: addDay, objectiveId: objective.id, channelId: objective.channelId, position: 'bottom' });
  }

  return (
    <li data-testid="objective" className="group/objective flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-start gap-2.5">
        <span className="pt-0.5">
          <CheckCircle checked={done} onChange={(next) => void setObjectiveCompleted(objective.id, next)} label={done ? `Reopen ${objective.title}` : `Complete ${objective.title}`} />
        </span>
        <input
          key={objective.title}
          defaultValue={objective.title}
          aria-label="Objective"
          onBlur={(e) => void renameObjective(objective.id, e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`min-w-0 flex-1 bg-transparent text-[15px] font-semibold tracking-tight outline-none ${done ? 'text-ink-3 line-through' : ''}`}
        />
        <button
          type="button"
          aria-label={`Delete ${objective.title}`}
          onClick={() => void deleteObjective(objective.id)}
          className="grid h-6 w-6 place-items-center rounded text-ink-3 opacity-0 hover:bg-hover hover:text-over focus-visible:opacity-100 group-hover/objective:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
      <div className="tabular flex gap-3 pl-[28px] text-[12px] text-ink-3">
        <span>
          {formatMinutes(spentMin)} spent{planned > 0 && ` of ${formatMinutes(planned)} planned`}
        </span>
        {tasks.length > 0 && (
          <span>
            {finished}/{tasks.length} tasks
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 pl-[22px]">
        <ul className="flex flex-col gap-0.5">
          {tasks.map((task) => (
            <LinkedTask key={task.id} task={task} current={current} />
          ))}
        </ul>
        <div className="flex items-center gap-2 px-1 py-1 text-ink-3 focus-within:text-ink">
          <Plus size={13} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTask();
              if (e.key === 'Escape') e.currentTarget.blur();
            }}
            placeholder="Add task"
            aria-label={`Add task to ${objective.title}`}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
          />
        </div>
      </div>
    </li>
  );
}

/** Tracked minutes per objective for a week, from the time entries of its linked tasks. */
export function useObjectiveTime(weekStart: Day, tasksByObjective: Map<Id, Task[]>): { byObjective: Map<Id, number>; onObjectives: number; total: number } {
  const entries = useEntriesBetween(weekStart, shiftDay(weekStart, 6));
  return useMemo(() => {
    const msByTask = new Map<Id, number>();
    for (const [id, actual] of actualByTask(entries, now())) msByTask.set(id, actual.totalMs);
    const byObjective = new Map<Id, number>();
    let onObjectives = 0;
    for (const [objectiveId, tasks] of tasksByObjective) {
      const ms = tasks.reduce((sum, t) => sum + (msByTask.get(t.id) ?? 0), 0);
      byObjective.set(objectiveId, msToMinutes(ms));
      onObjectives += ms;
    }
    const total = [...msByTask.values()].reduce((a, b) => a + b, 0);
    return { byObjective, onObjectives: msToMinutes(onObjectives), total: msToMinutes(total) };
  }, [entries, tasksByObjective]);
}

/** A week's objectives with the tasks behind each, plus anything left unfinished from the week before. */
export function WeekObjectives({ weekStart }: { weekStart: Day }) {
  const current = useToday();
  const [draft, setDraft] = useState('');
  const objectives = useObjectives(weekStart);
  const previous = useObjectives(shiftDay(weekStart, -7));
  const unfinished = previous.filter((o) => o.completedAt === null);
  const ids = useMemo(() => objectives.map((o) => o.id), [objectives]);
  const tasks = useObjectiveTasks(ids);
  const time = useObjectiveTime(weekStart, tasks);
  // New tasks land on today when planning the current week, otherwise on the week's first day.
  const inWeek = current >= weekStart && current <= shiftDay(weekStart, 6);
  const addDay = inWeek ? current : weekStart;

  async function add() {
    const title = draft;
    if (!title.trim()) return;
    setDraft('');
    await createObjective(weekStart, title);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3.5 py-2.5 text-ink-3 focus-within:border-accent focus-within:text-ink">
        <Plus size={15} />
        <input
          id="add-objective"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          placeholder="Add objective"
          aria-label="Add objective"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      {objectives.length === 0 && (
        <p className="px-1 text-[13.5px] text-ink-3">No objectives for this week yet. Pick the two or three outcomes that would make the week a good one.</p>
      )}
      <ul className="flex flex-col gap-3">
        {objectives.map((objective) => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            tasks={tasks.get(objective.id) ?? []}
            spentMin={time.byObjective.get(objective.id) ?? 0}
            addDay={addDay}
            current={current}
          />
        ))}
      </ul>

      {unfinished.length > 0 && (
        <section aria-label="Unfinished from last week" className="mt-3 flex flex-col gap-2">
          <h2 className="text-[12px] font-medium uppercase tracking-wider text-ink-3">Unfinished from last week</h2>
          {unfinished.map((objective) => (
            <div key={objective.id} className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[13.5px] text-ink-2">
              <span className="min-w-0 flex-1 truncate">{objective.title}</span>
              <button type="button" onClick={() => void carryOverObjective(objective.id, weekStart)} className="rounded px-1.5 py-0.5 text-[12px] text-accent hover:bg-accent-soft">
                Carry over
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
