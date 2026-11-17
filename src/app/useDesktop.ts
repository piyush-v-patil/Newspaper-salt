import { useEffect } from 'react';
import { getRunningTimer } from '@/data/commands/timer';
import { useCurrentFocusTask, useRunningTimer, useTask } from '@/data/queries';
import { useSettings } from '@/data/ReferenceData';
import { formatMinutes } from '@/domain/dates';
import { msToMinutes } from '@/domain/time';
import { beginTimer, pauseTimer } from '@/features/focus/actions';
import { useFocus } from '@/features/focus/focusStore';
import { useTaskTime } from '@/features/focus/useTaskTime';
import { platform } from '@/platform';
import { useUi } from './uiStore';

/**
 * Notifies only when the person is looking elsewhere: in another app, or
 * with the window minimised or in the tray. In front of them, the in-app
 * prompt is enough.
 */
export function notifyIfAway(title: string, body?: string): void {
  if (document.hidden || !document.hasFocus()) void platform.notify(title, body);
}

/** The running task's time, shown outside the window: the tray on desktop, the tab title on the web. */
function useTimerIndicator() {
  const running = useRunningTimer();
  const task = useTask(running?.taskId);
  const time = useTaskTime(running?.taskId);
  const minutes = msToMinutes(time.todayMs);
  const label = running && task ? `${formatMinutes(minutes)} ${task.title}` : null;
  useEffect(() => platform.setTimerIndicator(label), [label]);
}

/** Shortcuts that work from any app. Desktop only; the web cannot hear keys outside its tab. */
function useGlobalKeys() {
  useEffect(() => {
    if (platform.kind !== 'desktop') return;
    const releases: Promise<() => void>[] = [
      platform.registerGlobalShortcut('CommandOrControl+Shift+A', () => {
        void platform.showMainWindow();
        useUi.getState().openAddTask();
      }),
      platform.registerGlobalShortcut('CommandOrControl+Shift+Space', () => {
        void (async () => {
          const running = await getRunningTimer();
          if (running) return pauseTimer();
          const task = useFocus.getState().barTaskId;
          if (task) await beginTimer(task);
        })();
      }),
      platform.registerGlobalShortcut('CommandOrControl+Shift+F', () => {
        useUi.setState((s) => ({ floatingBarHidden: !s.floatingBarHidden }));
      }),
    ];
    return () => releases.forEach((release) => void release.then((fn) => fn()));
  }, []);
}

/** Keeps the floating focus bar open while a task is in progress, if that is turned on. */
function useFloatingBar() {
  const { floatingFocusBar } = useSettings();
  const hidden = useUi((s) => s.floatingBarHidden);
  const current = useCurrentFocusTask();
  const open = platform.canFloatFocusBar && floatingFocusBar && current !== null && !hidden;
  useEffect(() => {
    void platform.setFloatingFocusBar(open);
  }, [open]);
  // Starting new work brings a put-away bar back.
  const taskId = current?.id;
  useEffect(() => {
    if (taskId) useUi.setState({ floatingBarHidden: false });
  }, [taskId]);
}

/** Everything that reaches outside the window. Mounted once, in the main window. */
export function useDesktop(): void {
  useTimerIndicator();
  useGlobalKeys();
  useFloatingBar();
}
