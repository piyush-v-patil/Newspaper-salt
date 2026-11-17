import { useEffect } from 'react';
import { create } from 'zustand';
import { runRollover } from '@/data/commands/rollover';
import { today } from '@/domain/clock';
import type { Day } from '@/domain/dates';

const useTodayStore = create<{ day: Day }>(() => ({ day: today() }));

/** Today's date, kept current: views re-render when midnight passes. */
export function useToday(): Day {
  return useTodayStore((s) => s.day);
}

const CHECK_MS = 20_000;

/**
 * Runs the start-of-day housekeeping when the app opens, and again whenever
 * the date changes while it is open. Mounted once, in the shell.
 */
export function useDayChange(): void {
  useEffect(() => {
    let last: Day | null = null;
    const check = () => {
      const day = today();
      if (day === last) return;
      last = day;
      useTodayStore.setState({ day });
      void runRollover();
    };
    check();
    const timer = setInterval(check, CHECK_MS);
    // A laptop waking from sleep should not wait for the next tick.
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
}
