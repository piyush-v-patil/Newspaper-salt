import type { ReactNode } from 'react';
import { formatClock } from '@/domain/dates';

/** One setting: what it is and what it does on the left, the control on the right. */
export function Row({ label, description, htmlFor, children }: { label: string; description?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-3.5 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-[14px] font-medium">
          {label}
        </label>
        {description && <p className="text-[12.5px] leading-relaxed text-ink-3">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      {title && <h3 className="pb-1 pt-6 text-[12px] font-medium uppercase tracking-wider text-ink-3 first:pt-0">{title}</h3>}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export function Toggle({ id, checked, onChange, label }: { id?: string; checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-line-strong'}`}
    >
      <span
        className={`absolute left-0 top-[3px] h-4 w-4 rounded-full bg-white shadow-card transition-transform duration-200 ease-out-soft ${checked ? 'translate-x-[19px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}

export function Select<T extends string | number>({
  id,
  value,
  options,
  onChange,
  label,
}: {
  id?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value);
        if (picked) onChange(picked.value);
      }}
      className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-ink"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** A time of day as minutes after midnight. */
export function TimeInput({ id, value, onChange, label }: { id?: string; value: number; onChange: (min: number) => void; label: string }) {
  return (
    <input
      id={id}
      type="time"
      aria-label={label}
      value={formatClock(value, '24h')}
      onChange={(e) => {
        const [h, m] = e.target.value.split(':').map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) onChange(h * 60 + m);
      }}
      className="h-8 rounded-md border border-line bg-surface px-2 text-[13px]"
    />
  );
}

export function NumberInput({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  suffix,
}: {
  id?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  label: string;
  suffix?: string;
}) {
  return (
    <>
      <input
        id={id}
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next) && e.target.value !== '') onChange(Math.max(min, Math.min(max, next)));
        }}
        className="h-8 w-[72px] rounded-md border border-line bg-surface px-2 text-[13px]"
      />
      {suffix && <span className="text-[13px] text-ink-2">{suffix}</span>}
    </>
  );
}
