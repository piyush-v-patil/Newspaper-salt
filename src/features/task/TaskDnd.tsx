import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { placeTask } from '@/data/commands/tasks';
import type { Id, Task, TaskDay } from '@/data/types';
import { cardClass, TaskCard, TaskCardBody } from './TaskCard';

type Lists = Record<string, Task[]>;
type Draft = Record<string, Id[]>;

interface Props {
  /** Tasks per list, keyed by the list's day (or the backlog). */
  lists: Lists;
  children: (ordered: Lists) => ReactNode;
}

/**
 * Drag and drop across any number of task lists. While a drag is in flight
 * the lists are reordered locally; on drop the task is written once, with an
 * order key between its new neighbours.
 */
export function TaskDnd({ lists, children }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeId, setActiveId] = useState<Id | null>(null);
  const settling = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const byId = useMemo(() => {
    const map = new Map<Id, Task>();
    for (const list of Object.values(lists)) for (const task of list) map.set(task.id, task);
    return map;
  }, [lists]);

  // After a drop, keep showing the dropped order until the stored data catches up.
  useEffect(() => {
    if (settling.current) {
      settling.current = false;
      setDraft(null);
    }
  }, [lists]);

  const ordered = useMemo(() => {
    if (!draft) return lists;
    const result: Lists = {};
    for (const key of Object.keys(lists)) {
      result[key] = draft[key] ? draft[key].flatMap((id) => byId.get(id) ?? []) : lists[key];
    }
    return result;
  }, [draft, lists, byId]);

  function listOf(current: Draft, id: string): string | undefined {
    if (id in current) return id;
    return Object.keys(current).find((key) => current[key].includes(id));
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDraft(Object.fromEntries(Object.entries(lists).map(([key, tasks]) => [key, tasks.map((t) => t.id)])));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setDraft((current) => {
      if (!current) return current;
      const id = String(active.id);
      const from = listOf(current, id);
      const to = listOf(current, String(over.id));
      if (!from || !to || from === to) return current;
      const target = current[to];
      const overIndex = target.indexOf(String(over.id));
      const insertAt = overIndex === -1 ? target.length : overIndex;
      return {
        ...current,
        [from]: current[from].filter((x) => x !== id),
        [to]: [...target.slice(0, insertAt), id, ...target.slice(insertAt)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    setActiveId(null);
    const task = byId.get(id);
    if (!draft || !task) return setDraft(null);

    let next = draft;
    const list = listOf(draft, id);
    if (!list) return setDraft(null);
    if (over && listOf(draft, String(over.id)) === list) {
      const ids = draft[list];
      const from = ids.indexOf(id);
      const to = String(over.id) === list ? ids.length - 1 : ids.indexOf(String(over.id));
      if (from !== to && to !== -1) next = { ...draft, [list]: arrayMove(ids, from, to) };
    }

    const ids = next[list];
    const index = ids.indexOf(id);
    const unchanged = task.day === list && (lists[list] ?? []).map((t) => t.id).join() === ids.join();
    if (unchanged) return setDraft(null);

    setDraft(next);
    settling.current = true;
    const before = byId.get(ids[index - 1])?.order ?? null;
    const after = byId.get(ids[index + 1])?.order ?? null;
    void placeTask(id, list as TaskDay, before, after);
  }

  const activeTask = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDraft(null);
      }}
    >
      {children(ordered)}
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {activeTask && (
          <div className={`${cardClass} rotate-[1.5deg] scale-[1.02] cursor-grabbing shadow-pop`}>
            <TaskCardBody task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** One droppable, sortable list of task cards. Must sit inside TaskDnd. */
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
