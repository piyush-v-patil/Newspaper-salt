import type { RightPanelKind } from '@/app/uiStore';

export interface PaletteCommand {
  id: string;
  label: string;
  /** Group heading in the list. */
  group: 'Go to' | 'Rituals' | 'Actions' | 'Settings';
  /** Extra words that should also find this command. */
  keywords?: string;
  /** Shortcut shown on the right. */
  hint?: string;
  run:
    | { kind: 'navigate'; to: string; search?: Record<string, string> }
    | { kind: 'panel'; panel: RightPanelKind }
    | { kind: 'action'; action: 'add-task' | 'dark-mode' | 'left-panel' | 'right-panel' | 'break' | 'undo' | 'shortcuts' | 'filter' };
}

const settings = (id: string, label: string, keywords: string): PaletteCommand => ({
  id: `settings-${id}`,
  label: `Settings: ${label}`,
  group: 'Settings',
  keywords,
  run: { kind: 'navigate', to: '/settings', search: { section: id } },
});

export const COMMANDS: PaletteCommand[] = [
  { id: 'today', label: 'Go to Today', group: 'Go to', hint: 'T', run: { kind: 'navigate', to: '/today' } },
  { id: 'week', label: 'Go to This week', group: 'Go to', hint: 'N', keywords: 'objectives goals', run: { kind: 'navigate', to: '/week' } },
  { id: 'board', label: 'Go to Board', group: 'Go to', hint: 'H', keywords: 'kanban columns', run: { kind: 'navigate', to: '/board' } },
  { id: 'calendar', label: 'Go to Calendar', group: 'Go to', hint: 'J', keywords: 'timebox schedule', run: { kind: 'navigate', to: '/calendar' } },
  { id: 'focus', label: 'Go to Focus', group: 'Go to', hint: 'F', keywords: 'timer pomodoro', run: { kind: 'navigate', to: '/focus' } },
  { id: 'backlog', label: 'Go to Backlog', group: 'Go to', hint: 'B', keywords: 'someday later folders', run: { kind: 'navigate', to: '/backlog' } },
  { id: 'highlights', label: 'Go to Highlights', group: 'Go to', keywords: 'journal reflection', run: { kind: 'navigate', to: '/highlights' } },
  { id: 'settings', label: 'Go to Settings', group: 'Go to', keywords: 'preferences options', run: { kind: 'navigate', to: '/settings' } },

  { id: 'plan', label: 'Start daily planning', group: 'Rituals', hint: 'P', keywords: 'plan my day morning', run: { kind: 'navigate', to: '/plan' } },
  { id: 'shutdown', label: 'Start daily shutdown', group: 'Rituals', hint: 'O', keywords: 'end of day review highlights', run: { kind: 'navigate', to: '/shutdown' } },
  { id: 'weekly-plan', label: 'Go to weekly planning', group: 'Rituals', keywords: 'plan the week objectives', run: { kind: 'navigate', to: '/weekly/plan' } },
  { id: 'weekly-review', label: 'Go to weekly review', group: 'Rituals', keywords: 'review the week', run: { kind: 'navigate', to: '/weekly/review' } },

  { id: 'add-task', label: 'Add a task', group: 'Actions', hint: 'A', keywords: 'new create', run: { kind: 'action', action: 'add-task' } },
  { id: 'search', label: 'Search tasks', group: 'Actions', hint: 'Ctrl F', keywords: 'find', run: { kind: 'panel', panel: 'search' } },
  { id: 'filter', label: 'Filter by channel', group: 'Actions', hint: 'Shift F', keywords: 'context', run: { kind: 'action', action: 'filter' } },
  { id: 'break', label: 'Take a break', group: 'Actions', hint: 'K', keywords: 'pause rest', run: { kind: 'action', action: 'break' } },
  { id: 'undo', label: 'Undo', group: 'Actions', hint: 'Ctrl Z', run: { kind: 'action', action: 'undo' } },
  { id: 'dark', label: 'Switch light or dark mode', group: 'Actions', hint: 'Shift L', keywords: 'theme appearance night', run: { kind: 'action', action: 'dark-mode' } },
  { id: 'themes', label: 'Change colour theme', group: 'Actions', keywords: 'theme color colours appearance palette light dark', run: { kind: 'navigate', to: '/settings', search: { section: 'general' } } },
  { id: 'left', label: 'Show or hide the left panel', group: 'Actions', hint: '<', keywords: 'navigation sidebar', run: { kind: 'action', action: 'left-panel' } },
  { id: 'right', label: 'Show or hide the right panel', group: 'Actions', hint: '>', keywords: 'sidebar', run: { kind: 'action', action: 'right-panel' } },
  { id: 'panel-calendar', label: 'Open the calendar panel', group: 'Actions', hint: 'Shift C', run: { kind: 'panel', panel: 'calendar' } },
  { id: 'panel-objectives', label: 'Open weekly objectives', group: 'Actions', hint: 'Shift R', run: { kind: 'panel', panel: 'objectives' } },
  { id: 'panel-backlog', label: 'Open the backlog panel', group: 'Actions', hint: 'Shift B', run: { kind: 'panel', panel: 'backlog' } },
  { id: 'panel-archive', label: 'Open the archive', group: 'Actions', hint: 'Shift A', keywords: 'stale rolled over', run: { kind: 'panel', panel: 'archive' } },
  { id: 'panel-trash', label: 'Open the trash', group: 'Actions', keywords: 'deleted restore', run: { kind: 'panel', panel: 'trash' } },
  { id: 'shortcuts', label: 'Show keyboard shortcuts', group: 'Actions', hint: '?', keywords: 'keys help', run: { kind: 'action', action: 'shortcuts' } },

  settings('general', 'General', 'name appearance time format week start open on celebrations'),
  settings('tasks', 'Tasks', 'rollover archive new task position planned actual'),
  settings('schedule', 'Working hours', 'schedule workload limit threshold days'),
  settings('rituals', 'Rituals', 'planning time shutdown weekly reminders message'),
  settings('calendar', 'Calendar', 'timeboxing session gap reschedule'),
  settings('focus', 'Focus', 'breaks pomodoro sounds chime timer'),
  settings('channels', 'Channels', 'contexts colours default personal'),
  settings('data', 'Your data', 'backup export import restore erase delete'),
];

/** Every word typed must be the start of some word in the label or keywords, so "board" does not find "keyboard". */
export function matches(command: Pick<PaletteCommand, 'label' | 'keywords'>, query: string): boolean {
  const words = `${command.label} ${command.keywords ?? ''}`.toLowerCase().split(/[^a-z0-9]+/);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((typed) => words.some((word) => word.startsWith(typed)));
}
