import { useEffect } from 'react';
import { outbox, startSync, syncNow, useSyncStatus } from './controller';

const EVERY = 30_000;
const AFTER_CHANGE = 2_000;

/** Keeps this device in step with the account: on start, every half minute, on focus, back online, and shortly after any change. */
export function useSync(): void {
  const signedIn = useSyncStatus((s) => s.user !== null);
  useEffect(() => startSync(), []);
  useEffect(() => {
    if (!signedIn) return;
    let soon: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(soon);
      soon = setTimeout(() => void syncNow(), AFTER_CHANGE);
    };
    const now = () => void syncNow();
    const timer = setInterval(now, EVERY);
    const stop = outbox.onChange(later);
    window.addEventListener('focus', now);
    window.addEventListener('online', now);
    return () => {
      clearTimeout(soon);
      clearInterval(timer);
      stop();
      window.removeEventListener('focus', now);
      window.removeEventListener('online', now);
    };
  }, [signedIn]);
}
