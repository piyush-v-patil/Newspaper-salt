import { useEffect, useState } from 'react';
import { now } from '@/domain/clock';

/** The current time, re-read every `intervalMs` while `active`. For anything that ticks on screen. */
export function useNow(intervalMs: number, active = true): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => tick((n) => n + 1), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);
  return now();
}
