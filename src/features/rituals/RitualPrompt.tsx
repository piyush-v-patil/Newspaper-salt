import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useNow } from '@/app/useNow';
import { useRunningTimer } from '@/data/queries';
import { useProfile, useSettings } from '@/data/ReferenceData';
import { ritualToOffer } from '@/domain/rituals';
import { useRitualStatus, useSnoozes } from './ritualStatus';

const HOUR = 60 * 60 * 1000;
const primary = 'h-8 rounded-md bg-ink px-3.5 text-[13px] font-medium text-canvas';
const quiet = 'h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover';

/**
 * Offers the daily rituals when their time comes. It waits for a running
 * timer to stop rather than interrupt it, and stays out of the way of
 * anything already full-screen.
 */
export function RitualPrompt() {
  const navigate = useNavigate();
  const settings = useSettings();
  const profile = useProfile();
  const status = useRitualStatus();
  const snoozes = useSnoozes();
  const running = useRunningTimer();
  const nowMs = useNow(20_000);
  const immersive = useRouterState({ select: (s) => /^\/(focus|plan|shutdown|weekly|welcome|setup)/.test(s.location.pathname) });

  const planDue = settings.autoPlanning && status.plan === 'due' && nowMs >= snoozes.planSnoozedUntil && snoozes.planSkippedFor !== status.planDay;
  const shutdownDue =
    settings.autoShutdown && status.shutdown === 'due' && nowMs >= snoozes.shutdownSnoozedUntil && snoozes.shutdownDismissedFor !== status.today;
  // Prompts begin once setup is finished; before that, setup itself leads into the first plan.
  const offer = profile.onboardingCompletedAt === null || immersive || running ? null : ritualToOffer(planDue, shutdownDue);

  const later = () =>
    offer === 'plan' ? useSnoozes.setState({ planSnoozedUntil: nowMs + HOUR }) : useSnoozes.setState({ shutdownSnoozedUntil: nowMs + HOUR / 2 });
  const skip = () =>
    offer === 'plan' ? useSnoozes.setState({ planSkippedFor: status.planDay }) : useSnoozes.setState({ shutdownDismissedFor: status.today });

  return (
    <Dialog.Root open={offer !== null} onOpenChange={(open) => !open && later()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content className="fixed left-1/2 top-[26%] z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-pop outline-none data-[state=open]:animate-pop">
          <div className="flex flex-col gap-1.5">
            <Dialog.Title className="text-[19px] font-semibold tracking-tight">
              {offer === 'shutdown' ? 'Time to shut down' : `${profile.name ? `${greeting(nowMs)}, ${profile.name}` : greeting(nowMs)}. Ready to plan?`}
            </Dialog.Title>
            <Dialog.Description className="text-[14px] text-ink-2">
              {offer === 'shutdown'
                ? 'Take a few minutes to look back at today and close it out.'
                : 'A few minutes now decides what today is for.'}
            </Dialog.Description>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={primary} onClick={() => void navigate({ to: offer === 'shutdown' ? '/shutdown' : '/plan' })}>
              {offer === 'shutdown' ? 'Start shutdown' : 'Plan my day'}
            </button>
            <button type="button" className={quiet} onClick={later}>
              {offer === 'shutdown' ? 'In 30 minutes' : 'Later'}
            </button>
            <button type="button" className={quiet} onClick={skip}>
              {offer === 'shutdown' ? 'Not today' : 'Skip today'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function greeting(ms: number): string {
  const hour = new Date(ms).getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
