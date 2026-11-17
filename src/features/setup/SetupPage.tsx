import { useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToday } from '@/app/useToday';
import { createChannel } from '@/data/commands/channels';
import { updateProfile } from '@/data/commands/profile';
import { updateSettings } from '@/data/commands/settings';
import { useChannels, useContexts, useProfile, useSettings } from '@/data/ReferenceData';
import type { Context, DaySchedule } from '@/data/types';
import { nowMinutes } from '@/domain/clock';
import { formatClock, formatMinutes, shiftDay } from '@/domain/dates';
import { relativeDayLabel } from '@/domain/dayLabels';
import { EVENING_FROM_MIN } from '@/domain/rituals';
import { AccountForm } from '@/features/settings/AccountSettings';
import { useSyncStatus } from '@/sync/controller';
import { CommitmentsEditor, isValidCommitment, saveCommitments, type Commitment } from './Commitments';

const STEPS = 6;
// Monday first.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Suggested channels for each kind of context. The first in each list already exists. */
const SUGGESTIONS: Record<'work' | 'personal', string[]> = {
  work: ['work', 'meetings', 'deep-work', 'admin', 'email'],
  personal: ['personal', 'health', 'home', 'errands', 'learning'],
};

const toTime = (min: number) => formatClock(min, '24h');
const fromTime = (value: string): number | null => {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
/** A realistic daily capacity: the working day less lunch, breaks and the unplanned. */
const suggestedThreshold = (startMin: number, endMin: number) => Math.max(60, Math.round((endMin - startMin - 150) / 30) * 30);

const input = 'rounded-lg border border-line bg-surface px-3 py-2 text-[15px] outline-none transition-colors focus:border-accent';
const primary = 'h-10 rounded-lg bg-ink px-5 text-[14px] font-medium text-canvas transition-opacity disabled:opacity-35';

function Screen({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight [text-wrap:balance]">{title}</h1>
        {lead && <p className="text-[15px] leading-relaxed text-ink-2">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] text-ink-3">{hint}</span>}
    </label>
  );
}

function ChannelChips({ context, kind, picked, onToggle }: { context: Context; kind: 'work' | 'personal'; picked: Set<string>; onToggle: (name: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">{context.name}</span>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS[kind].map((name, i) => {
          const on = picked.has(name);
          // The first channel in each context always exists.
          const locked = i === 0;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              disabled={locked}
              onClick={() => onToggle(name)}
              className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-hover'
              } disabled:cursor-default`}
            >
              {on && <Check size={12} strokeWidth={3} />}#{name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** On the first screen: someone who already uses the app elsewhere signs in and gets their data instead of starting over. */
function SignInInstead() {
  const configured = useSyncStatus((s) => s.configured);
  const user = useSyncStatus((s) => s.user);
  const [open, setOpen] = useState(false);
  if (!configured) return null;
  const box = 'mx-auto -mt-8 w-full max-w-[520px] px-6 pb-16';
  if (user) return <p className={`${box} text-[13px] text-ink-2`}>Signed in as {user.email}. Fetching your data…</p>;
  return (
    <div className={box}>
      <div className="border-t border-line pt-5">
      {open ? (
        <AccountForm compact />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-[13.5px] text-accent hover:underline">
          Already use Life Of Pi on another device? Sign in
        </button>
      )}
      </div>
    </div>
  );
}

/** First run: a name, the shape of the workday, channels, and when to plan. Then straight into a first plan. */
export function SetupPage() {
  const navigate = useNavigate();
  const profile = useProfile();
  const settings = useSettings();
  const contexts = useContexts();
  const channels = useChannels();
  const current = useToday();
  const [step, setStep] = useState(Math.min(profile.setupStep, STEPS - 1));

  // Step 0
  const [name, setName] = useState(profile.name);
  // Step 1
  const weekday = settings.schedule[1];
  const [startMin, setStartMin] = useState(weekday.startMin);
  const [endMin, setEndMin] = useState(weekday.endMin);
  const [workdays, setWorkdays] = useState<number[]>(() => {
    const available = settings.schedule.flatMap((d, i) => (d.available ? [i] : []));
    // A fresh profile is available every day; suggest Monday to Friday.
    return available.length === 7 ? [1, 2, 3, 4, 5] : available;
  });
  const [thresholdMin, setThresholdMin] = useState<number | null>(null);
  const threshold = thresholdMin ?? suggestedThreshold(startMin, endMin);
  // Step 2
  const [picked, setPicked] = useState<Set<string>>(() => new Set([...channels.map((c) => c.name), 'work', 'personal']));
  // Step 3
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  // Step 4
  const [planningMin, setPlanningMin] = useState(settings.planningMin);
  const [remind, setRemind] = useState(settings.autoPlanning);

  const evening = new Date().getHours() * 60 >= EVENING_FROM_MIN;
  const work = contexts.find((c) => !c.isPersonal);
  const personal = contexts.find((c) => c.isPersonal);
  const hoursValid = endMin > startMin && workdays.length > 0;

  useEffect(() => {
    if (profile.onboardingCompletedAt !== null) void navigate({ to: '/', replace: true });
  }, [profile.onboardingCompletedAt, navigate]);

  const go = (next: number) => {
    setStep(next);
    void updateProfile({ setupStep: next });
  };

  async function saveStep() {
    if (step === 0) await updateProfile({ name: name.trim() });
    if (step === 1) {
      const schedule: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({ available: workdays.includes(i), startMin, endMin }));
      await updateSettings({ schedule, workloadThresholdMin: threshold });
    }
    if (step === 2) {
      for (const [context, kind] of [
        [work, 'work'],
        [personal, 'personal'],
      ] as const) {
        if (!context) continue;
        for (const channelName of SUGGESTIONS[kind]) if (picked.has(channelName)) await createChannel(channelName, context.id);
      }
    }
    if (step === 3) {
      await saveCommitments(commitments, current);
      // Saved as events now; going back and on again must not add them twice.
      setCommitments([]);
    }
    if (step === 4) await updateSettings({ planningMin, autoPlanning: remind });
    go(step + 1);
  }

  const startPlan = async (day: string) => {
    await updateProfile({ setupStep: STEPS - 1 });
    await navigate({ to: '/plan', search: { date: day } });
  };

  const canContinue =
    step === 0 ? name.trim().length > 0 : step === 1 ? hoursValid : step === 3 ? commitments.every((c) => !c.title.trim() || isValidCommitment(c)) : true;
  const greetingName = name.trim() || profile.name;
  const tomorrow = shiftDay(current, 1);
  const planEvening = useMemo(() => planningMin >= EVENING_FROM_MIN, [planningMin]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center justify-between px-8">
        <span className="text-[15px] font-semibold tracking-tight">Life Of Pi</span>
        <ol aria-label={`Step ${step + 1} of ${STEPS}`} className="flex gap-1.5">
          {Array.from({ length: STEPS }, (_, i) => (
            <li key={i} className={`h-1 w-8 rounded-full transition-colors duration-300 ${i <= step ? 'bg-accent' : 'bg-hover'}`} />
          ))}
        </ol>
        <span className="w-[72px]" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form
          key={step}
          onSubmit={(e) => {
            e.preventDefault();
            if (canContinue && step < STEPS - 1) void saveStep();
          }}
          className="mx-auto flex w-full max-w-[520px] animate-card flex-col gap-8 px-6 pb-16 pt-[9vh]"
        >
          {step === 0 && (
            <Screen title="Welcome to Life Of Pi" lead="A calm way to plan each day, do the work, and stop when you said you would. Setup takes about two minutes, and ends with your first plan.">
              <Field label="What should we call you?">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={input} autoComplete="given-name" />
              </Field>
            </Screen>
          )}

          {step === 1 && (
            <Screen
              title={greetingName ? `What does a workday look like, ${greetingName}?` : 'What does a workday look like?'}
              lead="Planning and the calendar work inside these hours. You can change them per day later in Settings."
            >
              <div className="flex gap-4">
                <Field label="Start">
                  <input type="time" aria-label="Start of workday" value={toTime(startMin)} onChange={(e) => setStartMin(fromTime(e.target.value) ?? startMin)} className={input} />
                </Field>
                <Field label="End">
                  <input type="time" aria-label="End of workday" value={toTime(endMin)} onChange={(e) => setEndMin(fromTime(e.target.value) ?? endMin)} className={input} />
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium">Which days do you work?</span>
                <div role="group" aria-label="Workdays" className="flex gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = workdays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setWorkdays(on ? workdays.filter((x) => x !== d) : [...workdays, d])}
                        className={`h-9 w-12 rounded-lg border text-[13px] transition-colors ${on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-hover'}`}
                      >
                        {WEEKDAY_LABELS[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field
                label="How much focused work fits in a day?"
                hint={`Your workload limit. Most people plan well under their hours: lunch, breaks and the unexpected take the rest. ${
                  endMin > startMin ? `Suggested for a ${formatMinutes(endMin - startMin)} day: ${formatMinutes(suggestedThreshold(startMin, endMin))}.` : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={16}
                    step={0.5}
                    aria-label="Workload limit in hours"
                    value={threshold / 60}
                    onChange={(e) => setThresholdMin(Math.round(Math.max(0.5, Math.min(16, Number(e.target.value) || 0)) * 60))}
                    className={`${input} w-[96px]`}
                  />
                  <span className="text-[14px] text-ink-2">hours</span>
                </div>
              </Field>
              {!hoursValid && <p className="text-[13px] text-over">{workdays.length === 0 ? 'Pick at least one workday.' : 'The end of the day has to come after the start.'}</p>}
            </Screen>
          )}

          {step === 2 && (
            <Screen
              title="Sort your work into channels"
              lead="A channel is a broad area of work, like #meetings or #health. Keep it to a handful; you can add more as you go by typing # in a task."
            >
              {work && <ChannelChips context={work} kind="work" picked={picked} onToggle={(n) => setPicked((p) => new Set(p.has(n) ? [...p].filter((x) => x !== n) : [...p, n]))} />}
              {personal && (
                <ChannelChips context={personal} kind="personal" picked={picked} onToggle={(n) => setPicked((p) => new Set(p.has(n) ? [...p].filter((x) => x !== n) : [...p, n]))} />
              )}
              <p className="text-[12.5px] text-ink-3">Personal channels never count toward your workload limit.</p>
            </Screen>
          )}

          {step === 3 && (
            <Screen
              title="What is fixed in your week?"
              lead="Add the things that happen at the same time every week, like lunch or a stand-up. They go on your calendar, and planning works around them. You can skip this."
            >
              <CommitmentsEditor items={commitments} onChange={setCommitments} />
            </Screen>
          )}

          {step === 4 && (
            <Screen title="When do you plan your day?" lead="Life Of Pi will offer to plan at this time. Morning planners plan the same day; from 3 PM on, you plan tomorrow instead.">
              <Field label="Planning time" hint={planEvening ? 'Evening planning: you will plan the next day.' : 'Morning planning: you will plan the same day.'}>
                <input type="time" aria-label="Planning time" value={toTime(planningMin)} onChange={(e) => setPlanningMin(fromTime(e.target.value) ?? planningMin)} className={`${input} w-[140px]`} />
              </Field>
              <label className="flex items-center gap-2.5 text-[14px]">
                <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Remind me when it is time to plan
              </label>
              <p className="text-[13px] text-ink-2">
                Your day ends at {formatClock(endMin > startMin ? endMin : 17 * 60, settings.timeFormat)}. That is when the shutdown ritual is offered.
              </p>
            </Screen>
          )}

          {step === 5 && (
            <Screen
              title={greetingName ? `Let’s plan your first day, ${greetingName}` : 'Let’s plan your first day'}
              lead="You will add what you want to get done, see whether it fits, and put it in order. It takes a few minutes."
            >
              <div className="flex flex-col gap-2.5">
                {[
                  { day: current, label: `Plan ${relativeDayLabel(current, current).toLowerCase()}`, note: 'Make the most of what is left of today.', suggested: !evening },
                  { day: tomorrow, label: 'Plan tomorrow', note: 'Good for the afternoon or evening.', suggested: evening },
                ].map((option) => (
                  <button
                    key={option.day}
                    type="button"
                    onClick={() => void startPlan(option.day)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-colors hover:border-accent ${option.suggested ? 'border-line-strong' : 'border-line'}`}
                  >
                    <span className="flex flex-col">
                      <span className="text-[15px] font-medium">{option.label}</span>
                      <span className="text-[13px] text-ink-3">{option.note}</span>
                    </span>
                    {option.suggested && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-accent">Suggested</span>}
                  </button>
                ))}
              </div>
            </Screen>
          )}

          {step < STEPS - 1 && (
            <div className="flex items-center justify-between">
              {step > 0 ? (
                <button type="button" onClick={() => go(step - 1)} className="h-10 rounded-lg px-3 text-[14px] text-ink-2 hover:bg-hover">
                  Back
                </button>
              ) : (
                <span />
              )}
              <button type="submit" disabled={!canContinue} className={primary}>
                {step === 0 ? 'Get started' : step === 3 && commitments.filter((c) => c.title.trim()).length === 0 ? 'Skip' : 'Continue'}
              </button>
            </div>
          )}
          {step === STEPS - 1 && (
            <button type="button" onClick={() => go(step - 1)} className="h-10 self-start rounded-lg px-3 text-[14px] text-ink-2 hover:bg-hover">
              Back
            </button>
          )}
        </form>
        {step === 0 && <SignInInstead />}
      </div>
      <p className="sr-only" aria-live="polite">
        {nowMinutes() >= 0 && `Step ${step + 1} of ${STEPS}`}
      </p>
    </div>
  );
}
