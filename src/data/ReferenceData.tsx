import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { compareKeys } from '@/domain/ordering';
import { db, getSettings } from './db';
import type { Channel, Context, Id, Settings } from './types';

interface ReferenceData {
  settings: Settings;
  channels: Channel[];
  channelMap: Map<Id, Channel>;
  contexts: Context[];
}

const Ctx = createContext<ReferenceData | null>(null);
const byOrder = (a: { order: string }, b: { order: string }) => compareKeys(a.order, b.order);

/**
 * Settings, channels and contexts are small, used everywhere, and must be
 * available the instant a picker opens. They are loaded once here and kept
 * live; the app renders only after the first read, so no component ever sees
 * them half-loaded.
 */
export function ReferenceDataProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => getSettings(), []);
  const channelRows = useLiveQuery(() => db.channels.toArray(), []);
  const contextRows = useLiveQuery(() => db.contexts.toArray(), []);

  const value = useMemo(() => {
    if (!settings || !channelRows || !contextRows) return null;
    const channels = channelRows.filter((c) => c.enabled).sort(byOrder);
    return {
      settings,
      channels,
      channelMap: new Map(channelRows.map((c) => [c.id, c])),
      contexts: contextRows.slice().sort(byOrder),
    };
  }, [settings, channelRows, contextRows]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useReferenceData(): ReferenceData {
  const value = useContext(Ctx);
  if (!value) throw new Error('ReferenceDataProvider is missing.');
  return value;
}

export const useSettings = (): Settings => useReferenceData().settings;
/** Enabled channels, in order. */
export const useChannels = (): Channel[] => useReferenceData().channels;
/** Every channel by id, including disabled ones, so old tasks still show their tag. */
export const useChannelMap = (): Map<Id, Channel> => useReferenceData().channelMap;
export const useContexts = (): Context[] => useReferenceData().contexts;
