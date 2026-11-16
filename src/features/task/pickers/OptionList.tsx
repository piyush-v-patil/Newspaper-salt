import { useEffect, useState, type KeyboardEvent } from 'react';
import type { Option } from './options';

/** Arrow-key navigation over a list of options. Spread `onKeyDown` on the input that drives it. */
export function useOptionNav<T>(options: Option<T>[], onSelect: (value: T) => void) {
  const [active, setActive] = useState(0);
  const keys = options.map((o) => o.key).join('|');

  useEffect(() => setActive(0), [keys]);

  /** Returns true if the key was used. */
  function handleKey(e: KeyboardEvent): boolean {
    if (options.length === 0) return false;
    if (e.key === 'ArrowDown') setActive((i) => (i + 1) % options.length);
    else if (e.key === 'ArrowUp') setActive((i) => (i - 1 + options.length) % options.length);
    else if (e.key === 'Enter' || e.key === 'Tab') onSelect(options[Math.min(active, options.length - 1)].value);
    else return false;
    e.preventDefault();
    return true;
  }

  return { active, setActive, handleKey };
}

interface Props<T> {
  options: Option<T>[];
  active: number;
  onHover: (index: number) => void;
  onSelect: (value: T) => void;
  emptyText?: string;
}

export function OptionList<T>({ options, active, onHover, onSelect, emptyText = 'No matches' }: Props<T>) {
  if (options.length === 0) return <p className="px-2.5 py-2 text-[13px] text-ink-3">{emptyText}</p>;
  return (
    <ul role="listbox" className="max-h-[264px] overflow-y-auto p-1">
      {options.map((option, i) => (
        <li
          key={option.key}
          role="option"
          aria-selected={i === active}
          onMouseMove={() => i !== active && onHover(i)}
          // mousedown, not click, so the input keeps focus
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(option.value);
          }}
          className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] ${
            i === active ? 'bg-hover text-ink' : 'text-ink-2'
          }`}
        >
          {option.swatch && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: option.swatch }} />}
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          {option.hint && <span className="tabular shrink-0 text-[12px] text-ink-3">{option.hint}</span>}
        </li>
      ))}
    </ul>
  );
}
