import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Archive, CalendarDays, ListChecks, ListTodo, Search, Target, Trash2, type LucideIcon } from 'lucide-react';
import { CalendarPanel } from '@/features/calendar/CalendarPanel';
import { TasksPanel } from '@/features/calendar/TasksPanel';
import { BacklogPanel } from '@/features/lists/BacklogPanel';
import { ObjectivesPanel } from '@/features/week/ObjectivesPanel';
import { ArchivePanel, SearchPanel, TrashPanel } from '@/features/lists/panels';
import { useTasksInState } from '@/data/queries';
import { useLayout } from './useLayout';
import { useUi, type RightPanelKind } from './uiStore';

interface PanelDef {
  kind: RightPanelKind;
  label: string;
  icon: LucideIcon;
  hint?: string;
}

const panels: PanelDef[] = [
  { kind: 'calendar', label: 'Calendar', icon: CalendarDays, hint: 'Shift C' },
  { kind: 'objectives', label: 'Weekly objectives', icon: Target, hint: 'Shift R' },
  { kind: 'backlog', label: 'Backlog', icon: ListTodo, hint: 'Shift B' },
  { kind: 'archive', label: 'Archive', icon: Archive, hint: 'Shift A' },
  { kind: 'search', label: 'Search', icon: Search, hint: 'Ctrl F' },
  { kind: 'trash', label: 'Trash', icon: Trash2 },
];

function PanelBody({ kind, onCalendar }: { kind: RightPanelKind; onCalendar: boolean }) {
  switch (kind) {
    case 'calendar':
      return onCalendar ? <TasksPanel /> : <CalendarPanel />;
    case 'objectives':
      return <ObjectivesPanel />;
    case 'backlog':
      return <BacklogPanel />;
    case 'archive':
      return <ArchivePanel />;
    case 'trash':
      return <TrashPanel />;
    case 'search':
      return <SearchPanel />;
    default:
      return null;
  }
}

export function RightPanel() {
  const archivedCount = useTasksInState('archived').length;
  const { rightOpen, rightPanel, showRightPanel } = useUi();
  // In the Calendar view the calendar is already in the centre, so its slot holds the day's tasks.
  const onCalendar = useRouterState({ select: (s) => s.location.pathname === '/calendar' });
  const shown = panels.map((p) => (p.kind === 'calendar' && onCalendar ? { ...p, label: 'Tasks', icon: ListChecks, hint: 'Shift C' } : p));
  const active = shown.find((p) => p.kind === rightPanel) ?? shown[0];
  const { overlayPanel, phone } = useLayout();

  // On reaching a narrow window, the panel closes rather than cover the content.
  useEffect(() => {
    if (overlayPanel) useUi.setState({ rightOpen: false });
  }, [overlayPanel]);

  return (
    <div className="flex shrink-0">
      {overlayPanel && rightOpen && (
        <button type="button" aria-label="Close panel" onClick={() => useUi.setState({ rightOpen: false })} className="absolute inset-0 z-20 cursor-default bg-black/20" />
      )}
      <aside
        aria-label={active.label}
        aria-hidden={!rightOpen}
        className={`overflow-hidden border-line bg-canvas transition-[width] duration-200 ease-out-soft ${overlayPanel ? 'absolute inset-y-0 right-12 z-20 shadow-pop' : ''}`}
        style={{ width: rightOpen ? (phone ? 'calc(100vw - 48px)' : 300) : 0, borderLeftWidth: rightOpen ? 1 : 0 }}
      >
        {rightOpen && <PanelBody kind={active.kind} onCalendar={onCalendar} />}
      </aside>
      <div role="toolbar" aria-label="Side panels" className="flex w-12 flex-col items-center gap-1 border-l border-line py-3">
        {shown.map(({ kind, label, icon: Icon, hint }) => {
          const on = rightOpen && rightPanel === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-label={label}
              aria-pressed={on}
              title={hint ? `${label}  ${hint}` : label}
              onClick={() => showRightPanel(kind)}
              className={`relative grid h-8 w-8 place-items-center rounded-md transition-colors ${
                on ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-hover hover:text-ink'
              }`}
            >
              <Icon size={17} strokeWidth={1.75} />
              {kind === 'archive' && archivedCount > 0 && (
                <span className="tabular absolute -right-0.5 -top-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-over px-1 text-[9.5px] font-semibold text-white">
                  {archivedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
