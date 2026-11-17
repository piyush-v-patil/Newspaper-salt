import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownToLine, ArrowUpToLine, CornerDownRight, Folder, Target, X } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useUi } from '@/app/uiStore';
import { useBacklogFolders, useObjectives, useOpenTasks } from '@/data/queries';
import { addSubtask, setSubtaskPlanned } from '@/data/commands/subtasks';
import { BACKLOG } from '@/data/types';
import { extractTokens } from '@/domain/tokens';
import { relativeDayLabel } from '@/domain/dayLabels';
import { useChannels, useContexts, useSettings } from '@/data/ReferenceData';
import { weekStartOf } from '@/domain/weeks';
import type { BacklogFolder, DailyPriority, Id, ListEdge, Objective, Task, TaskDay } from '@/data/types';
import { today } from '@/domain/clock';
import { Chip } from './Chip';
import { TaskChips } from './TaskChips';
import { createFromText } from './createFromText';
import { OptionList, useOptionNav } from './pickers/OptionList';
import { channelOptions, dateOptions, priorityOptions, timeOptions, type ChannelChoice, type Option } from './pickers/options';
import { ObjectivePicker, resolveChannel } from './pickers/pickers';
import { useOpenTask } from './useOpenTask';

/** One shown each time the card opens, in turn. */
const TIPS = [
  'Type ~45 to set planned time',
  'Type # to pick a channel',
  'Type @ to choose a day',
  'Type ! to set priority',
  'Type $ to link a weekly objective',
  'Type > to add it as a subtask of another task',
  'Type < to put it in a backlog folder',
  'Ctrl+Enter adds the task and opens it',
];
let nextTip = 0;

type Trigger = '#' | '~' | '@' | '!' | '$' | '>' | '<';
type TokenValue =
  | { kind: 'channel'; choice: ChannelChoice }
  | { kind: 'planned'; minutes: number | null }
  | { kind: 'day'; day: TaskDay }
  | { kind: 'priority'; priority: DailyPriority }
  | { kind: 'objective'; id: Id }
  | { kind: 'parent'; id: Id }
  | { kind: 'folder'; id: Id };

interface Token {
  trigger: Trigger;
  /** Index of the trigger character in the title. */
  start: number;
  query: string;
}

/** The typing shortcut under the caret, if the caret sits in one. */
function tokenAt(text: string, caret: number): Token | null {
  const match = text.slice(0, caret).match(/(?:^|\s)([#~@!$><])([^#~@!$><]*)$/);
  if (!match) return null;
  const trigger = match[1] as Trigger;
  const query = match[2];
  // Only a date ("next week") or a task's name may contain a space.
  if (trigger !== '@' && trigger !== '>' && /\s/.test(query)) return null;
  return { trigger, start: caret - query.length - 1, query };
}

/** Lists the typing shortcuts pick from. Loaded before the card opens, so a quick Enter finds them ready. */
interface Lists {
  objectives: Objective[];
  openTasks: Task[];
  folders: BacklogFolder[];
}

interface FormProps {
  lists: Lists;
  initialDay: TaskDay;
  folderId: Id | null;
  onDone: () => void;
  /** Set while the shortcut menu is open, so Escape closes the menu rather than the window. */
  menuOpenRef: RefObject<boolean>;
}

function AddTaskForm({ lists, initialDay, folderId, onDone, menuOpenRef }: FormProps) {
  const { objectives, openTasks, folders } = lists;
  const { weekStartsOn, newTaskPosition } = useSettings();
  const [title, setTitle] = useState('');
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [day, setDay] = useState<TaskDay>(initialDay);
  const [plannedMin, setPlannedMin] = useState<number | null>(null);
  const [channelId, setChannelId] = useState<Id | null>(null);
  const [priority, setPriority] = useState<DailyPriority>('normal');
  const [objectiveId, setObjectiveId] = useState<Id | null>(null);
  const [position, setPosition] = useState<ListEdge>(newTaskPosition);
  // ">": add as a subtask of this task instead. "<": into this backlog folder.
  const [parentId, setParentId] = useState<Id | null>(null);
  const [folder, setFolder] = useState<Id | null>(folderId);
  const parent = openTasks.find((t) => t.id === parentId);
  const folderName = folders.find((f) => f.id === folder)?.name;
  const [tip] = useState(() => TIPS[nextTip++ % TIPS.length]);
  const objective = objectives.find((o) => o.id === objectiveId);
  const input = useRef<HTMLInputElement>(null);
  const channels = useChannels();
  const contexts = useContexts();
  const openTask = useOpenTask();

  const token = useMemo(() => {
    const found = tokenAt(title, caret);
    return found && found.start !== dismissed ? found : null;
  }, [title, caret, dismissed]);

  const options: Option<TokenValue>[] = useMemo(() => {
    if (!token) return [];
    const wrap = <T,>(list: Option<T>[], to: (value: T) => TokenValue) => list.map((o) => ({ ...o, value: to(o.value) }));
    switch (token.trigger) {
      case '#':
        return wrap(
          // A new channel name has to start with a letter, so "#42" stays plain text.
          channelOptions(token.query, channels, contexts, null).filter((o) => !('create' in o.value) || /^[a-z]/.test(o.value.create)),
          (choice) => ({ kind: 'channel', choice }),
        );
      case '~':
        return wrap(timeOptions(token.query, null), (minutes) => ({ kind: 'planned', minutes }));
      case '@':
        return wrap(dateOptions(token.query, today(), weekStartsOn), (d) => ({ kind: 'day', day: d }));
      case '!':
        return wrap(priorityOptions(token.query), (p) => ({ kind: 'priority', priority: p }));
      case '$': {
        const q = token.query.toLowerCase();
        return objectives
          .filter((o) => o.completedAt === null && o.title.toLowerCase().includes(q))
          .map((o) => ({ key: o.id, label: o.title, value: { kind: 'objective', id: o.id } as TokenValue }));
      }
      case '>': {
        const q = token.query.trim().toLowerCase();
        // Tasks on the day being added to come first.
        return openTasks
          .filter((t) => t.title.toLowerCase().includes(q))
          .sort((a, b) => Number(b.day === day) - Number(a.day === day))
          .slice(0, 8)
          .map((t) => ({
            key: t.id,
            label: t.title,
            hint: t.day === BACKLOG ? 'Backlog' : relativeDayLabel(t.day, today()),
            value: { kind: 'parent', id: t.id } as TokenValue,
          }));
      }
      case '<': {
        const q = token.query.toLowerCase();
        return folders.filter((f) => f.name.toLowerCase().includes(q)).map((f) => ({ key: f.id, label: f.name, value: { kind: 'folder', id: f.id } as TokenValue }));
      }
    }
  }, [token, channels, contexts, weekStartsOn, objectives, openTasks, folders, day]);

  // Creating a new channel takes a moment. The title updates at once and
  // saving waits for the channel, so a quick second Enter is never lost.
  const channelRef = useRef<Id | null>(null);
  const channelWork = useRef<Promise<void>>(Promise.resolve());
  const chooseChannel = (id: Id | null) => {
    channelRef.current = id;
    setChannelId(id);
  };

  function applyToken(value: TokenValue) {
    if (!token) return;
    if (value.kind === 'channel') channelWork.current = resolveChannel(value.choice).then(chooseChannel);
    else if (value.kind === 'planned') setPlannedMin(value.minutes);
    else if (value.kind === 'day') setDay(value.day);
    else if (value.kind === 'priority') setPriority(value.priority);
    else if (value.kind === 'objective') setObjectiveId(value.id);
    else if (value.kind === 'parent') setParentId(value.id);
    else {
      setFolder(value.id);
      setDay(BACKLOG);
    }

    const next = (title.slice(0, token.start) + title.slice(caret)).replace(/\s{2,}/g, ' ');
    const position = Math.min(token.start, next.length);
    // Applied synchronously, so the caret is in place before the next keystroke arrives.
    flushSync(() => {
      setTitle(next);
      setCaret(position);
    });
    input.current?.setSelectionRange(position, position);
  }

  const nav = useOptionNav(options, applyToken);
  const menuOpen = token !== null && options.length > 0;
  menuOpenRef.current = menuOpen;

  // A second Enter while the first is still saving must not add the task twice.
  const submitting = useRef(false);
  async function submit(openAfter: boolean, at: ListEdge = position) {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await submitNow(openAfter, at);
    } finally {
      submitting.current = false;
    }
  }

  async function submitNow(openAfter: boolean, at: ListEdge) {
    await channelWork.current;
    if (parentId) {
      const text = extractTokens(title).title;
      if (!text) return;
      const subtask = await addSubtask(parentId, text);
      if (plannedMin !== null) await setSubtaskPlanned(subtask.id, plannedMin);
      onDone();
      if (openAfter) openTask(parentId);
      return;
    }
    const task = await createFromText(title, {
      day,
      channelId: channelRef.current,
      plannedMin,
      priority,
      objectiveId,
      folderId: day === BACKLOG ? folder : null,
      position: at,
    });
    if (!task) return;
    onDone();
    if (openAfter) openTask(task.id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (menuOpen && !mod) {
      if (nav.handleKey(e)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setDismissed(token.start);
        return;
      }
    }
    if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      void submit(false, e.key === 'ArrowUp' ? 'top' : 'bottom');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void submit(mod);
    }
  }

  const syncCaret = () => setCaret(input.current?.selectionStart ?? title.length);

  return (
    <div className="flex flex-col">
      <div className="relative px-4 pt-3.5">
        <input
          ref={input}
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissed(null);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          placeholder="Task description..."
          aria-label="Task title"
          autoComplete="off"
          className="w-full bg-transparent text-[18px] outline-none placeholder:text-ink-3"
        />
        {parent && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <CornerDownRight size={13} /> Subtask of <span className="font-medium text-ink">{parent.title}</span>
            <button type="button" aria-label="Add as its own task instead" onClick={() => setParentId(null)} className="grid h-4 w-4 place-items-center rounded text-ink-3 hover:text-ink">
              <X size={12} />
            </button>
          </p>
        )}
        {menuOpen && (
          <div className="absolute left-4 top-full z-10 mt-1 w-[240px] rounded-lg border border-line bg-surface shadow-pop">
            <OptionList options={options} active={nav.active} onHover={nav.setActive} onSelect={applyToken} />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
        <p className="flex min-w-0 items-center gap-2 text-[12.5px] text-ink-3">
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">TIP</span>
          <span className="truncate">{tip}</span>
        </p>
        <div className="flex flex-wrap items-center gap-0.5">
          <TaskChips
            plain
            day={day}
            plannedMin={plannedMin}
            channelId={channelId}
            priority={priority}
            onDay={setDay}
            onPlanned={setPlannedMin}
            onChannel={chooseChannel}
            onPriority={setPriority}
            beforePriority={
          <Chip icon={Target} name="Weekly objective" plain active={!!objective} label={objective ? objective.title : ''}>
                {(close) => (
                  <ObjectivePicker
                    value={objectiveId}
                    onPick={(id) => {
                      setObjectiveId(id);
                      close();
                    }}
                  />
                )}
              </Chip>
            }
          />
          {folderName && day === BACKLOG && (
            <span className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-ink">
              <Folder size={15} /> {folderName}
            </span>
          )}
          <button
            type="button"
            aria-label={position === 'top' ? 'Add to the top of the list' : 'Add to the bottom of the list'}
            title={position === 'top' ? 'Goes to the top of the list' : 'Goes to the bottom of the list'}
            onClick={() => setPosition(position === 'top' ? 'bottom' : 'top')}
            className="grid h-7 w-7 place-items-center rounded-md bg-hover text-ink-2 hover:text-ink"
          >
            {position === 'top' ? <ArrowUpToLine size={15} /> : <ArrowDownToLine size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

const CARD_WIDTH = 580;

/** Over the row it was opened from, kept on screen; centred near the top otherwise. */
function place(anchor: { top: number; left: number } | null): React.CSSProperties {
  const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
  if (!anchor) return { width, left: (window.innerWidth - width) / 2, top: '16%' };
  return {
    width,
    left: Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16)),
    top: Math.max(16, Math.min(anchor.top, window.innerHeight - 200)),
  };
}

export function AddTaskWindow() {
  const addWindow = useUi((s) => s.addWindow);
  const close = useUi((s) => s.closeAddTask);
  const menuOpenRef = useRef(false);
  const { weekStartsOn } = useSettings();
  const lists: Lists = { objectives: useObjectives(weekStartOf(today(), weekStartsOn)), openTasks: useOpenTasks(), folders: useBacklogFolders() };

  return (
    <Dialog.Root open={addWindow !== null} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        {/* No dimming: the card floats over the list it adds to. */}
        <Dialog.Overlay className="fixed inset-0 z-40" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => menuOpenRef.current && e.preventDefault()}
          style={place(addWindow?.anchor ?? null)}
          className="fixed z-50 rounded-xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-pop"
        >
          <Dialog.Title className="sr-only">Add task</Dialog.Title>
          {addWindow && <AddTaskForm lists={lists} initialDay={addWindow.day ?? today()} folderId={addWindow.folderId} onDone={close} menuOpenRef={menuOpenRef} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
