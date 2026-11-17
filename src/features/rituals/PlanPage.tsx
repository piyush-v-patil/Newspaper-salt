import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToday } from '@/app/useToday';
import { finishPlanning, updateDayRecord } from '@/data/commands/days';
import { recordPlanFinished } from '@/data/commands/profile';
import { workingWindow } from '@/data/commands/sessions';
import { updateSettings } from '@/data/commands/settings';
import { setTaskCompleted } from '@/data/commands/tasks';
import { useDayRecord, useTasksForDay } from '@/data/queries';
import { useChannelMap, useProfile, useSettings } from '@/data/ReferenceData';
import { BACKLOG, type Task } from '@/data/types';
import { formatClock, formatMinutes, longDayLabel, shiftDay, type Day } from '@/domain/dates';
import { nextWeekStart, relativeDayLabel } from '@/domain/dayLabels';
import { planningTarget } from '@/domain/rituals';
import { TimeGrid } from '@/features/calendar/TimeGrid';
import { AddTaskRow } from '@/features/task/AddTaskRow';
import { TaskList, useTaskLists } from '@/features/task/TaskDnd';
import { WorkloadCounter } from '@/features/task/WorkloadCounter';
import { celebrate } from '@/ui/Celebration';
import { CheckCircle } from '@/ui/CheckCircle';
import { Kbd } from '@/ui/Kbd';
import { Column, Guidance, RitualFrame } from './RitualFrame';

type Step = 'reflect' | 'add' | 'wait' | 'finalize' | 'summary';

/** Extra guidance shown during the first few plans. */
const COACHING: Record<Step, string> = {
  reflect: 'Looking back first keeps yesterday’s loose ends from quietly disappearing.',
  add: 'Get it all down first; deciding what fits comes next. Estimates do not need to be exact: round to 15 minutes.',
  wait: 'The bar compares your work tasks with your daily limit. Moving something to tomorrow is not failing; it is planning.',
  finalize: 'Order by what matters, not by what is easy. Timeboxing the first task or two is usually enough.',
  summary: 'Writing the plan down makes it real. Name one thing that could get in the way, so it does not catch you off guard.',
};

function Coach({ text }: { text: string }) {
  return (
    <p data-testid="coach" className="rounded-lg bg-accent-soft px-3 py-2.5 text-[13px] leading-relaxed text-ink">
      {text}
    </p>
  );
}

const toTimeInput = (min: number) => formatClock(min, '24h');
const fromTimeInput = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** The plan as plain text, for the summary step and the clipboard. */
function planText(day: Day, tasks: Task[], channelName: (task: Task) => string | null, obstacles: string): string {
  const lines = tasks.map((t) => {
    const parts = [t.title];
    if (t.plannedMin !== null) parts.push(`(${formatMinutes(t.plannedMin)})`);
    const channel = channelName(t);
    if (channel) parts.push(`#${channel}`);
    return `- ${parts.join(' ')}`;
  });
  const total = tasks.reduce((sum, t) => sum + (t.plannedMin ?? 0), 0);
  const out = [`Plan for ${longDayLabel(day)}`, '', ...lines, '', `Total planned: ${formatMinutes(total)}`];
  if (obstacles.trim()) out.push('', `Possible obstacles: ${obstacles.trim()}`);
  return out.join('\n');
}

/** Daily planning: from whatever is on the day to an ordered, right-sized, optionally timeboxed plan. */
export function PlanPage({ date }: { date?: Day }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const coached = useProfile().guidedPlansRemaining > 0;
  const channels = useChannelMap();
  const current = useToday();
  const day = date ?? planningTarget(settings.planningMin, current);
  const dayBefore = shiftDay(day, -1);
  const tomorrow = shiftDay(day, 1);
  const nextWeek = nextWeekStart(day, settings.weekStartsOn);

  const record = useDayRecord(day);
  const recordBefore = useDayRecord(dayBefore);
  const dayTasks = useTasksForDay(day);
  const beforeTasks = useTasksForDay(dayBefore);
  const tomorrowTasks = useTasksForDay(tomorrow);
  const nextWeekTasks = useTasksForDay(nextWeek);
  const backlogTasks = useTasksForDay(BACKLOG);

  const lists = useMemo(
    () => ({
      [day]: (dayTasks ?? []).filter((t) => t.kind === 'task'),
      [tomorrow]: tomorrowTasks ?? [],
      // When the week turns over tomorrow, "next week" and "tomorrow" are the same day.
      ...(nextWeek !== tomorrow ? { [nextWeek]: nextWeekTasks ?? [] } : {}),
      [BACKLOG]: backlogTasks ?? [],
    }),
    [day, tomorrow, nextWeek, dayTasks, tomorrowTasks, nextWeekTasks, backlogTasks],
  );
  const ordered = useTaskLists('plan', lists);
  const tasks = ordered[day] ?? [];

  // Whether to open with a look back is decided once, so the steps do not shift while planning.
  const loaded = record !== undefined && recordBefore !== undefined && dayTasks !== undefined && beforeTasks !== undefined;
  const finishedBefore = (beforeTasks ?? []).filter((t) => t.kind === 'task' && t.completedAt !== null);
  const carried = tasks.filter((t) => t.rolloverDays > 0);
  const reflectRef = useRef<boolean | null>(null);
  if (loaded && reflectRef.current === null) {
    reflectRef.current = recordBefore.shutdownStatus !== 'done' && finishedBefore.length + carried.length > 0;
  }

  const steps: Step[] = useMemo(
    () => [...(reflectRef.current ? (['reflect'] as const) : []), 'add', 'wait', 'finalize', ...(settings.planSummaryStep ? (['summary'] as const) : [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, settings.planSummaryStep],
  );

  const [index, setIndex] = useState<number | null>(null);
  const [obstacles, setObstacles] = useState('');
  const [skipSummary, setSkipSummary] = useState(false);
  const [copied, setCopied] = useState(false);

  // Resume where the last session left off.
  useEffect(() => {
    if (!loaded || index !== null) return;
    setIndex(record.planStatus === 'in_progress' ? Math.min(record.planStep, steps.length - 1) : 0);
    setObstacles(record.obstacles);
  }, [loaded, index, record, steps.length]);

  if (!loaded || index === null) return null;
  const step = steps[index];
  const shutdownMin = record.shutdownMin ?? workingWindow(settings, day).endMin;
  const text = planText(day, tasks, (t) => (t.channelId ? (channels.get(t.channelId)?.name ?? null) : null), obstacles);
  const dayLabel = relativeDayLabel(day, current).toLowerCase();

  const go = (next: number) => {
    setIndex(next);
    void updateDayRecord(day, { planStatus: record.planStatus === 'done' ? 'done' : 'in_progress', planStep: next, obstacles });
  };
  const exit = () => {
    void updateDayRecord(day, { planStep: index, obstacles });
    void navigate({ to: '/today' });
  };
  const finish = async () => {
    await finishPlanning(day, { planText: text, obstacles, shutdownMin, planStep: 0 });
    await recordPlanFinished();
    if (skipSummary) await updateSettings({ planSummaryStep: false });
    if (settings.celebrations) celebrate();
    await navigate({ to: settings.defaultView === 'board' ? '/board' : settings.defaultView === 'calendar' ? '/calendar' : '/today' });
  };
  const last = index === steps.length - 1;

  return (
    <RitualFrame
      name="Daily planning"
      detail={longDayLabel(day)}
      steps={steps.length}
      step={index}
      onBack={index > 0 ? () => go(index - 1) : undefined}
      onNext={() => (last ? void finish() : go(index + 1))}
      nextLabel={last ? 'Get started' : step === 'finalize' ? 'Looks good' : 'Next'}
      onExit={exit}
    >
      {step === 'reflect' && (
        <>
          <Guidance prompt="How did yesterday go?">
            <p>You didn’t shut down yesterday, so here is a quick look back before planning.</p>
            <p>Check off anything you actually finished. Whatever is left has been carried over to {dayLabel}.</p>
                      {coached && <Coach text={COACHING.reflect} />}
          </Guidance>
          <Column title="Finished" hint={`${finishedBefore.length}`} width={360}>
            {finishedBefore.length === 0 && <p className="text-[13px] text-ink-3">Nothing was checked off.</p>}
            {finishedBefore.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13.5px] text-ink-3">
                <CheckCircle checked onChange={() => void setTaskCompleted(t.id, false)} label={`Reopen ${t.title}`} />
                <span className="min-w-0 flex-1 truncate line-through">{t.title}</span>
              </div>
            ))}
          </Column>
          <Column title="Carried over" hint={`${carried.length}`} width={360}>
            {carried.length === 0 && <p className="text-[13px] text-ink-3">Nothing was left over.</p>}
            <TaskList listId={`${day}`} tasks={carried} />
          </Column>
        </>
      )}

      {step === 'add' && (
        <>
          <Guidance prompt={`What do you want to get done ${dayLabel}?`}>
            <p>Add everything you intend to do, then pull in anything waiting in the backlog.</p>
            <p>
              Give each task a time with <Kbd>W</Kbd> and a channel with <Kbd>Q</Kbd>, or type <Kbd>~</Kbd> and <Kbd>#</Kbd> as you add it.
            </p>
                      {coached && <Coach text={COACHING.add} />}
          </Guidance>
          <Column title={relativeDayLabel(day, current)} hint={<WorkloadHint tasks={tasks} />} width={380}>
            <AddTaskRow day={day} tasks={tasks} />
            <TaskList listId={day} tasks={tasks} className="min-h-40" />
          </Column>
          <Column title="Backlog" hint="Drag across" width={320}>
            <AddTaskRow day={BACKLOG} tasks={ordered[BACKLOG]} />
            <TaskList listId={BACKLOG} tasks={ordered[BACKLOG] ?? []} className="min-h-40" />
          </Column>
        </>
      )}

      {step === 'wait' && (
        <>
          <Guidance prompt="What can wait?">
            <p>A day you can finish beats a list you can’t. If the bar is amber or red, something has to move.</p>
            <p>
              Drag a task to a later day, press <Kbd>D</Kbd> to push it one day, or <Kbd>Z</Kbd> to send it to the backlog.
            </p>
                      {coached && <Coach text={COACHING.wait} />}
          </Guidance>
          <Column title={relativeDayLabel(day, current)} width={380}>
            <WorkloadCounter day={day} tasks={tasks} />
            <TaskList listId={day} tasks={tasks} className="min-h-40" />
          </Column>
          <Column title={relativeDayLabel(tomorrow, current)} width={270}>
            <TaskList listId={tomorrow} tasks={ordered[tomorrow] ?? []} className="min-h-40" />
          </Column>
          {nextWeek !== tomorrow && (
            <Column title="Next week" hint={relativeDayLabel(nextWeek, current)} width={270}>
              <TaskList listId={nextWeek} tasks={ordered[nextWeek] ?? []} className="min-h-40" />
            </Column>
          )}
        </>
      )}

      {step === 'finalize' && (
        <>
          <Guidance prompt="Finalize your plan">
            <p>Put the tasks in the order you will work on them.</p>
            <p>
              Timeboxing is optional: drag a task onto the calendar, or press <Kbd>X</Kbd> to drop it into the next free time.
            </p>
            <label className="mt-2 flex flex-col gap-1.5 text-ink">
              <span className="text-[12.5px] font-medium">When will you stop for the day?</span>
              <input
                type="time"
                aria-label="Shutdown time"
                value={toTimeInput(shutdownMin)}
                onChange={(e) => {
                  const next = fromTimeInput(e.target.value);
                  if (next !== null) void updateDayRecord(day, { shutdownMin: next });
                }}
                className="w-[120px] rounded-md border border-line bg-surface px-2 py-1.5 text-[13.5px]"
              />
            </label>
                      {coached && <Coach text={COACHING.finalize} />}
          </Guidance>
          <Column title={relativeDayLabel(day, current)} width={380}>
            <WorkloadCounter day={day} tasks={tasks} />
            <TaskList listId={day} tasks={tasks} className="min-h-40" />
          </Column>
          <section aria-label="Calendar" className="flex min-h-0 w-[340px] shrink-0 flex-col border-l border-line">
            <TimeGrid days={[day]} />
          </section>
        </>
      )}

      {step === 'summary' && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
            <h1 className="text-[22px] font-semibold tracking-tight">Your plan for {dayLabel}</h1>
            {coached && <Coach text={COACHING.summary} />}
            <ul className="flex flex-col gap-1.5">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-baseline gap-2 text-[14.5px]">
                  <span className="text-ink-3">•</span>
                  <span className="min-w-0 flex-1">{t.title}</span>
                  {t.plannedMin !== null && <span className="tabular text-[12.5px] text-ink-3">{formatMinutes(t.plannedMin)}</span>}
                </li>
              ))}
              {tasks.length === 0 && <li className="text-[14px] text-ink-3">Nothing planned. A light day is a plan too.</li>}
            </ul>
            <p className="tabular text-[13px] text-ink-2">
              Total planned {formatMinutes(tasks.reduce((sum, t) => sum + (t.plannedMin ?? 0), 0))} · stopping at {formatClock(shutdownMin, settings.timeFormat)}
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">Anything that might get in the way?</span>
              <textarea
                value={obstacles}
                onChange={(e) => setObstacles(e.target.value)}
                rows={3}
                aria-label="Obstacles"
                placeholder="A meeting that may run over, something you are waiting on…"
                className="resize-none rounded-md border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent"
              />
            </label>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <input type="checkbox" checked={skipSummary} onChange={(e) => setSkipSummary(e.target.checked)} />
                Skip this step in the future
              </label>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(text).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
                className="h-8 rounded-md border border-line px-3 text-[13px] hover:bg-hover"
              >
                {copied ? 'Copied' : 'Copy plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RitualFrame>
  );
}

function WorkloadHint({ tasks }: { tasks: Task[] }) {
  const total = tasks.reduce((sum, t) => sum + (t.plannedMin ?? 0), 0);
  return total > 0 ? <span className="tabular">{formatMinutes(total)} planned</span> : null;
}
