import { Check } from 'lucide-react';
import { DARK_THEMES, LIGHT_THEMES, type Theme } from '@/app/themes';
import { updateSettings } from '@/data/commands/settings';
import { useSettings } from '@/data/ReferenceData';

/** A tiny picture of the theme: the canvas, a card on it, and the accent. */
function Swatch({ theme, selected, onPick }: { theme: Theme; selected: boolean; onPick: () => void }) {
  const c = theme.colors;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={theme.name}
      onClick={onPick}
      className="group flex flex-col items-center gap-1.5"
    >
      <span
        className={`relative flex h-[52px] w-[76px] overflow-hidden rounded-lg border transition-shadow ${
          selected ? 'border-accent ring-2 ring-accent/40' : 'border-line group-hover:border-line-strong'
        }`}
        style={{ background: c.canvas }}
      >
        <span className="h-full w-[18px] shrink-0" style={{ background: c.panel }} />
        <span className="flex flex-1 flex-col gap-1 p-1.5">
          <span className="flex flex-col gap-1 rounded px-1.5 py-1" style={{ background: c.surface, boxShadow: `0 0 0 1px ${c.line}` }}>
            <span className="h-[3px] w-6 rounded-full" style={{ background: c.ink }} />
            <span className="h-[3px] w-4 rounded-full" style={{ background: c['ink-3'] }} />
          </span>
          <span className="h-[6px] w-5 rounded-full" style={{ background: c.accent }} />
        </span>
        {selected && (
          <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-accent text-white">
            <Check size={9} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={`text-[12px] ${selected ? 'font-medium text-ink' : 'text-ink-2'}`}>{theme.name}</span>
    </button>
  );
}

function ThemeRow({ label, themes, value, onPick }: { label: string; themes: readonly Theme[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-line py-3.5 last:border-0">
      <p className="text-[14px] font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
        {themes.map((t) => (
          <Swatch key={t.id} theme={t} selected={t.id === value} onPick={() => onPick(t.id)} />
        ))}
      </div>
    </div>
  );
}

/** Separate colour themes for light and dark. Picking one also shows it. */
export function ThemePicker() {
  const settings = useSettings();
  const showing = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  return (
    <>
      <ThemeRow
        label="Light theme"
        themes={LIGHT_THEMES}
        value={settings.lightTheme}
        onPick={(lightTheme) => void updateSettings(showing() === 'light' ? { lightTheme } : { lightTheme, darkMode: 'off' })}
      />
      <ThemeRow
        label="Dark theme"
        themes={DARK_THEMES}
        value={settings.darkTheme}
        onPick={(darkTheme) => void updateSettings(showing() === 'dark' ? { darkTheme } : { darkTheme, darkMode: 'on' })}
      />
    </>
  );
}
