import type { SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { TABLES } from '@/data/backup';
import { db } from '@/data/db';
import { runBackup } from '@/data/autoBackup';
import { now } from '@/domain/clock';
import { Outbox, trackChanges } from './changes';
import { markEverything, replaceWithRemote, syncOnce, type SyncState } from './engine';
import { supabase, supabaseTransport } from './supabase';
import { WEB_APP_URL } from './config';
import { BASE } from '@/app/appPath';
import { platform } from '@/platform';
import type { RemoteRow, SyncTransport } from './transport';

export interface SyncStatus {
  configured: boolean;
  user: { id: string; email: string } | null;
  phase: 'idle' | 'syncing' | 'error';
  lastSyncedAt: number | null;
  error: string | null;
  /** Both this device and the account already have data: the person picks what happens. */
  needsChoice: boolean;
  choice: { account: Holdings; device: Holdings } | null;
}

export const useSyncStatus = create<SyncStatus>(() => ({
  configured: supabase() !== null,
  user: null,
  phase: 'idle',
  lastSyncedAt: null,
  error: null,
  needsChoice: false,
  choice: null,
}));

/** Changes made on this device that have not reached the account yet. */
export const outbox = new Outbox('pi-sync-outbox');
trackChanges(db, TABLES, outbox);
// A saved sign-in means changes count from the very first moment, before the session has finished loading.
try {
  outbox.tracking = useSyncStatus.getState().configured && localStorage.getItem('pi-auth') !== null;
} catch {
  /* storage blocked: no saved sign-in */
}

interface DeviceLink extends SyncState {
  /** True once this device has joined the account (uploaded, downloaded or combined). */
  linked: boolean;
}

const linkKey = (userId: string) => `pi-sync-link:${userId}`;
function readLink(userId: string): DeviceLink {
  try {
    return { cursor: 0, linked: false, ...(JSON.parse(localStorage.getItem(linkKey(userId)) ?? '{}') as Partial<DeviceLink>) };
  } catch {
    return { cursor: 0, linked: false };
  }
}
function writeLink(userId: string, link: DeviceLink): void {
  try {
    localStorage.setItem(linkKey(userId), JSON.stringify(link));
  } catch {
    /* kept in memory for this session */
  }
}

/** Forgets that this device has joined the account, so the next start downloads the account's data again. */
export function unlinkDevice(): void {
  const user = useSyncStatus.getState().user;
  if (user) writeLink(user.id, { cursor: 0, linked: false });
  outbox.clear();
}

let transport: SyncTransport | null = null;
let running: Promise<void> | null = null;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** What a side holds, to decide what a first sign-in does and to show in the choice. */
export interface Holdings {
  tasks: number;
  setUp: boolean;
}
const meaningful = (h: Holdings) => h.tasks > 0 || h.setUp;

async function deviceHoldings(): Promise<Holdings> {
  const profile = (await db.meta.get('profile'))?.value as { onboardingCompletedAt?: number | null } | undefined;
  return { tasks: await db.tasks.where('state').equals('active').count(), setUp: !!profile?.onboardingCompletedAt };
}

async function accountRows(): Promise<RemoteRow[]> {
  const rows: RemoteRow[] = [];
  for (let since = 0; ; ) {
    const page = await transport!.pull(since, 1000);
    rows.push(...page);
    if (page.length < 1000) return rows;
    since = page[page.length - 1].seq;
  }
}

function accountHoldings(rows: RemoteRow[]): Holdings {
  const live = rows.filter((r) => !r.deleted);
  const tasks = live.filter((r) => r.tbl === 'tasks' && (r.data as { state?: string })?.state === 'active').length;
  const profile = live.find((r) => r.tbl === 'meta' && r.id === 'profile')?.data as { value?: { onboardingCompletedAt?: number | null } } | undefined;
  return { tasks, setUp: !!profile?.value?.onboardingCompletedAt };
}

/** This device's data becomes the account's: everything here is sent, and anything else in the account removed. */
async function uploadOver(rows: RemoteRow[]): Promise<void> {
  const at = now();
  await markEverything(db, outbox, TABLES, at);
  // Records only the account has (a blank starter profile's channels, say) are sent as deletions.
  outbox.noteAll(rows.filter((r) => !r.deleted).map((r) => ({ tbl: r.tbl, id: r.id, changedAt: at })));
}

/**
 * First sign-in on this device. Whichever side has real data (tasks, or
 * finished setup) wins; when both do, the person chooses.
 */
async function joinAccount(userId: string): Promise<void> {
  const rows = await accountRows();
  const account = accountHoldings(rows);
  const device = await deviceHoldings();
  if (!meaningful(account)) {
    await uploadOver(rows);
    writeLink(userId, { cursor: 0, linked: true });
  } else if (!meaningful(device)) {
    const state = await replaceWithRemote(db, transport!, outbox, TABLES);
    writeLink(userId, { ...state, linked: true });
  } else {
    useSyncStatus.setState({ needsChoice: true, choice: { account, device } });
  }
}

/** One round of sync, if signed in. Never runs twice at once. */
export function syncNow(): Promise<void> {
  if (running) return running;
  const { user, needsChoice } = useSyncStatus.getState();
  if (!user || !transport || needsChoice) return Promise.resolve();
  running = (async () => {
    useSyncStatus.setState({ phase: 'syncing' });
    try {
      let link = readLink(user.id);
      if (!link.linked) {
        await joinAccount(user.id);
        if (useSyncStatus.getState().needsChoice) return void useSyncStatus.setState({ phase: 'idle' });
        link = readLink(user.id);
      }
      const result = await syncOnce(db, transport!, outbox, link, TABLES);
      writeLink(user.id, { ...result.state, linked: true });
      useSyncStatus.setState({ phase: 'idle', lastSyncedAt: now(), error: null });
    } catch (error) {
      useSyncStatus.setState({ phase: 'error', error: navigator.onLine === false ? 'Offline. Changes will sync when you are back online.' : message(error) });
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Both had data: keep the account's (this device's data is backed up first) or combine the two. */
export async function resolveFirstSync(choice: 'account' | 'combine'): Promise<void> {
  const user = useSyncStatus.getState().user;
  if (!user || !transport) return;
  if (choice === 'account') {
    await runBackup('safety');
    const state = await replaceWithRemote(db, transport, outbox, TABLES);
    writeLink(user.id, { ...state, linked: true });
  } else {
    await adoptMatchingNames(await accountRows());
    await markEverything(db, outbox, TABLES, now());
    writeLink(user.id, { cursor: 0, linked: true });
  }
  useSyncStatus.setState({ needsChoice: false, choice: null });
  await syncNow();
}

function setUser(sb: SupabaseClient, session: { user: { id: string; email?: string } } | null): void {
  const user = session ? { id: session.user.id, email: session.user.email ?? '' } : null;
  const previous = useSyncStatus.getState().user;
  outbox.tracking = user !== null;
  transport = user ? supabaseTransport(sb) : null;
  if (user?.id === previous?.id) return;
  useSyncStatus.setState({ user, needsChoice: false, error: null, phase: 'idle' });
  if (user) void syncNow();
}

let started = false;
/** Restores a saved sign-in and follows sign-ins and sign-outs. */
export function startSync(): void {
  const sb = supabase();
  if (!sb || started) return;
  started = true;
  void sb.auth.getSession().then(({ data }) => setUser(sb, data.session));
  sb.auth.onAuthStateChange((_event, session) => setUser(sb, session));
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return 'Sync is not set up in this version of the app.';
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  return error ? error.message : null;
}

/** Creates an account. Returns a note to show (such as "check your email"), or an error. */
export async function signUp(email: string, password: string): Promise<{ error: string | null; note: string | null }> {
  const sb = supabase();
  if (!sb) return { error: 'Sync is not set up in this version of the app.', note: null };
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: confirmUrl() } });
  if (error) return { error: error.message, note: null };
  // Supabase answers a sign-up for an existing email with a user that has no identities (and sends nothing useful).
  if (data.user && data.user.identities?.length === 0) {
    return { error: 'There is already an account with this email. Sign in with its password instead.', note: null };
  }
  return { error: null, note: data.session ? null : 'Check your email and click the link to confirm your account, then come back here and sign in.' };
}

/** The confirmation link brings you back to this web app, or to the published one from the Windows app. */
function confirmUrl(): string {
  return platform.kind === 'web' ? new URL(BASE, location.origin).href : WEB_APP_URL;
}

/** Sends the confirmation email again. */
export async function resendConfirmation(email: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return 'Sync is not set up in this version of the app.';
  const { error } = await sb.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmUrl() } });
  return error ? error.message : null;
}

/** Signs out. This device keeps its data; it simply stops syncing. */
export async function signOut(): Promise<void> {
  if (!useSyncStatus.getState().needsChoice) await syncNow();
  useSyncStatus.setState({ needsChoice: false, choice: null });
  outbox.tracking = false;
  outbox.clear();
  await supabase()?.auth.signOut();
}

/**
 * Before combining: a channel or context here with the same name as one in
 * the account takes the account's id, so combining does not leave two
 * "#work" channels. Everything pointing at it follows.
 */
async function adoptMatchingNames(rows: RemoteRow[]): Promise<void> {
  const live = rows.filter((r) => !r.deleted);
  const byName = (tbl: string) => new Map(live.filter((r) => r.tbl === tbl).map((r) => [(r.data as { name: string }).name.toLowerCase(), r.data as { id: string }]));
  const remoteContexts = byName('contexts');
  const remoteChannels = byName('channels');
  await db.transaction('rw', [db.contexts, db.channels, db.tasks, db.events, db.objectives, db.series, db.eventSeries], async () => {
    const contextIds = new Map<string, string>();
    for (const context of await db.contexts.toArray()) {
      const match = remoteContexts.get(context.name.toLowerCase());
      if (match && match.id !== context.id) contextIds.set(context.id, match.id);
    }
    for (const [from, to] of contextIds) {
      await db.channels.where('contextId').equals(from).modify({ contextId: to });
      await db.contexts.delete(from);
    }
    const channelIds = new Map<string, string>();
    for (const channel of await db.channels.toArray()) {
      const match = remoteChannels.get(channel.name.toLowerCase());
      if (match && match.id !== channel.id) channelIds.set(channel.id, match.id);
    }
    for (const [from, to] of channelIds) {
      await db.tasks.filter((t) => t.channelId === from).modify({ channelId: to });
      await db.events.filter((e) => e.channelId === from).modify({ channelId: to });
      await db.objectives.filter((o) => o.channelId === from).modify({ channelId: to });
      await db.series.filter((x) => x.template.channelId === from).modify((x) => void (x.template.channelId = to));
      await db.eventSeries.filter((x) => x.template.channelId === from).modify((x) => void (x.template.channelId = to));
      await db.channels.delete(from);
    }
  });
}
