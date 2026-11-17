import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownToLine, ArrowUpToLine, Target } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useUi } from '@/app/uiStore';
import { useObjectives } from '@/data/queries';
import { useChannels, useContexts, useSettings } from '@/data/ReferenceData';
import { weekStartOf } from '@/domain/weeks';
import type { DailyPriority, Id, ListEdge, TaskDay } from '@/data/types';
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
  'Ctrl+Enter adds the task and opens it',
];
let nextTip = 0;

type Trigger = '#' | '~' | '@' | '!';
type TokenValue =
  | { kind: 'channel'; choice: ChannelChoice }
  | { kind: 'planned'; minutes: number | null }
  | { kind: 'day'; day: TaskDay }
  | { kind: 'priority'; priority: DailyPriority };

interface Token {
  trigger: Trigger;
  /** Index of the trigger character in the title. */
  start: number;
  query: string;
}

/** The typing shortcut under the caret, if the caret sits in one. */
function tokenAt(text: string, caret: number): Token | null {
  const match = text.slice(0, caret).match(/(?:^|\s)([#~@!])([^#~@!]*)$/);
  if (!match) return null;
  const trigger = match[1] as Trigger;
  const query = match[2];
  // Only a date ("next week") may contain a space.
  if (trigger !== '@' && /\s/.test(query)) return null;
  return { trigger, start: caret - query.length - 1, query };
}

interface FormProps {
  initialDay: TaskDay;
  folderId: Id | null;
  onDone: () => void;
  /** Set while the shortcut menu is open, so Escape closes the menu rather than the window. */
  menuOpenRef: RefObject<boolean>;
}

function AddTaskForm({ initialDay, folderId, onDone, menuOpenRef }: FormProps) {
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
  const [tip] = useState(() => TIPS[nextTip++ % TIPS.length]);
  const objectives = useObjectives(weekStartOf(today(), weekStartsOn));
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
    }
  }, [token, channels, contexts, weekStartsOn]);

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
    else setPriority(value.priority);

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
    const task = await createFromText(title, { day, channelId: channelRef.current, plannedMin, priority, objectiveId, folderId, position: at });
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
          {addWindow && <AddTaskForm initialDay={addWindow.day ?? today()} folderId={addWindow.folderId} onDone={close} menuOpenRef={menuOpenRef} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
