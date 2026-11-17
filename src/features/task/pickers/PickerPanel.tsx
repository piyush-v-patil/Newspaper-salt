import { useState } from 'react';
import { OptionList, useOptionNav } from './OptionList';
import type { Option } from './options';

interface Props<T> {
  label: string;
  placeholder: string;
  getOptions: (query: string) => Option<T>[];
  onSelect: (value: T) => void;
  emptyText?: string;
}

/** A search field over a list of options. Every task picker is one of these. */
export function PickerPanel<T>({ label, placeholder, getOptions, onSelect, emptyText }: Props<T>) {
  const [query, setQuery] = useState('');
  const options = getOptions(query);
  const nav = useOptionNav(options, onSelect);

  return (
    <div className="w-[232px]">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => nav.handleKey(e)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className="w-full border-b border-line bg-transparent px-3 py-2 text-[13.5px] outline-none placeholder:text-ink-3"
      />
      <OptionList options={options} active={nav.active} onHover={nav.setActive} onSelect={onSelect} emptyText={emptyText} />
    </div>
  );
}
