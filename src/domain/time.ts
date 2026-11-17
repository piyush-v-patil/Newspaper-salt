import type { TimeEntry } from '@/data/types';
import { toDay, type Day } from './dates';

const MINUTE = 60_000;

/** How long an entry has run, counting up to `nowMs` if it is still running. */
export function entryMs(entry: Pick<TimeEntry, 'start' | 'end'>, nowMs: number): number {
  return Math.max(0, (entry.end ?? nowMs) - entry.start);
}

/** An entry belongs to the day it started on. */
export function entryDay(entry: Pick<TimeEntry, 'start'>): Day {
  return toDay(new Date(entry.start));
}

export interface ActualTime {
  totalMs: number;
  byDay: Map<Day, number>;
}

/** Tracked time per task, in total and per day. Running entries count up to `nowMs`. */
export function actualByTask(entries: TimeEntry[], nowMs: number): Map<string, ActualTime> {
  const result = new Map<string, ActualTime>();
  for (const entry of entries) {
    const ms = entryMs(entry, nowMs);
    let actual = result.get(entry.taskId);
    if (!actual) result.set(entry.taskId, (actual = { totalMs: 0, byDay: new Map() }));
    actual.totalMs += ms;
    const day = entryDay(entry);
    actual.byDay.set(day, (actual.byDay.get(day) ?? 0) + ms);
  }
  return result;
}

/** Whole minutes, rounded down: a timer shows 0:01 only after a full minute. */
export const msToMinutes = (ms: number) => Math.floor(ms / MINUTE);

/** A running clock: "42:18" under an hour, "1:02:18" from an hour on. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Always hours, minutes and seconds: "0:02:03". */
export function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
