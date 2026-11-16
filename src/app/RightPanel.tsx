import { Archive, CalendarDays, ListTodo, Search, Target, Trash2, type LucideIcon } from 'lucide-react';
import { useUi, type RightPanelKind } from './uiStore';

const panels: { kind: RightPanelKind; label: string; icon: LucideIcon; hint?: string; body: string }[] = [
  { kind: 'calendar', label: 'Calendar', icon: CalendarDays, hint: 'Shift C', body: 'Your day on a timeline. Drag tasks here to timebox them.' },
  { kind: 'objectives', label: 'Weekly objectives', icon: Target, hint: 'Shift R', body: 'This week’s objectives and the time planned for each.' },
  { kind: 'backlog', label: 'Backlog', icon: ListTodo, hint: 'Shift B', body: 'Tasks without a day. Drag one onto a day to schedule it.' },
  { kind: 'archive', label: 'Archive', icon: Archive, hint: 'Shift A', body: 'Tasks that rolled over too many days in a row land here.' },
  { kind: 'search', label: 'Search', icon: Search, hint: 'Ctrl F', body: 'Find any task by name.' },
  { kind: 'trash', label: 'Trash', icon: Trash2, body: 'Deleted tasks stay here for a week.' },
];

export function RightPanel() {
  const { rightOpen, rightPanel, showRightPanel } = useUi();
  const active = panels.find((p) => p.kind === rightPanel) ?? panels[0];

  return (
    <div className="flex shrink-0">
      <aside
        aria-label={active.label}
        aria-hidden={!rightOpen}
        className="overflow-hidden border-line transition-[width] duration-200 ease-out-soft"
        style={{ width: rightOpen ? 300 : 0, borderLeftWidth: rightOpen ? 1 : 0 }}
      >
        {rightOpen && (
          <div className="flex h-full w-[300px] flex-col gap-2 p-4">
            <h2 className="text-[13px] font-semibold">{active.label}</h2>
            <p className="text-[13px] text-ink-3">{active.body}</p>
          </div>
        )}
      </aside>
      <div role="toolbar" aria-label="Side panels" className="flex w-12 flex-col items-center gap-1 border-l border-line py-3">
        {panels.map(({ kind, label, icon: Icon, hint }) => {
          const on = rightOpen && rightPanel === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-label={label}
              aria-pressed={on}
              title={hint ? `${label}  ${hint}` : label}
              onClick={() => showRightPanel(kind)}
              className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${
                on ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-hover hover:text-ink'
              }`}
            >
              <Icon size={17} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
