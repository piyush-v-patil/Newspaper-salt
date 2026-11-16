import { toDay } from './dates';

/**
 * The app never calls Date.now() directly. Rollover, ritual timing and
 * scheduling all read the clock from here so tests can move time.
 */
let source: () => number = () => Date.now();

export function now(): number {
  return source();
}

export function setClock(fn: () => number): void {
  source = fn;
}

export function resetClock(): void {
  source = () => Date.now();
}

/** Today's local date as YYYY-MM-DD. */
export function today(): string {
  return toDay(new Date(now()));
}

/** The current local time of day, in minutes after midnight. */
export function nowMinutes(): number {
  const d = new Date(now());
  return d.getHours() * 60 + d.getMinutes();
}
