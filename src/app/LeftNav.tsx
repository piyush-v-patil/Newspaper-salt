import { Link, type LinkProps } from '@tanstack/react-router';
import {
  Calendar,
  CalendarRange,
  ChartColumn,
  ChevronsLeft,
  Columns3,
  Crosshair,
  Layers,
  Settings,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Kbd } from '@/ui/Kbd';
import { useUi } from './uiStore';

interface Item {
  to: LinkProps['to'];
  label: string;
  icon: LucideIcon;
  hint?: string;
}

const views: Item[] = [
  { to: '/today', label: 'Today', icon: Sun, hint: 'T' },
  { to: '/week', label: 'This week', icon: Target, hint: 'N' },
  { to: '/board', label: 'Board', icon: Columns3, hint: 'H' },
  { to: '/calendar', label: 'Calendar', icon: Calendar, hint: 'J' },
  { to: '/focus', label: 'Focus', icon: Crosshair, hint: 'F' },
];
const daily: Item[] = [
  { to: '/plan', label: 'Plan', icon: Sunrise, hint: 'P' },
  { to: '/shutdown', label: 'Shutdown', icon: Sunset, hint: 'O' },
  { to: '/highlights', label: 'Highlights', icon: Sparkles },
];
const weekly: Item[] = [
  { to: '/weekly/plan', label: 'Plan', icon: CalendarRange },
  { to: '/weekly/review', label: 'Review', icon: ChartColumn },
];
const lists: Item[] = [{ to: '/backlog', label: 'Backlog', icon: Layers, hint: 'B' }];

function NavLink({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
      activeProps={{ className: 'bg-hover !text-ink font-medium' }}
    >
      <Icon size={16} strokeWidth={1.75} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.hint && (
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          <Kbd>{item.hint}</Kbd>
        </span>
      )}
    </Link>
  );
}

function Group({ title, items }: { title?: string; items: Item[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {title && <div className="px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-ink-3">{title}</div>}
      {items.map((item) => (
        <NavLink key={item.to} item={item} />
      ))}
    </div>
  );
}

function NavBody() {
  const toggleLeft = useUi((s) => s.toggleLeft);
  return (
    <nav aria-label="Main" className="flex h-full w-[224px] flex-col bg-panel px-2.5 py-3">
      <div className="flex items-center justify-between px-2 pb-3">
        <span className="text-[15px] font-semibold tracking-tight">Life Of Pi</span>
        <button
          type="button"
          onClick={toggleLeft}
          aria-label="Hide navigation"
          title="Hide navigation  <"
          className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink"
        >
          <ChevronsLeft size={15} />
        </button>
      </div>
      <Group items={views} />
      <Group title="Daily rituals" items={daily} />
      <Group title="Weekly rituals" items={weekly} />
      <Group title="Lists" items={lists} />
      <div className="mt-auto">
        <NavLink item={{ to: '/settings', label: 'Settings', icon: Settings }} />
      </div>
    </nav>
  );
}

/**
 * Docked when open. When hidden, it slides back in while the cursor is at
 * the left edge of the window.
 */
export function LeftNav() {
  const open = useUi((s) => s.leftOpen);
  const [peek, setPeek] = useState(false);
  const shown = open || peek;

  return (
    <>
      <div
        className="shrink-0 overflow-hidden border-line transition-[width] duration-200 ease-out-soft"
        style={{ width: open ? 224 : 0, borderRightWidth: open ? 1 : 0 }}
        aria-hidden={!open}
      >
        {open && <NavBody />}
      </div>
      {!open && (
        <div
          className="absolute inset-y-0 left-0 z-30"
          onMouseEnter={() => setPeek(true)}
          onMouseLeave={() => setPeek(false)}
          data-testid="nav-peek"
        >
          <div className="h-full w-2" />
          <div
            inert={!shown}
            className={`absolute inset-y-0 left-0 border-r border-line shadow-pop transition-[transform,visibility] duration-200 ease-out-soft ${
              shown ? 'visible translate-x-0' : 'invisible -translate-x-full'
            }`}
          >
            <NavBody />
          </div>
        </div>
      )}
    </>
  );
}
