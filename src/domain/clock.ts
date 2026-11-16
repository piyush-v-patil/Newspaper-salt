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
