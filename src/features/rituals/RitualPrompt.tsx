import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { notifyIfAway } from '@/app/useDesktop';
import { useNow } from '@/app/useNow';
import { useRunningTimer } from '@/data/queries';
import { useProfile, useSettings } from '@/data/ReferenceData';
import { ritualToOffer } from '@/domain/rituals';
import { useRitualStatus, useSnoozes, useWeeklyStatus } from './ritualStatus';

const HOUR = 60 * 60 * 1000;

type Offer = 'plan' | 'shutdown' | 'weekly-plan' | 'weekly-review';

const COPY: Record<Offer, { title: string; body: string; start: string; later: string; skip: string; to: '/plan' | '/shutdown' | '/weekly/plan' | '/weekly/review' }> = {
  plan: { title: 'Ready to plan?', body: 'A few minutes now decides what today is for.', start: 'Plan my day', later: 'Later', skip: 'Skip today', to: '/plan' },
  shutdown: {
    title: 'Time to shut down',
    body: 'Take a few minutes to look back at today and close it out.',
    start: 'Start shutdown',
    later: 'In 30 minutes',
    skip: 'Not today',
    to: '/shutdown',
  },
  'weekly-plan': {
    title: 'Time to plan the week',
    body: 'Pick the few objectives that would make this week a good one.',
    start: 'Plan my week',
    later: 'Later',
    skip: 'Not today',
    to: '/weekly/plan',
  },
  'weekly-review': {
    title: 'Time to review the week',
    body: 'See where the time went and how the objectives turned out.',
    start: 'Review my week',
    later: 'Later',
    skip: 'Not today',
    to: '/weekly/review',
  },
};
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
  const weekly = useWeeklyStatus();
  const snoozes = useSnoozes();
  const running = useRunningTimer();
  const nowMs = useNow(20_000);
  const immersive = useRouterState({ select: (s) => /^\/(focus|plan|shutdown|weekly|welcome|setup)/.test(s.location.pathname) });

  const planDue = settings.autoPlanning && status.plan === 'due' && nowMs >= snoozes.planSnoozedUntil && snoozes.planSkippedFor !== status.planDay;
  const shutdownDue =
    settings.autoShutdown && status.shutdown === 'due' && nowMs >= snoozes.shutdownSnoozedUntil && snoozes.shutdownDismissedFor !== status.today;
  const weeklyPlanDue =
    settings.weeklyPlan.auto && weekly.plan === 'due' && nowMs >= snoozes.weeklyPlanSnoozedUntil && snoozes.weeklyPlanSkippedFor !== status.today;
  const weeklyReviewDue =
    settings.weeklyReview.auto && weekly.review === 'due' && nowMs >= snoozes.weeklyReviewSnoozedUntil && snoozes.weeklyReviewSkippedFor !== status.today;

  // Prompts begin once setup is finished; before that, setup itself leads into the first plan.
  // Close the day first; then look back at the week, set it up, and plan the day.
  const daily = ritualToOffer(planDue, shutdownDue);
  const offer: Offer | null =
    profile.onboardingCompletedAt === null || immersive || running
      ? null
      : daily === 'shutdown'
        ? 'shutdown'
        : weeklyReviewDue
          ? 'weekly-review'
          : weeklyPlanDue
            ? 'weekly-plan'
            : daily;

  const later = () => {
    if (offer === 'plan') useSnoozes.setState({ planSnoozedUntil: nowMs + HOUR });
    else if (offer === 'shutdown') useSnoozes.setState({ shutdownSnoozedUntil: nowMs + HOUR / 2 });
    else if (offer === 'weekly-plan') useSnoozes.setState({ weeklyPlanSnoozedUntil: nowMs + HOUR });
    else useSnoozes.setState({ weeklyReviewSnoozedUntil: nowMs + HOUR });
  };
  const skip = () => {
    if (offer === 'plan') useSnoozes.setState({ planSkippedFor: status.planDay });
    else if (offer === 'shutdown') useSnoozes.setState({ shutdownDismissedFor: status.today });
    else if (offer === 'weekly-plan') useSnoozes.setState({ weeklyPlanSkippedFor: status.today });
    else useSnoozes.setState({ weeklyReviewSkippedFor: status.today });
  };
  const copy = offer ? COPY[offer] : COPY.plan;

  // If the app is in the background when a ritual comes due, say so outside it too.
  useEffect(() => {
    if (offer) notifyIfAway(COPY[offer].title, COPY[offer].body);
  }, [offer]);
  const greeting = `${profile.name ? `${greet(nowMs)}, ${profile.name}` : greet(nowMs)}.`;

  return (
    <Dialog.Root open={offer !== null} onOpenChange={(open) => !open && later()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content className="fixed left-1/2 top-[26%] z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-pop outline-none data-[state=open]:animate-pop">
          <div className="flex flex-col gap-1.5">
            <Dialog.Title className="text-[19px] font-semibold tracking-tight">{offer === 'plan' ? `${greeting} ${copy.title}` : copy.title}</Dialog.Title>
            <Dialog.Description className="text-[14px] text-ink-2">{copy.body}</Dialog.Description>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={primary} onClick={() => void navigate({ to: copy.to })}>
              {copy.start}
            </button>
            <button type="button" className={quiet} onClick={later}>
              {copy.later}
            </button>
            <button type="button" className={quiet} onClick={skip}>
              {copy.skip}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function greet(ms: number): string {
  const hour = new Date(ms).getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
