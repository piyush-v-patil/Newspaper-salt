import { Plus, X } from 'lucide-react';
import { createEvent, makeEventRepeat } from '@/data/commands/events';
import type { Repeat } from '@/data/types';
import { formatClock, shiftDay, weekdayOf, type Day } from '@/domain/dates';

/** A fixed, repeating part of the week, such as lunch or a stand-up. */
export interface Commitment {
  key: string;
  title: string;
  /** 0 for Sunday to 6 for Saturday. */
  days: number[];
  startMin: number;
  endMin: number;
}

// Monday first.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_FRI = [1, 2, 3, 4, 5];

const SUGGESTIONS: Omit<Commitment, 'key'>[] = [
  { title: 'Lunch', days: MON_FRI, startMin: 12 * 60, endMin: 13 * 60 },
  { title: 'Stand-up', days: MON_FRI, startMin: 9 * 60 + 30, endMin: 9 * 60 + 45 },
  { title: 'Gym', days: [1, 3, 5], startMin: 7 * 60, endMin: 8 * 60 },
  { title: 'School run', days: MON_FRI, startMin: 8 * 60, endMin: 8 * 60 + 30 },
];

const toTime = (min: number) => formatClock(min, '24h');
const fromTime = (value: string): number | null => {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

function ruleFor(days: number[]): Repeat {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return { kind: 'daily', interval: 1, weekdays: [] };
  if (set.join() === MON_FRI.join()) return { kind: 'weekdays', interval: 1, weekdays: [] };
  return { kind: 'weekly', interval: 1, weekdays: set };
}

export const isValidCommitment = (c: Commitment) => c.title.trim().length > 0 && c.days.length > 0 && c.endMin > c.startMin;

/** Turns each commitment into a repeating event, starting on its first day from `today`. */
export async function saveCommitments(list: Commitment[], today: Day): Promise<void> {
  for (const c of list.filter(isValidCommitment)) {
    let day = today;
    while (!c.days.includes(weekdayOf(day))) day = shiftDay(day, 1);
    const event = await createEvent({ title: c.title.trim(), day, startMin: c.startMin, endMin: c.endMin });
    await makeEventRepeat(event.id, ruleFor(c.days));
  }
}

const field = 'h-9 rounded-lg border border-line bg-surface px-2.5 text-[14px] outline-none transition-colors focus:border-accent';

function Row({ item, onChange, onRemove }: { item: Commitment; onChange: (next: Commitment) => void; onRemove: () => void }) {
  return (
    <li data-testid="commitment" className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <div className="flex items-center gap-2">
        <input
          value={item.title}
          aria-label="What"
          placeholder="e.g. Team meeting"
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          className={`${field} min-w-0 flex-1`}
        />
        <button type="button" aria-label={`Remove ${item.title || 'commitment'}`} onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-over">
          <X size={15} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={`Days for ${item.title || 'commitment'}`} className="flex gap-1">
          {WEEKDAYS.map((d) => {
            const on = item.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[d]}
                onClick={() => onChange({ ...item, days: on ? item.days.filter((x) => x !== d) : [...item.days, d] })}
                className={`h-8 w-8 rounded-full border text-[12.5px] ${on ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line text-ink-3 hover:bg-hover'}`}
              >
                {WEEKDAY_LETTERS[d]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <input type="time" aria-label="From" value={toTime(item.startMin)} onChange={(e) => onChange({ ...item, startMin: fromTime(e.target.value) ?? item.startMin })} className={field} />
          <span className="text-ink-3">–</span>
          <input type="time" aria-label="Until" value={toTime(item.endMin)} onChange={(e) => onChange({ ...item, endMin: fromTime(e.target.value) ?? item.endMin })} className={field} />
        </div>
      </div>
      {!isValidCommitment(item) && item.title.trim() && (
        <p className="text-[12.5px] text-over">{item.days.length === 0 ? 'Pick at least one day.' : 'The end has to come after the start.'}</p>
      )}
    </li>
  );
}

/** The setup screen's list of commitments, with one-tap suggestions. */
export function CommitmentsEditor({ items, onChange }: { items: Commitment[]; onChange: (next: Commitment[]) => void }) {
  const add = (c: Omit<Commitment, 'key'>) => onChange([...items, { ...c, key: crypto.randomUUID() }]);
  const unused = SUGGESTIONS.filter((s) => !items.some((i) => i.title === s.title));
  return (
    <div className="flex flex-col gap-3">
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => add(s)}
              className="flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[13px] text-ink-2 hover:bg-hover"
            >
              <Plus size={12} /> {s.title}
            </button>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <Row
              key={item.key}
              item={item}
              onChange={(next) => onChange(items.map((i) => (i.key === item.key ? next : i)))}
              onRemove={() => onChange(items.filter((i) => i.key !== item.key))}
            />
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => add({ title: '', days: MON_FRI, startMin: 10 * 60, endMin: 11 * 60 })}
        className="flex h-9 items-center gap-1.5 self-start rounded-lg px-2 text-[14px] text-ink-2 hover:bg-hover"
      >
        <Plus size={15} /> Add something else
      </button>
    </div>
  );
}
