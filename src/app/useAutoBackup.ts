import { useEffect } from 'react';
import { backupIfDue } from '@/data/autoBackup';
import { platform } from '@/platform';

const HOUR = 60 * 60 * 1000;

/** A backup at start-up if one is owed, then a check every hour while the app is open (or in the tray). */
export function useAutoBackup(): void {
  useEffect(() => {
    // Asks the browser not to clear this site's data when space runs low.
    if (platform.kind === 'web') void navigator.storage?.persist?.().catch(() => {});
    // Wait for start-up work (rollover and the like) to settle first.
    const first = setTimeout(() => void backupIfDue(), 15_000);
    const hourly = setInterval(() => void backupIfDue(), HOUR);
    return () => {
      clearTimeout(first);
      clearInterval(hourly);
    };
  }, []);
}
