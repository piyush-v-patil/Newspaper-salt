import { FolderPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useUi } from '@/app/uiStore';
import { createFolder, deleteFolder } from '@/data/commands/folders';
import { useBacklogFolders, useTasksForDay } from '@/data/queries';
import { useChannelMap } from '@/data/ReferenceData';
import { BACKLOG, type BacklogPriority, type Id } from '@/data/types';
import { BACKLOG_PRIORITIES, bucketListId, BUCKETS, groupByBucket } from '@/domain/backlog';
import { matchesFilter } from '@/domain/filter';
import { FilterButton } from '@/features/common/FilterButton';
import { AddTaskRow } from '@/features/task/AddTaskRow';
import { TaskList, useTaskLists } from '@/features/task/TaskDnd';

const chip = (on: boolean) =>
  `flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12.5px] ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-hover'}`;

/** Everything without a day, grouped by how soon you mean to get to it. */
export function BacklogPage() {
  const all = useTasksForDay(BACKLOG);
  const folders = useBacklogFolders();
  const channels = useChannelMap();
  const filter = useUi((s) => s.filter);
  const [folderId, setFolderId] = useState<Id | null>(null);
  const [priority, setPriority] = useState<BacklogPriority | 'any'>('any');
  const [naming, setNaming] = useState(false);

  const activeFolder = folders.find((f) => f.id === folderId) ?? null;
  const visible = useMemo(
    () =>
      (all ?? []).filter(
        (t) =>
          matchesFilter(t, filter, channels) &&
          (activeFolder === null || t.backlogFolderId === activeFolder.id) &&
          (priority === 'any' || t.backlogPriority === priority),
      ),
    [all, filter, channels, activeFolder, priority],
  );
  const lists = useMemo(() => {
    const groups = groupByBucket(visible);
    return Object.fromEntries(BUCKETS.map((b) => [bucketListId(b.id), groups[b.id]]));
  }, [visible]);
  const ordered = useTaskLists('backlog', lists);

  async function addFolder(name: string) {
    setNaming(false);
    if (name.trim()) setFolderId((await createFolder(name)).id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6">
        <h1 className="text-[16px] font-semibold tracking-tight">Backlog</h1>
        <span className="tabular text-[12.5px] text-ink-3">{all?.length ?? 0}</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as BacklogPriority | 'any')}
            className="h-7 rounded-md border border-line bg-surface px-2 text-[12.5px] text-ink-2"
          >
            <option value="any">Any priority</option>
            {BACKLOG_PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <FilterButton />
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line px-6 py-2.5" role="group" aria-label="Folders">
        <button type="button" aria-pressed={activeFolder === null} className={chip(activeFolder === null)} onClick={() => setFolderId(null)}>
          All
        </button>
        {folders.map((folder) => (
          <span key={folder.id} className="group relative">
            <button type="button" aria-pressed={folder.id === folderId} className={chip(folder.id === folderId)} onClick={() => setFolderId(folder.id)}>
              {folder.name}
            </button>
            <button
              type="button"
              aria-label={`Delete folder ${folder.name}`}
              onClick={() => {
                if (folderId === folder.id) setFolderId(null);
                void deleteFolder(folder.id);
              }}
              className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 place-items-center rounded-full border border-line bg-surface text-ink-3 hover:text-over group-hover:grid"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {naming ? (
          <input
            autoFocus
            aria-label="New folder name"
            placeholder="Folder name"
            onBlur={(e) => void addFolder(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setNaming(false);
            }}
            className="h-7 w-[140px] rounded-md border border-accent bg-transparent px-2 text-[12.5px] outline-none"
          />
        ) : (
          <button type="button" onClick={() => setNaming(true)} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink">
            <FolderPlus size={13} /> New folder
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6">
          <AddTaskRow day={BACKLOG} folderId={activeFolder?.id} placeholder={activeFolder ? `Add task to ${activeFolder.name}` : 'Add task'} />
          {BUCKETS.map((bucket) => {
            const tasks = ordered[bucketListId(bucket.id)] ?? [];
            return (
              <section key={bucket.id} aria-label={bucket.label} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[13px] font-semibold">{bucket.label}</h2>
                  <span className="tabular text-[12px] text-ink-3">{tasks.length}</span>
                </div>
                <TaskList listId={bucketListId(bucket.id)} tasks={tasks} className={tasks.length === 0 ? 'rounded-lg border border-dashed border-line' : ''} />
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
