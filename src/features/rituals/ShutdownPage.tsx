import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, ChevronUp, Star, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToday } from '@/app/useToday';
import { finishShutdown, reopenShutdown } from '@/data/commands/days';
import { useDayEntries, useDayRecord, useTasksById, useTasksForDay } from '@/data/queries';
import { useChannelMap, useSettings } from '@/data/ReferenceData';
import type { Id, Task } from '@/data/types';
import { now } from '@/domain/clock';
import { formatMinutes, longDayLabel, type Day } from '@/domain/dates';
import { actualByTask, msToMinutes } from '@/domain/time';
import { celebrate } from '@/ui/Celebration';
import { Column, Guidance, RitualFrame } from './RitualFrame';

export const MOODS = ['😫', '😕', '😐', '🙂', '😄'];

const CLOSING_LINES = [
  'That’s the day. Rest is part of the work.',
  'You showed up and did what you could. That is enough for today.',
  'Closed. Tomorrow’s list can wait until tomorrow.',
  'Good work. Let the evening be the evening.',
  'Done is done. Go do something that isn’t on a list.',
];

/** The day's highlights as plain text, for the clipboard. */
export function highlightsText(day: Day, items: { title: string; starred: boolean }[], mood: string | null, reflection: string): string {
  const out = [`Highlights for ${longDayLabel(day)}${mood ? ` ${mood}` : ''}`, '', ...items.map((t) => `- ${t.starred ? '★ ' : ''}${t.title}`)];
  if (reflection.trim()) out.push('', reflection.trim());
  return out.join('\n');
}

function TaskLine({ task, minutes, faded = false }: { task: Task; minutes: number; faded?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 rounded-lg border border-line px-3 py-2 text-[13.5px] ${faded ? 'text-ink-2' : ''}`}>
      <span className={`min-w-0 flex-1 truncate ${task.completedAt !== null ? '' : 'text-ink-2'}`}>{task.title}</span>
      {task.counter && (
        <span className="tabular shrink-0 text-[12px] text-ink-2" title={task.counter.unit || 'Counter'}>
          {task.counter.count}
          {task.counter.target !== null && `/${task.counter.target}`} {task.counter.unit}
        </span>
      )}
      <span className="tabular shrink-0 text-[12px] text-ink-3">
        {minutes > 0 ? formatMinutes(minutes) : '–:––'}
        {task.plannedMin !== null && ` / ${formatMinutes(task.plannedMin)}`}
      </span>
    </div>
  );
}

/** Daily shutdown: look at what happened, pick the highlights, write a line about the day, close it. */
export function ShutdownPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const channels = useChannelMap();
  const day = useToday();
  const record = useDayRecord(day);
  const onDay = useTasksForDay(day);
  const entries = useDayEntries(day);

  // Work counts for the day it was done on, even if the task has since moved to another day.
  const entryTaskIds = useMemo(() => [...new Set(entries.map((e) => e.taskId))].sort(), [entries]);
  const tracked = useTasksById(entryTaskIds);
  const msByTask = useMemo(() => {
    const map = new Map<Id, number>();
    for (const [id, actual] of actualByTask(entries, now())) map.set(id, actual.totalMs);
    return map;
  }, [entries]);
  const minutesFor = (id: Id) => msToMinutes(msByTask.get(id) ?? 0);

  const { worked, missed } = useMemo(() => {
    const all = new Map<Id, Task>();
    for (const t of onDay ?? []) if (t.kind === 'task') all.set(t.id, t);
    for (const t of tracked.values()) if (t.kind === 'task' && t.state === 'active') all.set(t.id, t);
    const list = [...all.values()];
    const didWork = (t: Task) => t.completedDay === day || (msByTask.get(t.id) ?? 0) > 0;
    return { worked: list.filter(didWork), missed: list.filter((t) => !didWork(t) && t.completedAt === null) };
  }, [onDay, tracked, msByTask, day]);

  const totalMin = msToMinutes([...msByTask.values()].reduce((a, b) => a + b, 0));
  const byChannel = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; ms: number }>();
    for (const task of worked) {
      const channel = task.channelId ? channels.get(task.channelId) : undefined;
      const key = channel?.id ?? 'none';
      const row = totals.get(key) ?? { name: channel ? `#${channel.name}` : 'No channel', color: channel?.color ?? 'var(--ink-3)', ms: 0 };
      row.ms += msByTask.get(task.id) ?? 0;
      totals.set(key, row);
    }
    return [...totals.values()].filter((r) => r.ms > 0).sort((a, b) => b.ms - a.ms);
  }, [worked, channels, msByTask]);

  const [index, setIndex] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<Id[]>([]);
  const [starred, setStarred] = useState<Id[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [copied, setCopied] = useState(false);

  const loaded = record !== undefined && onDay !== undefined;
  useEffect(() => {
    if (!loaded || index !== null) return;
    const done = record.shutdownStatus === 'done';
    // First time through, every finished task starts as a highlight; trim from there.
    setHighlights(record.highlights.length || done ? record.highlights : worked.filter((t) => t.completedDay === day).map((t) => t.id));
    setStarred(record.starred ?? []);
    setMood(record.mood);
    setReflection(record.reflection);
    setIndex(done ? 2 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, index]);

  if (!loaded || index === null) return null;

  const byId = new Map(worked.map((t) => [t.id, t]));
  // Starred highlights come first; otherwise the order is the one chosen.
  const ordered = [...highlights.filter((id) => starred.includes(id)), ...highlights.filter((id) => !starred.includes(id))];
  const picked = ordered.flatMap((id) => byId.get(id) ?? []);
  const others = worked.filter((t) => !highlights.includes(t.id));
  const text = highlightsText(day, picked.map((t) => ({ title: t.title, starred: starred.includes(t.id) })), mood, reflection);
  const move = (id: Id, by: -1 | 1) =>
    setHighlights(() => {
      const list = [...ordered];
      const i = list.indexOf(id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });
  const home = () => void navigate({ to: settings.defaultView === 'board' ? '/board' : settings.defaultView === 'calendar' ? '/calendar' : '/today' });

  const finish = async () => {
    await finishShutdown(day, { highlights: picked.map((t) => t.id), starred: starred.filter((id) => highlights.includes(id)), mood, reflection });
    if (settings.celebrations) celebrate();
    setIndex(2);
  };

  const closing =
    settings.endOfDayMessage.kind === 'custom'
      ? settings.endOfDayMessage.text
      : settings.endOfDayMessage.kind === 'none'
        ? ''
        : CLOSING_LINES[Number(day.slice(-2)) % CLOSING_LINES.length];

  return (
    <RitualFrame
      name="Daily shutdown"
      detail={longDayLabel(day)}
      steps={3}
      step={index}
      onBack={index === 1 ? () => setIndex(0) : undefined}
      onNext={index === 0 ? () => setIndex(1) : index === 1 ? () => void finish() : home}
      nextLabel={index === 1 ? 'Done for the day' : index === 2 ? 'Close' : 'Next'}
      onExit={() => void navigate({ to: '/today' })}
    >
      {index === 0 && (
        <>
          <Guidance prompt="Today in review">
            <p>Here is what the day actually held.</p>
            <p className="tabular text-[26px] font-semibold tracking-tight text-ink">{formatMinutes(totalMin)}</p>
            <p>tracked across {worked.length} {worked.length === 1 ? 'task' : 'tasks'}.</p>
            <p>Unfinished tasks are not moved now. They carry over to tomorrow at midnight.</p>
          </Guidance>
          <Column title="Worked on" hint={`${worked.length}`} width={380}>
            {worked.length === 0 && <p className="text-[13px] text-ink-3">Nothing finished or timed today.</p>}
            {worked.map((t) => (
              <TaskLine key={t.id} task={t} minutes={minutesFor(t.id)} />
            ))}
          </Column>
          <Column title="Didn’t get to" hint={`${missed.length}`} width={340}>
            {missed.length === 0 && <p className="text-[13px] text-ink-3">Nothing left untouched.</p>}
            {missed.map((t) => (
              <TaskLine key={t.id} task={t} minutes={0} faded />
            ))}
          </Column>
        </>
      )}

      {index === 1 && (
        <>
          <Guidance prompt="What were the highlights?">
            <p>Keep the few things worth remembering about today. Remove the rest.</p>
            {byChannel.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                <span className="text-[12px] font-medium uppercase tracking-wider text-ink-3">Time spent</span>
                {byChannel.map((row) => (
                  <div key={row.name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[12.5px]">
                      <span>{row.name}</span>
                      <span className="tabular text-ink-3">{formatMinutes(msToMinutes(row.ms))}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-hover">
                      <div className="h-full rounded-full" style={{ width: `${(row.ms / byChannel[0].ms) * 100}%`, background: row.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Guidance>
          <Column title="Highlights" hint={`${picked.length}`} width={400}>
            {picked.length === 0 && <p className="text-[13px] text-ink-3">No highlights picked. A quiet day is allowed.</p>}
            {picked.map((t, i) => {
              const star = starred.includes(t.id);
              return (
              <div key={t.id} data-testid="highlight" className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px] ${star ? 'border-warn/50 bg-warn/5' : 'border-line'}`}>
                <button
                  type="button"
                  aria-pressed={star}
                  aria-label={star ? `Unstar ${t.title}` : `Star ${t.title}`}
                  onClick={() => setStarred((ids) => (star ? ids.filter((id) => id !== t.id) : [...ids, t.id]))}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded ${star ? 'text-warn' : 'text-ink-3 hover:text-warn'}`}
                >
                  <Star size={14} fill={star ? 'currentColor' : 'none'} />
                </button>
                <span className={`min-w-0 flex-1 truncate ${star ? 'font-medium' : ''}`}>{t.title}</span>
                <span className="flex opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" aria-label={`Move ${t.title} up`} disabled={i === 0} onClick={() => move(t.id, -1)} className="grid h-5 w-5 place-items-center rounded text-ink-3 hover:text-ink disabled:opacity-30">
                    <ChevronUp size={13} />
                  </button>
                  <button type="button" aria-label={`Move ${t.title} down`} disabled={i === picked.length - 1} onClick={() => move(t.id, 1)} className="grid h-5 w-5 place-items-center rounded text-ink-3 hover:text-ink disabled:opacity-30">
                    <ChevronDown size={13} />
                  </button>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${t.title} from highlights`}
                  onClick={() => setHighlights((ids) => ids.filter((id) => id !== t.id))}
                  className="grid h-5 w-5 place-items-center rounded text-ink-3 opacity-0 hover:text-over focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              </div>
              );
            })}
            {others.length > 0 && (
              <>
                <h3 className="pt-3 text-[12px] font-medium uppercase tracking-wider text-ink-3">Other activity</h3>
                {others.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[13.5px] text-ink-2">
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <button type="button" onClick={() => setHighlights((ids) => [...ids, t.id])} className="rounded px-1.5 py-0.5 text-[12px] text-accent hover:bg-accent-soft">
                      Include
                    </button>
                  </div>
                ))}
              </>
            )}
          </Column>
          <Column title="Reflection" width={360}>
            <div role="radiogroup" aria-label="How was the day?" className="flex gap-1">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mood === m}
                  aria-label={`Mood ${m}`}
                  onClick={() => setMood(mood === m ? null : m)}
                  className={`grid h-9 w-9 place-items-center rounded-lg text-[19px] transition-colors ${mood === m ? 'bg-accent-soft' : 'hover:bg-hover'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={7}
              aria-label="Reflection"
              placeholder="Today was…"
              className="resize-none rounded-md border border-line bg-surface px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-accent"
            />
          </Column>
        </>
      )}

      {index === 2 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-[26px] font-semibold tracking-tight">Shutdown complete</h1>
            {closing && <p className="max-w-md text-[15px] text-ink-2">{closing}</p>}
          </div>
          <div className="flex gap-2">
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
              {copied ? 'Copied' : 'Copy highlights'}
            </button>
            <button
              type="button"
              onClick={() => {
                void reopenShutdown(day);
                setIndex(1);
              }}
              className="h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </RitualFrame>
  );
}
