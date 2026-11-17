import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useUi } from '@/app/uiStore';
import { autoScheduleTask, clearSessions } from '@/data/commands/sessions';
import { deleteTask, duplicateTask, moveTask, nudgeTask, setTaskCompleted, snoozeTask } from '@/data/commands/tasks';
import { db, getSettings } from '@/data/db';
import { BACKLOG } from '@/data/types';
import { today } from '@/domain/clock';
import { toggleTaskTimer } from '@/features/focus/actions';
import { activeTaskId, useTaskFocus } from './taskFocus';
import { useOpenTask } from './useOpenTask';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

const cards = (root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>('[data-task-id]'));

/** Moves the keyboard selection between task cards, following what is on screen. */
function moveSelection(key: string, shift: boolean): void {
  const { select } = useTaskFocus.getState();
  const currentId = activeTaskId();
  const current = currentId ? document.querySelector<HTMLElement>(`[data-task-id="${currentId}"]`) : null;
  const pick = (el: HTMLElement | undefined) => {
    if (!el) return;
    select(el.dataset.taskId ?? null);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  if (!current) return pick(cards()[0]);
  const list = current.closest<HTMLElement>('[data-list]');
  if (!list) return;

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const siblings = cards(list);
    const index = siblings.indexOf(current);
    if (shift) return pick(key === 'ArrowUp' ? siblings[0] : siblings[siblings.length - 1]);
    return pick(siblings[key === 'ArrowUp' ? index - 1 : index + 1]);
  }

  // Left/Right: the first task of the nearest non-empty list in that direction.
  const lists = Array.from(document.querySelectorAll<HTMLElement>('[data-list]'));
  const direction = key === 'ArrowLeft' ? -1 : 1;
  for (let i = lists.indexOf(list) + direction; i >= 0 && i < lists.length; i += direction) {
    const first = cards(lists[i])[0];
    if (first) return pick(first);
  }
}

/** Shortcuts that act on the task under the cursor, or the one selected with the arrow keys. */
export function useTaskShortcuts(): void {
  const openTask = useOpenTask();
  const navigate = useNavigate();

  useEffect(() => {
    async function onKeyDown(e: KeyboardEvent) {
      if (e.altKey || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      // Focus mode has one task and its own keys.
      if (location.pathname.startsWith('/focus')) return;
      const mod = e.ctrlKey || e.metaKey;
      const focus = useTaskFocus.getState();

      if (!mod && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        return moveSelection(e.key, e.shiftKey);
      }
      // In a ritual, Left and Right move between its steps instead.
      const inRitual = /^\/(plan|shutdown)/.test(location.pathname);
      if (!mod && !e.shiftKey && !inRitual && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        return moveSelection(e.key, false);
      }
      if (e.key === 'Escape') return focus.select(null);

      const id = activeTaskId();
      if (!id) return;
      const act = (work: () => unknown) => {
        e.preventDefault();
        void work();
      };

      if (mod) {
        if (e.key === 'Enter') return act(() => openTask(id));
        if (e.key.toLowerCase() === 'd') return act(() => duplicateTask(id));
        if (e.key === 'Backspace' || e.key === 'Delete') return act(() => deleteTask(id));
        if (e.key.toLowerCase() === 'x') {
          return act(async () => {
            const task = await db.tasks.get(id);
            if (task && task.day !== BACKLOG) await clearSessions(id, task.day);
          });
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const up = e.key === 'ArrowUp';
          if (!e.shiftKey) return act(() => nudgeTask(id, up ? 'up' : 'down'));
          return act(async () => {
            const task = await db.tasks.get(id);
            if (task) await moveTask(id, task.day, up ? 'top' : 'bottom');
          });
        }
        return;
      }

      switch (e.key) {
        case ' ':
          // Space starts or pauses the timer; starting one enters focus mode unless that is turned off.
          return act(async () => {
            const started = await toggleTaskTimer(id);
            if (started && (await getSettings()).focusOnTimerStart) await navigate({ to: '/focus/$taskId', params: { taskId: id } });
          });
        case 'f':
          return act(() => navigate({ to: '/focus/$taskId', params: { taskId: id } }));
        case 'e':
          return act(() => focus.openAction(id, 'actual'));
        case 'c':
          return act(async () => {
            const task = await db.tasks.get(id);
            if (task) await setTaskCompleted(id, task.completedAt === null);
          });
        case 'w':
          return act(() => focus.openAction(id, 'planned'));
        case 'q':
          return act(() => focus.openAction(id, 'channel'));
        case 'r':
          return act(() => focus.openAction(id, 'objective'));
        case '!':
          return act(() => focus.openAction(id, 'priority'));
        case '@':
          return act(() => focus.openAction(id, 'date'));
        case 'v':
          return act(() => {
            focus.setFocusSubtaskOnOpen(true);
            openTask(id);
          });
        case 'x':
        case 'X':
          // X finds the next free time; Shift+X keeps the task in one block.
          return act(async () => {
            const result = await autoScheduleTask(id, { allowSplit: e.key === 'x' });
            if (result === 'no-room') useUi.getState().setNoRoomTask(id);
          });
        case 's':
          return act(() => moveTask(id, today()));
        case 'd':
          return act(() => snoozeTask(id));
        case 'z':
          return act(() => moveTask(id, BACKLOG, 'bottom'));
        case 'Z':
          return act(() => moveTask(id, BACKLOG, 'top'));
      }
    }

    const listener = (e: KeyboardEvent) => void onKeyDown(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [openTask, navigate]);
}
