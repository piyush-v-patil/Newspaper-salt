import * as Dialog from '@radix-ui/react-dialog';
import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { now } from '@/domain/clock';
import { resendConfirmation, resolveFirstSync, signIn, signOut, signUp, syncNow, useSyncStatus } from '@/sync/controller';

const field = 'h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[14px] outline-none focus:border-accent';
const primary = 'h-9 rounded-md bg-ink px-4 text-[13.5px] font-medium text-canvas disabled:opacity-40';
const button = 'h-8 rounded-md border border-line px-3 text-[13px] hover:bg-hover';

/** Email and password, to sign in or create an account. */
export function AccountForm({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [canResend, setCanResend] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setNote(null);
    setCanResend(false);
    if (mode === 'in') {
      const problem = await signIn(email, password);
      setError(problem && /not confirmed/i.test(problem) ? 'This account isn’t confirmed yet. Click the link in the email we sent, then sign in.' : problem);
      setCanResend(!!problem && /not confirmed/i.test(problem));
    } else {
      const result = await signUp(email, password);
      setError(result.error);
      setNote(result.note);
      setCanResend(result.note !== null);
    }
    setBusy(false);
  }

  async function resend() {
    setBusy(true);
    const problem = await resendConfirmation(email);
    setError(problem);
    setNote(problem ? null : `Sent again to ${email.trim()}. It can take a minute; check spam too.`);
    setBusy(false);
  }

  return (
    <form
      aria-label={mode === 'in' ? 'Sign in' : 'Create an account'}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className={`flex flex-col gap-2.5 ${compact ? '' : 'max-w-[340px]'}`}
    >
      <input type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      <input
        type="password"
        required
        minLength={8}
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        placeholder={mode === 'in' ? 'Password' : 'Password (8 characters or more)'}
        aria-label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={field}
      />
      {error && (
        <p role="alert" className="text-[12.5px] text-over">
          {error}
        </p>
      )}
      {note && <p className="text-[12.5px] text-done">{note}</p>}
      {canResend && (
        <button type="button" disabled={busy} onClick={() => void resend()} className="self-start text-[12.5px] text-accent hover:underline disabled:opacity-50">
          Resend the confirmation email
        </button>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={primary}>
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="text-[12.5px] text-accent hover:underline">
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </div>
    </form>
  );
}

/** After a confirmation link that did not work: what happened, in plain words. */
function LinkProblem() {
  const [reason] = useState(() => {
    try {
      const value = sessionStorage.getItem('pi-auth-error');
      sessionStorage.removeItem('pi-auth-error');
      return value;
    } catch {
      return null;
    }
  });
  if (!reason) return null;
  return (
    <p role="alert" className="rounded-lg border border-line bg-hover px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
      That confirmation link didn’t work ({reason.toLowerCase()}). A link works only once: if you already clicked it, your account is confirmed, so just sign in below. Otherwise, sign in and choose “Resend the confirmation email”.
    </p>
  );
}

/** Settings → Account & sync. */
export function AccountSettings() {
  const status = useSyncStatus();
  if (!status.configured) {
    return <p className="text-[13px] leading-relaxed text-ink-2">Sync isn’t switched on in this version of the app yet.</p>;
  }
  if (!status.user) {
    return (
      <div className="flex flex-col gap-4">
        <LinkProblem />
        <p className="text-[13px] leading-relaxed text-ink-2">
          Sign in to keep your tasks, calendar and settings the same on every device. Everything still works offline; changes sync when you are back online.
        </p>
        <AccountForm />
      </div>
    );
  }
  const synced =
    status.phase === 'syncing'
      ? 'Syncing…'
      : status.phase === 'error'
        ? `Not synced: ${status.error}`
        : status.lastSyncedAt
          ? `Synced ${now() - status.lastSyncedAt < 10_000 ? 'just now' : `${formatDistanceToNowStrict(status.lastSyncedAt)} ago`}`
          : 'Not synced yet';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-[14px]">
          Signed in as <span className="font-medium">{status.user.email}</span>
        </p>
        <p data-testid="sync-status" className={`text-[12.5px] ${status.phase === 'error' ? 'text-over' : 'text-ink-3'}`}>
          {synced}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void syncNow()} disabled={status.phase === 'syncing'} className={`${button} disabled:opacity-50`}>
          Sync now
        </button>
        <button type="button" onClick={() => void signOut()} className={button}>
          Sign out
        </button>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-3">Signing out keeps everything on this device; it just stops syncing.</p>
    </div>
  );
}

/** Shown once, when both this device and the account already hold data. */
export function FirstSyncChoice() {
  const needsChoice = useSyncStatus((s) => s.needsChoice);
  const [busy, setBusy] = useState(false);
  const choose = async (choice: 'account' | 'combine') => {
    setBusy(true);
    await resolveFirstSync(choice);
    setBusy(false);
  };
  return (
    <Dialog.Root open={needsChoice}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="fixed left-1/2 top-[22%] z-[61] flex w-[min(460px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-pop outline-none"
        >
          <Dialog.Title className="text-[16px] font-semibold tracking-tight">This device and your account both have tasks</Dialog.Title>
          <button type="button" disabled={busy} onClick={() => void choose('account')} className="flex flex-col rounded-lg border border-line px-3 py-2.5 text-left hover:bg-hover">
            <span className="text-[14px] font-medium">Use my account’s data</span>
            <span className="text-[12.5px] text-ink-3">Replaces what is on this device. A backup of it is saved first.</span>
          </button>
          <button type="button" disabled={busy} onClick={() => void choose('combine')} className="flex flex-col rounded-lg border border-line px-3 py-2.5 text-left hover:bg-hover">
            <span className="text-[14px] font-medium">Combine both</span>
            <span className="text-[12.5px] text-ink-3">Keeps everything from both. Where the same item differs, this device’s version wins.</span>
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
