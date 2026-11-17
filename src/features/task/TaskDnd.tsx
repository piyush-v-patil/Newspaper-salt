import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { scheduleTaskAt } from '@/data/commands/sessions';
import { placeTask } from '@/data/commands/tasks';
import { useSettings } from '@/data/ReferenceData';
import type { Id, Task } from '@/data/types';
import { listTarget } from '@/domain/backlog';
import { snap } from '@/domain/scheduling';
import { DAY_MIN, dayOfCalendarDrop, isCalendarDrop, pxToMin } from '@/features/calendar/metrics';
import { cardClass, TaskCard, TaskCardBody } from './TaskCard';
import { TaskDataProvider } from './TaskData';
import { useDnd, type Draft, type Lists } from './dndStore';

/** The calendar wins whenever the pointer is over it; otherwise the nearest list does. */
const collisionDetection: CollisionDetection = (args) => {
  const calendar = pointerWithin(args).filter((c) => isCalendarDrop(c.id));
  if (calendar.length) return calendar;
  return closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => !isCalendarDrop(c.id)),
  });
};

function listOf(draft: Draft, id: string): string | undefined {
  if (id in draft) return id;
  return Object.keys(draft).find((key) => draft[key].includes(id));
}

/**
 * The calendar time under the pointer, snapped to a quarter hour. Takes the
 * pointer's real screen position: the drag library's own movement figures
 * include the scroll offset of whatever is under the pointer, which would
 * shift the result by however far the calendar is scrolled.
 */
function calendarTime(over: DragEndEvent['over'], pointerY: number): { day: string; startMin: number } | null {
  if (!over || !isCalendarDrop(over.id)) return null;
  const day = dayOfCalendarDrop(over.id);
  const column = document.querySelector(`[data-cal-day="${day}"]`);
  if (!column) return null;
  const y = pointerY - column.getBoundingClientRect().top;
  // Aim slightly above the pointer so the block appears under the grabbed card, not below it.
  const startMin = Math.max(0, Math.min(DAY_MIN - 15, snap(pxToMin(y) - 10, 15)));
  return { day, startMin };
}

/**
 * Drag and drop for every task list on screen, plus dropping a task onto the
 * calendar. Lists reorder locally while a drag is in flight; on drop the
 * task is written once, with an order key between its new neighbours.
 */
export function TaskDndRoot({ children }: { children: ReactNode }) {
  const sources = useDnd((s) => s.sources);
  const activeId = useDnd((s) => s.activeId);
  const settings = useSettings();
  const settling = useRef(false);
  const shiftHeld = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const lists: Lists = useMemo(() => Object.assign({}, ...Object.values(sources)), [sources]);
  const byId = useMemo(() => {
    const map = new Map<Id, Task>();
    for (const list of Object.values(lists)) for (const task of list) map.set(task.id, task);
    return map;
  }, [lists]);
  const allTasks = useMemo(() => [...byId.values()], [byId]);

  // After a drop, keep showing the dropped order until the stored data catches up.
  useEffect(() => {
    if (settling.current) {
      settling.current = false;
      useDnd.setState({ draft: null });
    }
  }, [lists]);

  const pointerY = useRef(0);
  useEffect(() => {
    const track = (e: KeyboardEvent) => (shiftHeld.current = e.shiftKey);
    const follow = (e: PointerEvent) => (pointerY.current = e.clientY);
    window.addEventListener('keydown', track);
    window.addEventListener('keyup', track);
    window.addEventListener('pointermove', follow, { passive: true });
    return () => {
      window.removeEventListener('keydown', track);
      window.removeEventListener('keyup', track);
      window.removeEventListener('pointermove', follow);
    };
  }, []);

  function onDragStart({ active }: DragStartEvent) {
    useDnd.setState({
      activeId: String(active.id),
      draft: Object.fromEntries(Object.entries(lists).map(([key, tasks]) => [key, tasks.map((t) => t.id)])),
    });
  }

  function onDragMove(event: DragMoveEvent) {
    const at = calendarTime(event.over, pointerY.current);
    const task = byId.get(String(event.active.id));
    const current = useDnd.getState().ghost;
    if (!at || !task) {
      if (current) useDnd.setState({ ghost: null });
      return;
    }
    if (current?.day !== at.day || current.startMin !== at.startMin) {
      useDnd.setState({ ghost: { ...at, durationMin: task.plannedMin ?? settings.defaultSessionMin } });
    }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || isCalendarDrop(over.id)) return;
    const current = useDnd.getState().draft;
    if (!current) return;
    const id = String(active.id);
    const from = listOf(current, id);
    const to = listOf(current, String(over.id));
    if (!from || !to || from === to) return;
    const target = current[to];
    const overIndex = target.indexOf(String(over.id));
    const insertAt = overIndex === -1 ? target.length : overIndex;
    useDnd.setState({
      draft: {
        ...current,
        [from]: current[from].filter((x) => x !== id),
        [to]: [...target.slice(0, insertAt), id, ...target.slice(insertAt)],
      },
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const current = useDnd.getState().draft;
    const task = byId.get(id);
    const reset = () => useDnd.setState({ activeId: null, draft: null, ghost: null });
    if (!current || !task) return reset();

    const at = calendarTime(over, pointerY.current);
    if (at) {
      reset();
      void scheduleTaskAt(id, at.day, at.startMin, { reschedule: !shiftHeld.current });
      return;
    }

    let next = current;
    const list = listOf(current, id);
    if (!list) return reset();
    if (over && listOf(current, String(over.id)) === list) {
      const ids = current[list];
      const from = ids.indexOf(id);
      const to = String(over.id) === list ? ids.length - 1 : ids.indexOf(String(over.id));
      if (from !== to && to !== -1) next = { ...current, [list]: arrayMove(ids, from, to) };
    }

    const ids = next[list];
    const index = ids.indexOf(id);
    // Same members in the same order means the drop changed nothing.
    const unchanged = (lists[list] ?? []).map((t) => t.id).join() === ids.join();
    if (unchanged) return reset();

    settling.current = true;
    useDnd.setState({ activeId: null, draft: next, ghost: null });
    const before = byId.get(ids[index - 1])?.order ?? null;
    const after = byId.get(ids[index + 1])?.order ?? null;
    const target = listTarget(list);
    void placeTask(id, target.day, before, after, target.bucket);
  }

  const activeTask = activeId ? byId.get(activeId) : undefined;

  return (
    <TaskDataProvider tasks={allTasks}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        // The calendar must hold still under a dragged task, or the drop time shifts under the pointer.
        autoScroll={{ canScroll: (element) => !element.hasAttribute('data-hold-still') }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => useDnd.setState({ activeId: null, draft: null, ghost: null })}
      >
        {children}
        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {activeTask && (
            <div className={`${cardClass} rotate-[1.5deg] scale-[1.02] cursor-grabbing shadow-pop`}>
              <TaskCardBody task={activeTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </TaskDataProvider>
  );
}

/**
 * Registers a view's task lists for drag and drop and returns them in the
 * order to render: the stored order, or the in-flight order during a drag.
 * `key` names the view, so two views never clobber each other's lists.
 */
export function useTaskLists(key: string, lists: Lists): Lists {
  const setSource = useDnd((s) => s.setSource);
  const draft = useDnd((s) => s.draft);
  const sources = useDnd((s) => s.sources);

  useEffect(() => {
    setSource(key, lists);
  }, [key, lists, setSource]);
  useEffect(() => () => setSource(key, null), [key, setSource]);

  return useMemo(() => {
    if (!draft) return lists;
    const byId = new Map<Id, Task>();
    for (const source of Object.values(sources)) for (const list of Object.values(source)) for (const t of list) byId.set(t.id, t);
    const result: Lists = {};
    for (const listId of Object.keys(lists)) {
      result[listId] = draft[listId] ? draft[listId].flatMap((id) => byId.get(id) ?? []) : lists[listId];
    }
    return result;
  }, [draft, lists, sources]);
}

/** One droppable, sortable list of task cards. */
export function TaskList({ listId, tasks, className = '' }: { listId: string; tasks: Task[]; className?: string }) {
  const { setNodeRef } = useDroppable({ id: listId });
  return (
    <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} data-list={listId} className={`flex min-h-12 flex-col gap-2 ${className}`}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </SortableContext>
  );
}
