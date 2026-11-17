import * as Dialog from '@radix-ui/react-dialog';
import { useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useUi } from '@/app/uiStore';
import { useChannels, useContexts, useSettings } from '@/data/ReferenceData';
import type { DailyPriority, Id, ListEdge, TaskDay } from '@/data/types';
import { today } from '@/domain/clock';
import { Kbd } from '@/ui/Kbd';
import { TaskChips } from './TaskChips';
import { createFromText } from './createFromText';
import { OptionList, useOptionNav } from './pickers/OptionList';
import { channelOptions, dateOptions, priorityOptions, timeOptions, type ChannelChoice, type Option } from './pickers/options';
import { resolveChannel } from './pickers/pickers';
import { useOpenTask } from './useOpenTask';

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
  onDone: () => void;
  /** Set while the shortcut menu is open, so Escape closes the menu rather than the window. */
  menuOpenRef: RefObject<boolean>;
}

function AddTaskForm({ initialDay, onDone, menuOpenRef }: FormProps) {
  const [title, setTitle] = useState('');
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [day, setDay] = useState<TaskDay>(initialDay);
  const [plannedMin, setPlannedMin] = useState<number | null>(null);
  const [channelId, setChannelId] = useState<Id | null>(null);
  const [priority, setPriority] = useState<DailyPriority>('normal');
  const input = useRef<HTMLInputElement>(null);
  const channels = useChannels();
  const contexts = useContexts();
  const weekStartsOn = useSettings().weekStartsOn;
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

  async function submit(openAfter: boolean, position?: ListEdge) {
    await channelWork.current;
    const task = await createFromText(title, { day, channelId: channelRef.current, plannedMin, priority, position });
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
      <div className="relative px-4 pt-4">
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
          placeholder="What needs doing?"
          aria-label="Task title"
          autoComplete="off"
          className="w-full bg-transparent text-[17px] font-medium outline-none placeholder:font-normal placeholder:text-ink-3"
        />
        {menuOpen && (
          <div className="absolute left-4 top-full z-10 mt-1 w-[240px] rounded-lg border border-line bg-surface shadow-pop">
            <OptionList options={options} active={nav.active} onHover={nav.setActive} onSelect={applyToken} />
          </div>
        )}
      </div>
      <p className="px-4 pt-1.5 text-[12px] text-ink-3">
        Type <Kbd>~</Kbd> time, <Kbd>#</Kbd> channel, <Kbd>@</Kbd> date, <Kbd>!</Kbd> priority
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <TaskChips
          day={day}
          plannedMin={plannedMin}
          channelId={channelId}
          priority={priority}
          onDay={setDay}
          onPlanned={setPlannedMin}
          onChannel={chooseChannel}
          onPriority={setPriority}
        />
        <button
          type="button"
          onClick={() => void submit(false)}
          disabled={!title.trim()}
          className="h-8 shrink-0 rounded-md bg-ink px-3 text-[13px] font-medium text-canvas transition-opacity disabled:opacity-35"
        >
          Add task
        </button>
      </div>
    </div>
  );
}

export function AddTaskWindow() {
  const addWindow = useUi((s) => s.addWindow);
  const close = useUi((s) => s.closeAddTask);
  const menuOpenRef = useRef(false);

  return (
    <Dialog.Root open={addWindow !== null} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => menuOpenRef.current && e.preventDefault()}
          className="fixed left-1/2 top-[16%] z-50 w-[min(580px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-pop"
        >
          <Dialog.Title className="sr-only">Add task</Dialog.Title>
          {addWindow && <AddTaskForm initialDay={addWindow.day ?? today()} onDone={close} menuOpenRef={menuOpenRef} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
