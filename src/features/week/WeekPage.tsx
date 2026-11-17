import { useNavigate } from '@tanstack/react-router';
import { NavToggle } from '@/app/LeftNav';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useToday } from '@/app/useToday';
import { workingWindow } from '@/data/commands/sessions';
import { useObjectives, useObjectiveTasks, useSchedule } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import { nowMinutes } from '@/domain/clock';
import { formatMinutes, shiftDay, type Day } from '@/domain/dates';
import { weekDays, weekLabel, weekStartOf } from '@/domain/weeks';
import { useObjectiveTime, WeekObjectives } from './WeekObjectives';

const card = 'flex flex-col gap-2 rounded-xl border border-line p-4';
const figure = 'tabular text-[22px] font-semibold tracking-tight';

/** How much planned work is left on the week's objectives, against the working time still free. */
function WhatRemains({ weekStart }: { weekStart: Day }) {
  const settings = useSettings();
  const current = useToday();
  const objectives = useObjectives(weekStart);
  const ids = useMemo(() => objectives.map((o) => o.id), [objectives]);
  const tasks = useObjectiveTasks(ids);
  const days = useMemo(() => weekDays(weekStart).filter((d) => d >= current), [weekStart, current]);
  const schedule = useSchedule(days);

  const plannedLeft = objectives.reduce(
    (sum, o) => sum + (tasks.get(o.id) ?? []).filter((t) => t.completedAt === null).reduce((s, t) => s + (t.plannedMin ?? 0), 0),
    0,
  );
  const free = days.reduce((sum, day) => {
    const hours = workingWindow(settings, day);
    const from = day === current ? Math.max(hours.startMin, nowMinutes()) : hours.startMin;
    const busy = (schedule?.events ?? [])
      .filter((e) => e.day === day && e.blocksTime)
      .reduce((s, e) => s + Math.max(0, Math.min(e.endMin, hours.endMin) - Math.max(e.startMin, from)), 0);
    return sum + Math.max(0, hours.endMin - from - busy);
  }, 0);
  const nothingPlanned = objectives.filter((o) => o.completedAt === null && !(tasks.get(o.id) ?? []).some((t) => t.completedAt === null));
  const fits = plannedLeft <= free;

  return (
    <section aria-label="What remains this week" className={card}>
      <h2 className="text-[12px] font-medium uppercase tracking-wider text-ink-3">What remains</h2>
      <p className={`${figure} ${fits ? '' : 'text-over'}`}>{formatMinutes(plannedLeft)}</p>
      <p className="text-[12.5px] text-ink-2">
        planned on objectives, with {formatMinutes(free)} of working time still free{fits ? '.' : '. That will not fit.'}
      </p>
      {nothingPlanned.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t border-line pt-2.5">
          <span className="text-[12px] text-ink-3">Nothing planned</span>
          {nothingPlanned.map((o) => (
            <span key={o.id} className="truncate text-[13px]">
              {o.title}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Progress({ weekStart }: { weekStart: Day }) {
  const objectives = useObjectives(weekStart);
  const ids = useMemo(() => objectives.map((o) => o.id), [objectives]);
  const tasks = useObjectiveTasks(ids);
  const time = useObjectiveTime(weekStart, tasks);
  const done = objectives.filter((o) => o.completedAt !== null).length;
  const share = time.total > 0 ? Math.round((time.onObjectives / time.total) * 100) : 0;

  return (
    <section aria-label="Progress this week" className={card}>
      <h2 className="text-[12px] font-medium uppercase tracking-wider text-ink-3">Progress</h2>
      <p className={figure}>{formatMinutes(time.onObjectives)}</p>
      <p className="text-[12.5px] text-ink-2">
        spent on objectives{time.total > 0 ? `, ${share}% of the ${formatMinutes(time.total)} tracked this week.` : '.'}
      </p>
      {objectives.length > 0 && (
        <>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hover">
            <div className="h-full rounded-full bg-done transition-[width] duration-300" style={{ width: `${(done / objectives.length) * 100}%` }} />
          </div>
          <p className="tabular text-[12px] text-ink-3">
            {done} of {objectives.length} objectives complete
          </p>
        </>
      )}
    </section>
  );
}

/** This week: the objectives, the tasks behind them, and whether the week has room for it all. */
export function WeekPage({ start }: { start?: Day }) {
  const navigate = useNavigate();
  const { weekStartsOn } = useSettings();
  const current = useToday();
  const thisWeek = weekStartOf(current, weekStartsOn);
  const weekStart = start ? weekStartOf(start, weekStartsOn) : thisWeek;
  const go = (next: Day) => void navigate({ to: '/week', search: next === thisWeek ? {} : { start: next } });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'a') {
        // On This week, A adds an objective rather than a task.
        e.preventDefault();
        e.stopImmediatePropagation();
        document.getElementById('add-objective')?.focus();
      }
    }
    // Capture, so this runs before the app-wide "add task" shortcut.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-6">
        <NavToggle />
        <div className="flex items-center">
          <button type="button" aria-label="Previous week" onClick={() => go(shiftDay(weekStart, -7))} className="grid h-7 w-7 place-items-center rounded text-ink-2 hover:bg-hover">
            <ChevronLeft size={16} />
          </button>
          <button type="button" aria-label="Next week" onClick={() => go(shiftDay(weekStart, 7))} className="grid h-7 w-7 place-items-center rounded text-ink-2 hover:bg-hover">
            <ChevronRight size={16} />
          </button>
        </div>
        <h1 className="text-[16px] font-semibold tracking-tight">{weekStart === thisWeek ? 'This week' : 'Week of'}</h1>
        <span className="text-[13px] text-ink-3">{weekLabel(weekStart)}</span>
        {weekStart !== thisWeek && (
          <button type="button" onClick={() => go(thisWeek)} className="ml-2 h-7 rounded-md border border-line px-2.5 text-[12.5px] text-ink-2 hover:bg-hover">
            Back to this week
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-start gap-6 px-6 py-6">
          <div className="min-w-[320px] flex-[2]">
            <WeekObjectives weekStart={weekStart} />
          </div>
          <div className="flex min-w-[240px] flex-1 flex-col gap-4">
            <WhatRemains weekStart={weekStart} />
            <Progress weekStart={weekStart} />
          </div>
        </div>
      </div>
    </div>
  );
}
