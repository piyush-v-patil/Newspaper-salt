import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toggleDarkMode } from '@/app/theme';
import { useUi } from '@/app/uiStore';
import { useToday } from '@/app/useToday';
import { db } from '@/data/db';
import { undoLast } from '@/data/undo';
import { BACKLOG } from '@/data/types';
import { relativeDayLabel } from '@/domain/dayLabels';
import { takeBreak } from '@/features/focus/actions';
import { useOpenTask } from '@/features/task/useOpenTask';
import { OptionList, useOptionNav } from '@/features/task/pickers/OptionList';
import type { Option } from '@/features/task/pickers/options';
import { COMMANDS, matches, type PaletteCommand } from './commands';

type Choice = { kind: 'command'; command: PaletteCommand } | { kind: 'task'; id: string };
const MAX_TASKS = 6;

function PaletteBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const openTask = useOpenTask();
  const current = useToday();
  const q = query.trim();

  const tasks = useLiveQuery(async () => {
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    const rows = await db.tasks.where('state').equals('active').filter((t) => t.kind === 'task' && t.title.toLowerCase().includes(needle)).toArray();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_TASKS);
  }, [q]);

  const options: Option<Choice>[] = useMemo(() => {
    const commands = COMMANDS.filter((c) => matches(c, q)).map((c) => ({
      key: c.id,
      label: c.label,
      hint: c.hint,
      value: { kind: 'command', command: c } as Choice,
    }));
    const found = (tasks ?? []).map((t) => ({
      key: `task-${t.id}`,
      label: t.title,
      hint: t.day === BACKLOG ? 'Backlog' : relativeDayLabel(t.day, current),
      value: { kind: 'task', id: t.id } as Choice,
    }));
    return [...commands, ...found];
  }, [q, tasks, current]);

  function run(choice: Choice) {
    onClose();
    if (choice.kind === 'task') return openTask(choice.id);
    const { run: what } = choice.command;
    const ui = useUi.getState();
    if (what.kind === 'navigate') return void navigate({ to: what.to, search: what.search ?? {} });
    if (what.kind === 'panel') return useUi.setState({ rightOpen: true, rightPanel: what.panel });
    switch (what.action) {
      case 'add-task':
        return ui.openAddTask();
      case 'dark-mode':
        return void toggleDarkMode();
      case 'left-panel':
        return ui.toggleLeft();
      case 'right-panel':
        return ui.toggleRight();
      case 'break':
        return void takeBreak();
      case 'undo':
        return void undoLast();
      case 'shortcuts':
        return useUi.setState({ shortcutsOpen: true });
      case 'filter':
        return ui.setFilterMenuOpen(true);
    }
  }

  const nav = useOptionNav(options, run);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search size={16} className="shrink-0 text-ink-3" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => nav.handleKey(e)}
          placeholder="Type a command or search tasks"
          aria-label="Command"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
      </div>
      <div className="max-h-[360px]">
        <OptionList options={options} active={nav.active} onHover={nav.setActive} onSelect={run} emptyText="Nothing matches. Try another word." />
      </div>
    </div>
  );
}

/** Ctrl+K: every view, ritual, action and setting, plus tasks by name. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const close = () => useUi.setState({ paletteOpen: false });
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14%] z-[61] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-pop"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          {open && <PaletteBody onClose={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
