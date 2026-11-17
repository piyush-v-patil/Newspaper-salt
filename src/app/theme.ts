import { useEffect } from 'react';
import { updateSettings } from '@/data/commands/settings';
import { useSettings } from '@/data/ReferenceData';
import type { DarkMode } from '@/data/types';
import { darkTheme, lightTheme, themeVars } from './themes';

const STORAGE_KEY = 'pi-theme';

/** The chosen theme for each mode; kept here so Shift+L can switch without waiting for settings to reload. */
let chosen = { light: 'classic', dark: 'classic' };

function resolvesDark(mode: DarkMode): boolean {
  return mode === 'on' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
}

function remember(key: string, value: string): void {
  try {
    // Mirrored so index.html can paint the right colours before the app loads.
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable; the theme still applies for this session */
  }
}

function apply(mode: DarkMode): void {
  const dark = resolvesDark(mode);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  const vars = themeVars(dark ? darkTheme(chosen.dark) : lightTheme(chosen.light));
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  remember(STORAGE_KEY, mode);
  remember(`${STORAGE_KEY}-light`, JSON.stringify(themeVars(lightTheme(chosen.light))));
  remember(`${STORAGE_KEY}-dark`, JSON.stringify(themeVars(darkTheme(chosen.dark))));
}

/** Keeps the document theme in step with the appearance settings and the OS. */
export function useTheme(): void {
  const { darkMode, lightTheme: light, darkTheme: dark } = useSettings();
  useEffect(() => {
    chosen = { light, dark };
    apply(darkMode);
    if (darkMode !== 'system') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [darkMode, light, dark]);
}

export async function toggleDarkMode(): Promise<void> {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const next: DarkMode = isDark ? 'off' : 'on';
  // Saved first, so the visible change always means the choice is stored.
  await updateSettings({ darkMode: next });
  apply(next);
}
