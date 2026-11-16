import { db, getSettings } from '../db';
import type { Settings } from '../types';

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await db.meta.put({ key: 'settings', value: next });
  return next;
}
