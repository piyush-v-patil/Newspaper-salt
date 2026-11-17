import { useRunningTimer } from '@/data/queries';
import { useTaskTime } from '@/features/focus/useTaskTime';
import { formatMinutes } from '@/domain/dates';
import { msToMinutes } from '@/domain/time';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Link, useNavigate, type LinkProps } from '@tanstack/react-router';
import { createFolder } from '@/data/commands/folders';
import { useBacklogFolders } from '@/data/queries';
import {
  Calendar,
  Check,
  CalendarRange,
  ChartColumn,
  ChevronDown,
  ChevronsLeft,
  House,
  Columns3,
  Crosshair,
  Layers,
  Menu as MenuIcon,
  Plus,
  Sparkles,
  Sunrise,
  Sunset,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useRitualStatus, useWeeklyStatus, type RitualState } from '@/features/rituals/ritualStatus';
import { Kbd } from '@/ui/Kbd';
import { useLayout } from './useLayout';
import { useUi } from './uiStore';

interface Item {
  to: LinkProps['to'];
  label: string;
  icon: LucideIcon;
  hint?: string;
}

const views: Item[] = [
  { to: '/today', label: 'Today', icon: House, hint: 'T' },
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

/** Beside Focus while a timer runs: that task's time so far. */
function FocusBadge() {
  const timer = useRunningTimer();
  const time = useTaskTime(timer?.taskId);
  if (!timer) return null;
  return (
    <span data-testid="focus-badge" className="tabular rounded bg-hover px-1.5 text-[11px] font-medium text-ink-2">
      {formatMinutes(msToMinutes(time.totalMs))}
    </span>
  );
}

function NavLink({ item, state = null }: { item: Item; state?: RitualState }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors hover:bg-hover hover:text-ink ${
        state === 'done' ? 'text-ink-3' : 'text-ink-2'
      }`}
      activeProps={{ className: 'bg-hover !text-ink font-medium' }}
    >
      <Icon size={16} strokeWidth={1.75} />
      <span className="flex-1 truncate">{item.label}</span>
      {state === 'due' && <span className="rounded bg-accent-soft px-1.5 text-[11px] font-medium text-accent">Start</span>}
      {state === 'done' && <Check size={14} className="text-ink-3" aria-label="Done" />}
      {item.to === '/focus' && <FocusBadge />}
      {item.hint && state === null && item.to !== '/focus' && (
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          <Kbd>{item.hint}</Kbd>
        </span>
      )}
    </Link>
  );
}

function Group({ title, items, states = {} }: { title?: string; items: Item[]; states?: Record<string, RitualState> }) {
  return (
    <div className="flex flex-col gap-0.5">
      {title && <div className="px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-ink-3">{title}</div>}
      {items.map((item) => (
        <NavLink key={item.to} item={item} state={states[item.to ?? ''] ?? null} />
      ))}
    </div>
  );
}

const menuItem = 'flex cursor-pointer items-center justify-between gap-6 rounded-md px-2 py-1.5 text-[13.5px] text-ink-2 outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink';

/** The app's name, opening a menu of things that are not views. */
function AppMenu() {
  const navigate = useNavigate();
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button type="button" className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[15px] font-semibold tracking-tight hover:bg-hover">
          Life Of Pi <ChevronDown size={14} className="text-ink-3" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className="z-50 min-w-[220px] rounded-lg border border-line bg-surface p-1 shadow-pop data-[state=open]:animate-pop">
          <Menu.Item className={menuItem} onSelect={() => void navigate({ to: '/settings' })}>
            Settings
          </Menu.Item>
          <Menu.Item className={menuItem} onSelect={() => useUi.setState({ paletteOpen: true })}>
            Command palette <Kbd>Ctrl K</Kbd>
          </Menu.Item>
          <Menu.Item className={menuItem} onSelect={() => useUi.setState({ shortcutsOpen: true })}>
            Keyboard shortcuts <Kbd>?</Kbd>
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item className={menuItem} onSelect={() => void navigate({ to: '/settings', search: { section: 'data' } })}>
            Back up your data
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Backlog folders under Backlog, and a quick way to add one. */
function BacklogFolders() {
  const folders = useBacklogFolders();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const navigate = useNavigate();

  async function add() {
    const name = draft;
    setDraft('');
    setAdding(false);
    if (name.trim()) {
      const folder = await createFolder(name);
      void navigate({ to: '/backlog', search: { folder: folder.id } });
    }
  }

  return (
    <div className="ml-[18px] flex flex-col gap-0.5 border-l border-line pl-2">
      {folders.map((folder) => (
        <Link
          key={folder.id}
          to="/backlog"
          search={{ folder: folder.id }}
          className="flex h-7 items-center rounded-md px-2 text-[13px] text-ink-2 hover:bg-hover hover:text-ink"
          activeOptions={{ includeSearch: true }}
          activeProps={{ className: 'bg-hover !text-ink' }}
        >
          <span className="truncate">{folder.name}</span>
        </Link>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void add()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
            if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
          placeholder="Folder name"
          aria-label="New folder name"
          className="h-7 rounded-md border border-accent bg-surface px-2 text-[13px] outline-none"
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-[13px] text-ink-3 hover:bg-hover hover:text-ink-2">
          <Plus size={13} /> Add folder
        </button>
      )}
    </div>
  );
}

function NavBody() {
  const toggleLeft = useUi((s) => s.toggleLeft);
  const status = useRitualStatus();
  const weeklyStatus = useWeeklyStatus();
  return (
    <nav aria-label="Main" className="flex h-full w-[224px] flex-col bg-panel px-2.5 py-3">
      <div className="flex items-center justify-between px-2 pb-3">
        <AppMenu />
        <button
          type="button"
          onClick={() => (useUi.getState().navDrawerOpen ? useUi.setState({ navDrawerOpen: false }) : toggleLeft())}
          aria-label="Hide navigation"
          title="Hide navigation  <"
          className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink"
        >
          <ChevronsLeft size={15} />
        </button>
      </div>
      <Group items={views} />
      <Group title="Daily rituals" items={daily} states={{ '/plan': status.plan, '/shutdown': status.shutdown }} />
      <Group title="Weekly rituals" items={weekly} states={{ '/weekly/plan': weeklyStatus.plan, '/weekly/review': weeklyStatus.review }} />
      <div className="mt-4 flex flex-col gap-0.5">
        {lists.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
        <BacklogFolders />
      </div>
    </nav>
  );
}

/**
 * Docked when open. When hidden, it slides back in while the cursor is at
 * the left edge of the window, or as a drawer from the menu button (the
 * way in on touch screens and narrow windows).
 */
export function LeftNav({ hidden = false }: { hidden?: boolean }) {
  const open = useUi((s) => s.leftOpen) && !hidden;
  const drawer = useUi((s) => s.navDrawerOpen);
  const [peek, setPeek] = useState(false);
  const shown = open || peek || drawer;
  const closeDrawer = () => useUi.setState({ navDrawerOpen: false });

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
        <>
          {drawer && <button type="button" aria-label="Close navigation" onClick={closeDrawer} className="absolute inset-0 z-30 cursor-default bg-black/20 data-[state=open]:animate-fade" />}
          <div
            className="absolute inset-y-0 left-0 z-30"
            onMouseEnter={() => setPeek(true)}
            onMouseLeave={() => setPeek(false)}
            // Following a link closes the drawer.
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('a')) return;
              closeDrawer();
              // The pointer is still over the panel; without this it would stay slid out.
              setPeek(false);
            }}
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
        </>
      )}
    </>
  );
}

/** Opens the navigation when it is not docked. Sits at the start of each page header. */
export function NavToggle() {
  const docked = useUi((s) => s.leftOpen);
  const { compactNav } = useLayout();
  if (docked && !compactNav) return null;
  return (
    <button
      type="button"
      aria-label="Open navigation"
      onClick={() => useUi.setState({ navDrawerOpen: true })}
      className="-ml-2 mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-hover"
    >
      <MenuIcon size={17} />
    </button>
  );
}
