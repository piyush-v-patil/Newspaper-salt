import { useEffect } from 'react';
import { updateSettings } from '@/data/commands/settings';
import { useSettings } from '@/data/queries';
import type { DarkMode } from '@/data/types';

const STORAGE_KEY = 'pi-theme';

function resolvesDark(mode: DarkMode): boolean {
  return mode === 'on' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
}

function apply(mode: DarkMode): void {
  document.documentElement.dataset.theme = resolvesDark(mode) ? 'dark' : 'light';
  try {
    // Mirrored so index.html can set the theme before the app loads.
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable; the theme still applies for this session */
  }
}

/** Keeps the document theme in step with the dark-mode setting and the OS. */
export function useTheme(): void {
  const darkMode = useSettings()?.darkMode;
  useEffect(() => {
    // Until settings have loaded, keep the theme index.html already applied.
    if (!darkMode) return;
    apply(darkMode);
    if (darkMode !== 'system') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [darkMode]);
}

export async function toggleDarkMode(): Promise<void> {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const next: DarkMode = isDark ? 'off' : 'on';
  // Saved first, so the visible change always means the choice is stored.
  await updateSettings({ darkMode: next });
  apply(next);
}
