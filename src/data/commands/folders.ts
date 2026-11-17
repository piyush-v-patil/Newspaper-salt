import { compareKeys, keyAtEdge } from '@/domain/ordering';
import { command, db } from '../db';
import type { BacklogFolder, Id } from '../types';
import { recordUndo } from '../undo';

/** Returns the folder of that name, creating it if needed. */
export const createFolder = command(async (name: string): Promise<BacklogFolder> => {
  const clean = name.trim();
  if (!clean) throw new Error('A folder needs a name.');
  const all = await db.backlogFolders.toArray();
  const existing = all.find((f) => f.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const folder: BacklogFolder = { id: crypto.randomUUID(), name: clean, order: keyAtEdge(all.map((f) => f.order).sort(compareKeys), 'bottom') };
  await db.backlogFolders.add(folder);
  return folder;
});

/** Deletes a folder. Its tasks stay in the backlog, without a folder. */
export const deleteFolder = command(async (id: Id): Promise<void> => {
  const folder = await db.backlogFolders.get(id);
  if (!folder) return;
  const inFolder = (await db.tasks.where('state').equals('active').toArray()).filter((t) => t.backlogFolderId === id).map((t) => t.id);
  await db.backlogFolders.delete(id);
  for (const taskId of inFolder) await db.tasks.update(taskId, { backlogFolderId: null });
  recordUndo(
    `Folder “${folder.name}” deleted`,
    async () => {
      await db.backlogFolders.put(folder);
      for (const taskId of inFolder) await db.tasks.update(taskId, { backlogFolderId: id });
    },
    true,
  );
});
