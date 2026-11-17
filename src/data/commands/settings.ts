import { command, db, getSettings } from '../db';
import type { Settings } from '../types';

export const updateSettings = command(async (patch: Partial<Settings>): Promise<Settings> => {
  const next = { ...(await getSettings()), ...patch };
  await db.meta.put({ key: 'settings', value: next });
  return next;
});
