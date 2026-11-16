import { normalizeChannelName } from '@/data/commands/channels';
import { BACKLOG, type Channel, type Context, type DailyPriority, type Id, type TaskDay } from '@/data/types';
import { formatMinutes, shiftDay, type Day } from '@/domain/dates';
import { nextWeekStart, shortDate, weekdayName } from '@/domain/dayLabels';
import { DURATION_PRESETS, durationLabel, parseDuration } from '@/domain/duration';

export interface Option<T> {
  key: string;
  label: string;
  value: T;
  /** Secondary text shown on the right. */
  hint?: string;
  /** A colour dot shown before the label. */
  swatch?: string;
}

export function timeOptions(query: string, current: number | null): Option<number | null>[] {
  const q = query.trim();
  const typed = parseDuration(q);
  const minutes = q ? (typed !== null ? [typed] : DURATION_PRESETS.filter((m) => durationLabel(m).includes(q.toLowerCase()))) : DURATION_PRESETS;
  const options: Option<number | null>[] = minutes.map((m) => ({
    key: String(m),
    label: durationLabel(m),
    value: m,
    hint: formatMinutes(m),
  }));
  if (!q && current !== null) options.push({ key: 'none', label: 'No estimate', value: null });
  return options;
}

export type ChannelChoice = { id: Id | null } | { create: string };

export function channelOptions(query: string, channels: Channel[], contexts: Context[], current: Id | null): Option<ChannelChoice>[] {
  const q = normalizeChannelName(query);
  const contextName = new Map(contexts.map((c) => [c.id, c.name]));
  const options: Option<ChannelChoice>[] = channels
    .filter((c) => c.name.includes(q))
    .map((c) => ({
      key: c.id,
      label: `#${c.name}`,
      value: { id: c.id },
      hint: c.contextId ? contextName.get(c.contextId) : undefined,
      swatch: c.color,
    }));
  if (q && !channels.some((c) => c.name === q)) options.push({ key: 'create', label: `Create #${q}`, value: { create: q } });
  if (!q && current !== null) options.push({ key: 'none', label: 'No channel', value: { id: null } });
  return options;
}

export function dateOptions(query: string, today: Day, weekStartsOn: 0 | 1): Option<TaskDay>[] {
  const options: Option<TaskDay>[] = [
    { key: 'today', label: 'Today', value: today, hint: shortDate(today) },
    { key: 'tomorrow', label: 'Tomorrow', value: shiftDay(today, 1), hint: shortDate(shiftDay(today, 1)) },
  ];
  for (let offset = 2; offset <= 6; offset++) {
    const day = shiftDay(today, offset);
    options.push({ key: day, label: weekdayName(day), value: day, hint: shortDate(day) });
  }
  const nextWeek = nextWeekStart(today, weekStartsOn);
  options.push({ key: 'next-week', label: 'Next week', value: nextWeek, hint: shortDate(nextWeek) });
  options.push({ key: BACKLOG, label: 'Backlog', value: BACKLOG, hint: 'No date' });
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
}

export const PRIORITY_LABELS: Record<DailyPriority, string> = {
  urgent: 'Urgent',
  priority: 'Priority',
  normal: 'Normal',
  low: 'Low priority',
};

const PRIORITY_ORDER: DailyPriority[] = ['urgent', 'priority', 'normal', 'low'];

export function priorityOptions(query: string): Option<DailyPriority>[] {
  const options = PRIORITY_ORDER.map((p, i) => ({ key: p, label: PRIORITY_LABELS[p], value: p, hint: String(i + 1) }));
  const q = query.trim().toLowerCase();
  if (!q) return options;
  // Typing a number picks that row.
  if (/^[1-4]$/.test(q)) return [options[Number(q) - 1]];
  return options.filter((o) => o.label.toLowerCase().startsWith(q));
}
