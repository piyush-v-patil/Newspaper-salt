import { useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useToday } from '@/app/useToday';
import { finishWeeklyPlanning, finishWeeklyReview } from '@/data/commands/weeks';
import { useEntriesBetween, useObjectives, useObjectiveTasks, useTasksById, useTasksInRange, useWeekRecord } from '@/data/queries';
import { useChannelMap, useSettings } from '@/data/ReferenceData';
import { now } from '@/domain/clock';
import { formatMinutes, fromDay, shiftDay, type Day } from '@/domain/dates';
import { entryDay, entryMs, msToMinutes } from '@/domain/time';
import { planningWeek, reviewWeek, weekDays, weekLabel } from '@/domain/weeks';
import { useObjectiveTime, WeekObjectives } from '@/features/week/WeekObjectives';
import { celebrate } from '@/ui/Celebration';
import { Column, Guidance, RitualFrame } from './RitualFrame';

function useHome() {
  const navigate = useNavigate();
  const { defaultView } = useSettings();
  return () => void navigate({ to: defaultView === 'board' ? '/board' : defaultView === 'calendar' ? '/calendar' : '/today' });
}

function SummaryStep({ prompt, help, value, onChange }: { prompt: string; help: string; value: string; onChange: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4 px-6 py-10">
        <h1 className="text-[22px] font-semibold tracking-tight">{prompt}</h1>
        <p className="text-[13.5px] text-ink-2">{help}</p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          aria-label="Summary"
          className="resize-none rounded-md border border-line bg-surface px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(true), () => setCopied(false))}
          className="h-8 self-start rounded-md border border-line px-3 text-[13px] hover:bg-hover"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** Weekly planning: set the week's objectives, then write the plan down. */
export function WeeklyPlanPage() {
  const navigate = useNavigate();
  const home = useHome();
  const settings = useSettings();
  const current = useToday();
  const weekStart = planningWeek(current, settings.weekStartsOn);
  const record = useWeekRecord(weekStart);
  const objectives = useObjectives(weekStart);
  const lastWeek = useObjectives(shiftDay(weekStart, -7));
  const [index, setIndex] = useState(0);
  const [text, setText] = useState<string | null>(null);

  const draft = useMemo(() => {
    const lines = [`Week of ${weekLabel(weekStart)}`, '', 'Objectives'];
    lines.push(...(objectives.length ? objectives.map((o) => `- ${o.title}`) : ['- None set']));
    const finished = lastWeek.filter((o) => o.completedAt !== null);
    if (finished.length) lines.push('', 'Finished last week', ...finished.map((o) => `- ${o.title}`));
    return lines.join('\n');
  }, [weekStart, objectives, lastWeek]);

  if (!record) return null;
  const value = text ?? (record.planStatus === 'done' && record.planText ? record.planText : draft);

  const finish = async () => {
    await finishWeeklyPlanning(weekStart, value);
    if (settings.celebrations) celebrate();
    home();
  };

  return (
    <RitualFrame
      name="Weekly planning"
      detail={weekLabel(weekStart)}
      steps={2}
      step={index}
      onBack={index === 1 ? () => setIndex(0) : undefined}
      onNext={() => (index === 0 ? setIndex(1) : void finish())}
      nextLabel={index === 1 ? 'Done' : 'Next'}
      onExit={() => void navigate({ to: '/today' })}
    >
      {index === 0 ? (
        <>
          <Guidance prompt="What would make this a good week?">
            <p>Set two or three objectives: outcomes, not chores. Then attach the tasks that move each one forward.</p>
            <p>Anything unfinished from last week is at the bottom, ready to carry over or let go.</p>
          </Guidance>
          <Column title="Weekly objectives" hint={weekLabel(weekStart)} width={560}>
            <WeekObjectives weekStart={weekStart} />
          </Column>
        </>
      ) : (
        <SummaryStep
          prompt="Your plan for the week"
          help="A short note to your future self. Edit it however you like."
          value={value}
          onChange={setText}
        />
      )}
    </RitualFrame>
  );
}

/** Weekly review: how the objectives went, what got done, where the time went. */
export function WeeklyReviewPage() {
  const navigate = useNavigate();
  const home = useHome();
  const settings = useSettings();
  const channels = useChannelMap();
  const current = useToday();
  const weekStart = reviewWeek(current, settings.weekStartsOn);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const record = useWeekRecord(weekStart);

  const objectives = useObjectives(weekStart);
  const objectiveIds = useMemo(() => objectives.map((o) => o.id), [objectives]);
  const linked = useObjectiveTasks(objectiveIds);
  const objectiveTime = useObjectiveTime(weekStart, linked);

  const byDay = useTasksInRange(days[0], days[6]);
  const entries = useEntriesBetween(days[0], days[6]);
  const entryTaskIds = useMemo(() => [...new Set(entries.map((e) => e.taskId))].sort(), [entries]);
  const timedTasks = useTasksById(entryTaskIds);

  const stats = useMemo(() => {
    const at = now();
    const minutesByDay = new Map<Day, number>(days.map((d) => [d, 0]));
    const msByChannel = new Map<string, { name: string; color: string; ms: number }>();
    let totalMs = 0;
    for (const entry of entries) {
      const ms = entryMs(entry, at);
      totalMs += ms;
      const day = entryDay(entry);
      if (minutesByDay.has(day)) minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + ms / 60_000);
      const channel = channels.get(timedTasks.get(entry.taskId)?.channelId ?? '');
      const key = channel?.id ?? 'none';
      const row = msByChannel.get(key) ?? { name: channel ? `#${channel.name}` : 'No channel', color: channel?.color ?? 'var(--ink-3)', ms: 0 };
      row.ms += ms;
      msByChannel.set(key, row);
    }
    const doneByDay = new Map<Day, string[]>(
      days.map((d) => [d, (byDay?.get(d) ?? []).filter((t) => t.kind === 'task' && t.completedDay === d).map((t) => t.title)]),
    );
    const doneCount = [...doneByDay.values()].reduce((sum, list) => sum + list.length, 0);
    return {
      minutesByDay,
      doneByDay,
      doneCount,
      totalMin: msToMinutes(totalMs),
      channels: [...msByChannel.values()].sort((a, b) => b.ms - a.ms),
    };
  }, [entries, byDay, days, channels, timedTasks]);

  const hasObjectives = objectives.length > 0;
  const steps = hasObjectives ? (['objectives', 'done', 'summary'] as const) : (['done', 'summary'] as const);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState<string | null>(null);
  // If objectives load after the first render, the step list grows; stay on the first step.
  useEffect(() => setIndex(0), [hasObjectives]);

  if (!record || !byDay) return null;
  const step = steps[Math.min(index, steps.length - 1)];
  const completedObjectives = objectives.filter((o) => o.completedAt !== null);
  const draft = [
    `Week of ${weekLabel(weekStart)}`,
    '',
    `Finished ${stats.doneCount} ${stats.doneCount === 1 ? 'task' : 'tasks'} and logged ${formatMinutes(stats.totalMin)}.`,
    ...(hasObjectives ? ['', `Objectives: ${completedObjectives.length} of ${objectives.length} complete`, ...objectives.map((o) => `- [${o.completedAt !== null ? 'x' : ' '}] ${o.title}`)] : []),
    '',
    'What went well:',
    '',
    'What to change next week:',
  ].join('\n');
  const value = text ?? (record.reviewStatus === 'done' && record.reviewText ? record.reviewText : draft);
  const peak = Math.max(60, ...stats.minutesByDay.values());

  const finish = async () => {
    await finishWeeklyReview(weekStart, value);
    if (settings.celebrations) celebrate();
    home();
  };
  const last = index >= steps.length - 1;

  return (
    <RitualFrame
      name="Weekly review"
      detail={weekLabel(weekStart)}
      steps={steps.length}
      step={Math.min(index, steps.length - 1)}
      onBack={index > 0 ? () => setIndex(index - 1) : undefined}
      onNext={() => (last ? void finish() : setIndex(index + 1))}
      nextLabel={last ? 'Wrap up' : 'Next'}
      onExit={() => void navigate({ to: '/today' })}
    >
      {step === 'objectives' && (
        <>
          <Guidance prompt="Week in review">
            <p>How the week’s objectives turned out.</p>
            <p className="tabular text-[26px] font-semibold tracking-tight text-ink">{formatMinutes(objectiveTime.onObjectives)}</p>
            <p>
              went into objectives
              {objectiveTime.total > 0 && `, ${Math.round((objectiveTime.onObjectives / objectiveTime.total) * 100)}% of all tracked time`}.
            </p>
          </Guidance>
          <Column title="Objectives" hint={`${completedObjectives.length} of ${objectives.length} complete`} width={520}>
            {objectives.map((o) => {
              const tasks = linked.get(o.id) ?? [];
              return (
                <div key={o.id} data-testid="review-objective" className="flex items-baseline gap-2 rounded-lg border border-line px-3 py-2.5 text-[13.5px]">
                  <span className={`shrink-0 text-[12px] font-medium ${o.completedAt !== null ? 'text-done' : 'text-ink-3'}`}>{o.completedAt !== null ? 'Done' : 'Open'}</span>
                  <span className="min-w-0 flex-1 truncate">{o.title}</span>
                  <span className="tabular shrink-0 text-[12px] text-ink-3">
                    {formatMinutes(objectiveTime.byObjective.get(o.id) ?? 0)} · {tasks.filter((t) => t.completedAt !== null).length}/{tasks.length} tasks
                  </span>
                </div>
              );
            })}
          </Column>
        </>
      )}

      {step === 'done' && (
        <>
          <Guidance prompt="What got done">
            <p className="tabular text-[26px] font-semibold tracking-tight text-ink">{formatMinutes(stats.totalMin)}</p>
            <p>
              logged across the week, with {stats.doneCount} {stats.doneCount === 1 ? 'task' : 'tasks'} finished.
            </p>
          </Guidance>
          <Column title="By day" width={360}>
            {days.map((day) => {
              const titles = stats.doneByDay.get(day) ?? [];
              return (
                <div key={day} className="flex flex-col gap-1 border-b border-line pb-2.5 last:border-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium">{format(fromDay(day), 'EEEE')}</span>
                    <span className="tabular text-[12px] text-ink-3">{titles.length || '–'}</span>
                  </div>
                  {titles.map((title, i) => (
                    <span key={i} className="truncate text-[13px] text-ink-2">
                      {title}
                    </span>
                  ))}
                </div>
              );
            })}
          </Column>
          <Column title="Where the time went" width={380}>
            <figure aria-label="Time logged per day" className="flex flex-col gap-2">
              <figcaption className="text-[12px] font-medium uppercase tracking-wider text-ink-3">Daily productivity</figcaption>
              <div className="flex h-[132px] items-end gap-2">
                {days.map((day) => {
                  const minutes = Math.round(stats.minutesByDay.get(day) ?? 0);
                  return (
                    <div key={day} data-testid="day-bar" className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className="tabular text-[10.5px] text-ink-3">{minutes > 0 ? formatMinutes(minutes) : ''}</span>
                      <div className="w-full rounded-t bg-accent" style={{ height: `${(minutes / peak) * 100}%`, minHeight: minutes > 0 ? 2 : 0 }} />
                      <span className="text-[11px] text-ink-3">{format(fromDay(day), 'EEEEE')}</span>
                    </div>
                  );
                })}
              </div>
            </figure>
            <div className="mt-4 flex flex-col gap-2">
              <span className="text-[12px] font-medium uppercase tracking-wider text-ink-3">How you spent your time</span>
              {stats.channels.length === 0 && <p className="text-[13px] text-ink-3">No time was tracked this week.</p>}
              {stats.channels.map((row) => (
                <div key={row.name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[12.5px]">
                    <span>{row.name}</span>
                    <span className="tabular text-ink-3">{formatMinutes(msToMinutes(row.ms))}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-hover">
                    <div className="h-full rounded-full" style={{ width: `${(row.ms / stats.channels[0].ms) * 100}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Column>
        </>
      )}

      {step === 'summary' && (
        <SummaryStep prompt="Weekly review" help="A starting draft from the week’s numbers. Add what the numbers cannot say." value={value} onChange={setText} />
      )}
    </RitualFrame>
  );
}

