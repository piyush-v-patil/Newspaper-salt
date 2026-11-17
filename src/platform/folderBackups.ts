import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { backupFileName } from '@/domain/backupPolicy';
import type { BackupStore } from './types';

const FOLDER_KEY = 'pi-backup-folder';

/** "life-of-pi-2026-11-17-0930.json" (or "-0930-2.json") back to its time. */
export function timeFromName(name: string): number | null {
  const match = name.match(/^life-of-pi-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(?:-\d+)?\.json$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

async function folder(): Promise<string> {
  try {
    const chosen = localStorage.getItem(FOLDER_KEY);
    if (chosen) return chosen;
  } catch {
    /* storage unavailable; use the default */
  }
  return invoke<string>('backup_default_dir');
}

/** Backups as files in a folder on this computer: Documents\\Life Of Pi Backups unless another is chosen. */
export const folderBackups: BackupStore = {
  location: folder,
  async chooseLocation() {
    const picked = await open({ directory: true, multiple: false, defaultPath: await folder(), title: 'Choose where backups go' });
    if (typeof picked !== 'string') return null;
    try {
      localStorage.setItem(FOLDER_KEY, picked);
    } catch {
      /* remembered for this session only */
    }
    return picked;
  },
  async list() {
    const dir = await folder();
    const files = await invoke<{ name: string; size: number }[]>('backup_list', { dir });
    return files.flatMap((f) => {
      const at = timeFromName(f.name);
      return at === null ? [] : [{ id: f.name, at, size: f.size }];
    });
  },
  async write(at, text) {
    const dir = await folder();
    const taken = new Set((await invoke<{ name: string }[]>('backup_list', { dir })).map((f) => f.name));
    let name = backupFileName(at);
    for (let n = 2; taken.has(name); n++) name = backupFileName(at).replace('.json', `-${n}.json`);
    await invoke('backup_write', { dir, name, text });
  },
  async read(id) {
    return invoke<string>('backup_read', { dir: await folder(), name: id });
  },
  async remove(id) {
    await invoke('backup_delete', { dir: await folder(), name: id });
  },
};
