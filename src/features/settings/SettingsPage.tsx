import { useNavigate } from '@tanstack/react-router';
import { NavToggle } from '@/app/LeftNav';
import { useEffect, useState } from 'react';
import { updateProfile } from '@/data/commands/profile';
import { updateSettings } from '@/data/commands/settings';
import { useProfile, useSettings } from '@/data/ReferenceData';
import type { Settings } from '@/data/types';
import { formatMinutes } from '@/domain/dates';
import { SHORTCUTS } from '@/features/help/shortcuts';
import { Kbd } from '@/ui/Kbd';
import { platform } from '@/platform';
import { ChannelsSettings } from './ChannelsSettings';
import { Group, NumberInput, Row, Select, TimeInput, Toggle } from './controls';
import { DataSettings } from './DataSettings';
import { ThemePicker } from './ThemePicker';

export const SETTINGS_SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'rituals', label: 'Rituals' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'focus', label: 'Focus' },
  { id: 'channels', label: 'Channels' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'data', label: 'Your data' },
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id'];

// Monday first.
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayOptions = WEEKDAYS.map((d) => ({ value: d, label: WEEKDAY_NAMES[d] }));

function set(patch: Partial<Settings>) {
  void updateSettings(patch);
}

/** Desktop only: start with the computer, waiting in the tray. */
function LaunchAtLogin() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void platform.launchAtLogin?.get().then(setOn, () => setOn(false));
  }, []);
  return (
    <Row label="Open when you sign in" description="Starts quietly in the tray, so reminders arrive without opening the app." htmlFor="setting-autostart">
      <Toggle
        id="setting-autostart"
        label="Open when you sign in"
        checked={on ?? false}
        onChange={(next) => {
          setOn(next);
          void platform.launchAtLogin?.set(next);
        }}
      />
    </Row>
  );
}

function General() {
  const settings = useSettings();
  const profile = useProfile();
  return (
    <>
      <Group>
        <Row label="Your name" description="Used in greetings." htmlFor="setting-name">
          <input
            id="setting-name"
            key={profile.name}
            defaultValue={profile.name}
            onBlur={(e) => void updateProfile({ name: e.currentTarget.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-8 w-[180px] rounded-md border border-line bg-surface px-2 text-[13px]"
          />
        </Row>
        <Row label="Appearance" description="Shift+L switches between light and dark.">
          <Select
            label="Appearance"
            value={settings.darkMode}
            options={[
              { value: 'system', label: 'Match system' },
              { value: 'off', label: 'Light' },
              { value: 'on', label: 'Dark' },
            ]}
            onChange={(darkMode) => set({ darkMode })}
          />
        </Row>
        <ThemePicker />
        <Row label="Time format">
          <Select
            label="Time format"
            value={settings.timeFormat}
            options={[
              { value: '24h', label: '24-hour (14:30)' },
              { value: '12h', label: '12-hour (2:30 PM)' },
            ]}
            onChange={(timeFormat) => set({ timeFormat })}
          />
        </Row>
        <Row label="Week starts on">
          <Select
            label="Week starts on"
            value={settings.weekStartsOn}
            options={[
              { value: 1, label: 'Monday' },
              { value: 0, label: 'Sunday' },
            ]}
            onChange={(weekStartsOn) => set({ weekStartsOn })}
          />
        </Row>
        <Row label="Open on" description="The view the app opens on, and returns to after planning.">
          <Select
            label="Open on"
            value={settings.defaultView}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'board', label: 'Board' },
              { value: 'calendar', label: 'Calendar' },
            ]}
            onChange={(defaultView) => set({ defaultView })}
          />
        </Row>
        {platform.launchAtLogin && <LaunchAtLogin />}
        <Row label="Celebrations" description="A moment of confetti when you finish planning, shut down, or clear the day." htmlFor="setting-celebrations">
          <Toggle id="setting-celebrations" label="Celebrations" checked={settings.celebrations} onChange={(celebrations) => set({ celebrations })} />
        </Row>
      </Group>
    </>
  );
}

function Tasks() {
  const settings = useSettings();
  return (
    <Group>
      <Row label="New tasks go" description="Where a task lands when you add it to a list.">
        <Select
          label="New tasks go"
          value={settings.newTaskPosition}
          options={[
            { value: 'top', label: 'At the top' },
            { value: 'bottom', label: 'At the bottom' },
          ]}
          onChange={(newTaskPosition) => set({ newTaskPosition })}
        />
      </Row>
      <Row label="Rolled-over tasks go" description="Where yesterday’s unfinished tasks land at midnight.">
        <Select
          label="Rolled-over tasks go"
          value={settings.rolloverPosition}
          options={[
            { value: 'top', label: 'At the top' },
            { value: 'bottom', label: 'At the bottom' },
          ]}
          onChange={(rolloverPosition) => set({ rolloverPosition })}
        />
      </Row>
      <Row label="Archive stale tasks" description="A task that rolls over this many days in a row with no progress moves to the archive.">
        <Select
          label="Archive stale tasks"
          value={settings.archiveAfterDays ?? 0}
          options={[...Array.from({ length: 14 }, (_, i) => ({ value: i + 1, label: `After ${i + 1} ${i ? 'days' : 'day'}` })), { value: 0, label: 'Never' }]}
          onChange={(n) => set({ archiveAfterDays: n === 0 ? null : n })}
        />
      </Row>
      <Row label="Count planned time as actual" description="When you complete a task without tracking any time, its planned time is logged for you." htmlFor="setting-planned-actual">
        <Toggle id="setting-planned-actual" label="Count planned time as actual" checked={settings.countPlannedAsActual} onChange={(countPlannedAsActual) => set({ countPlannedAsActual })} />
      </Row>
    </Group>
  );
}

function Schedule() {
  const settings = useSettings();
  const setDay = (weekday: number, patch: Partial<Settings['schedule'][number]>) =>
    set({ schedule: settings.schedule.map((d, i) => (i === weekday ? { ...d, ...patch } : d)) });
  return (
    <>
      <Group title="Working hours">
        {WEEKDAYS.map((d) => {
          const day = settings.schedule[d];
          return (
            <Row key={d} label={WEEKDAY_NAMES[d]} description={day.available ? `${formatMinutes(Math.max(0, day.endMin - day.startMin))} working` : 'Not working'}>
              {day.available && (
                <>
                  <TimeInput label={`${WEEKDAY_NAMES[d]} start`} value={day.startMin} onChange={(startMin) => startMin < day.endMin && setDay(d, { startMin })} />
                  <span className="text-ink-3">–</span>
                  <TimeInput label={`${WEEKDAY_NAMES[d]} end`} value={day.endMin} onChange={(endMin) => endMin > day.startMin && setDay(d, { endMin })} />
                </>
              )}
              <Toggle label={`Work on ${WEEKDAY_NAMES[d]}`} checked={day.available} onChange={(available) => setDay(d, { available })} />
            </Row>
          );
        })}
      </Group>
      <Group title="Workload">
        <Row label="Daily workload limit" description="Planned work beyond this turns the day’s bar amber, then red. Personal tasks never count." htmlFor="setting-threshold">
          <NumberInput
            id="setting-threshold"
            label="Daily workload limit in hours"
            value={settings.workloadThresholdMin / 60}
            min={0.5}
            max={16}
            step={0.5}
            suffix="hours"
            onChange={(hours) => set({ workloadThresholdMin: Math.round(hours * 60) })}
          />
        </Row>
        <Row label="Different limit on some days" description="For example, a shorter Friday." htmlFor="setting-limit-by-day">
          <Toggle
            id="setting-limit-by-day"
            label="Different limit on some days"
            checked={!!settings.workloadByWeekday}
            onChange={(on) => set({ workloadByWeekday: on ? Array(7).fill(null) : undefined })}
          />
        </Row>
        {settings.workloadByWeekday &&
          WEEKDAYS.filter((d) => settings.schedule[d].available).map((d) => {
            const own = settings.workloadByWeekday?.[d] ?? null;
            return (
              <Row key={d} label={WEEKDAY_NAMES[d]} description={own === null ? 'Same as the daily limit' : undefined}>
                <NumberInput
                  label={`${WEEKDAY_NAMES[d]} workload limit in hours`}
                  value={(own ?? settings.workloadThresholdMin) / 60}
                  min={0.5}
                  max={16}
                  step={0.5}
                  suffix="hours"
                  onChange={(hours) => {
                    const next = [...(settings.workloadByWeekday ?? Array(7).fill(null))];
                    const min = Math.round(hours * 60);
                    next[d] = min === settings.workloadThresholdMin ? null : min;
                    set({ workloadByWeekday: next });
                  }}
                />
              </Row>
            );
          })}
      </Group>
    </>
  );
}

function Rituals() {
  const settings = useSettings();
  const message = settings.endOfDayMessage;
  return (
    <>
      <Group title="Daily planning">
        <Row label="Plan at" description={settings.planningMin >= 15 * 60 ? 'From 3 PM on, you plan the next day.' : 'Before 3 PM, you plan the same day.'}>
          <TimeInput label="Planning time" value={settings.planningMin} onChange={(planningMin) => set({ planningMin })} />
        </Row>
        <Row label="Offer to plan at that time" htmlFor="setting-auto-plan">
          <Toggle id="setting-auto-plan" label="Offer to plan" checked={settings.autoPlanning} onChange={(autoPlanning) => set({ autoPlanning })} />
        </Row>
        <Row label="End with a written plan" description="The last step of planning, where you read the plan back and note obstacles." htmlFor="setting-plan-summary">
          <Toggle id="setting-plan-summary" label="End with a written plan" checked={settings.planSummaryStep} onChange={(planSummaryStep) => set({ planSummaryStep })} />
        </Row>
      </Group>
      <Group title="Daily shutdown">
        <Row label="Offer to shut down" description="At the end of your working hours, set under Schedule." htmlFor="setting-auto-shutdown">
          <Toggle id="setting-auto-shutdown" label="Offer to shut down" checked={settings.autoShutdown} onChange={(autoShutdown) => set({ autoShutdown })} />
        </Row>
        <Row label="End-of-day message">
          <Select
            label="End-of-day message"
            value={message.kind}
            options={[
              { value: 'encouragement', label: 'A few kind words' },
              { value: 'custom', label: 'My own message' },
              { value: 'none', label: 'No message' },
            ]}
            onChange={(kind) => set({ endOfDayMessage: { ...message, kind } })}
          />
        </Row>
        {message.kind === 'custom' && (
          <Row label="Your message" htmlFor="setting-message">
            <input
              id="setting-message"
              key={message.text}
              defaultValue={message.text}
              placeholder="Close the laptop."
              onBlur={(e) => set({ endOfDayMessage: { ...message, text: e.currentTarget.value } })}
              className="h-8 w-[240px] rounded-md border border-line bg-surface px-2 text-[13px]"
            />
          </Row>
        )}
      </Group>
      <Group title="Weekly rituals">
        <Row label="Plan the week on">
          <Select label="Weekly planning day" value={settings.weeklyPlan.weekday} options={weekdayOptions} onChange={(weekday) => set({ weeklyPlan: { ...settings.weeklyPlan, weekday } })} />
          <TimeInput label="Weekly planning time" value={settings.weeklyPlan.min} onChange={(min) => set({ weeklyPlan: { ...settings.weeklyPlan, min } })} />
          <Toggle label="Offer to plan the week" checked={settings.weeklyPlan.auto} onChange={(auto) => set({ weeklyPlan: { ...settings.weeklyPlan, auto } })} />
        </Row>
        <Row label="Review the week on">
          <Select label="Weekly review day" value={settings.weeklyReview.weekday} options={weekdayOptions} onChange={(weekday) => set({ weeklyReview: { ...settings.weeklyReview, weekday } })} />
          <TimeInput label="Weekly review time" value={settings.weeklyReview.min} onChange={(min) => set({ weeklyReview: { ...settings.weeklyReview, min } })} />
          <Toggle label="Offer to review the week" checked={settings.weeklyReview.auto} onChange={(auto) => set({ weeklyReview: { ...settings.weeklyReview, auto } })} />
        </Row>
      </Group>
    </>
  );
}

function Calendar() {
  const settings = useSettings();
  return (
    <Group>
      <Row label="Default session length" description="How long a task with no estimate takes up when you drop it on the calendar.">
        <Select
          label="Default session length"
          value={settings.defaultSessionMin}
          options={[15, 30, 45, 60].map((m) => ({ value: m as Settings['defaultSessionMin'], label: `${m} minutes` }))}
          onChange={(defaultSessionMin) => set({ defaultSessionMin })}
        />
      </Row>
      <Row label="Gap after meetings" description="Room left free after each event and session when auto-scheduling with X.">
        <Select
          label="Gap after meetings"
          value={settings.autoScheduleGapMin}
          options={[0, 5, 10, 15].map((m) => ({ value: m as Settings['autoScheduleGapMin'], label: m ? `${m} minutes` : 'None' }))}
          onChange={(autoScheduleGapMin) => set({ autoScheduleGapMin })}
        />
      </Row>
      <Row label="Make room when sessions overlap" description="Dropping a session onto others moves them to the next free time. Hold Shift to skip it once." htmlFor="setting-conflict">
        <Toggle id="setting-conflict" label="Make room when sessions overlap" checked={settings.rescheduleOnConflict} onChange={(rescheduleOnConflict) => set({ rescheduleOnConflict })} />
      </Row>
      <Row label="Pull sessions forward when you finish early" description="Back-to-back sessions after a task you finish early move up to close the gap." htmlFor="setting-early">
        <Toggle id="setting-early" label="Pull sessions forward when you finish early" checked={settings.rescheduleOnEarlyFinish} onChange={(rescheduleOnEarlyFinish) => set({ rescheduleOnEarlyFinish })} />
      </Row>
    </Group>
  );
}

function Focus() {
  const settings = useSettings();
  const breaks = settings.breakReminders;
  return (
    <Group>
      <Row label="Open focus mode when a timer starts" htmlFor="setting-focus-timer">
        <Toggle id="setting-focus-timer" label="Open focus mode when a timer starts" checked={settings.focusOnTimerStart} onChange={(focusOnTimerStart) => set({ focusOnTimerStart })} />
      </Row>
      <Row label="Remind me to take breaks" htmlFor="setting-breaks">
        <Toggle id="setting-breaks" label="Remind me to take breaks" checked={breaks.on} onChange={(on) => set({ breakReminders: { ...breaks, on } })} />
      </Row>
      {breaks.on && (
        <>
          <Row label="Work for">
            <NumberInput label="Minutes of work between breaks" value={breaks.workMin} min={5} max={180} step={5} suffix="minutes" onChange={(workMin) => set({ breakReminders: { ...breaks, workMin } })} />
          </Row>
          <Row label="Then break for">
            <NumberInput label="Break length in minutes" value={breaks.breakMin} min={1} max={60} suffix="minutes" onChange={(breakMin) => set({ breakReminders: { ...breaks, breakMin } })} />
          </Row>
        </>
      )}
      {platform.canFloatFocusBar && (
        <Row label="Floating focus bar" description="Keeps the task in progress and its timer in a small bar above other apps. Ctrl+Shift+F puts it away." htmlFor="setting-floating">
          <Toggle id="setting-floating" label="Floating focus bar" checked={settings.floatingFocusBar} onChange={(floatingFocusBar) => set({ floatingFocusBar })} />
        </Row>
      )}
      <Row label="Chime at the planned time" description="A soft sound when a running timer reaches the task’s estimate." htmlFor="setting-sounds">
        <Toggle id="setting-sounds" label="Chime at the planned time" checked={settings.timerSounds} onChange={(timerSounds) => set({ timerSounds })} />
      </Row>
    </Group>
  );
}

function Shortcuts() {
  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
      {SHORTCUTS.map((group) => (
        <section key={group.group} className="flex flex-col gap-1.5">
          <h3 className="pb-1 text-[12px] font-medium uppercase tracking-wider text-ink-3">{group.group}</h3>
          {group.items.map((item) => (
            <div key={item.action + item.keys.join()} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-ink-2">{item.action}</span>
              <span className="flex shrink-0 gap-1">
                {item.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

const BODIES: Record<SettingsSection, () => React.ReactElement> = {
  general: General,
  tasks: Tasks,
  schedule: Schedule,
  rituals: Rituals,
  calendar: Calendar,
  focus: Focus,
  channels: ChannelsSettings,
  shortcuts: Shortcuts,
  data: DataSettings,
};

export function SettingsPage({ section = 'general' }: { section?: SettingsSection }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState<SettingsSection>(section);
  const active = SETTINGS_SECTIONS.find((s) => s.id === section) ? section : shown;
  const Body = BODIES[active];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-6">
        <NavToggle />
        <h1 className="text-[16px] font-semibold tracking-tight">Settings</h1>
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line p-2 sm:w-[180px] sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-3"
        >
          {SETTINGS_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === active ? 'page' : undefined}
              onClick={() => {
                setShown(s.id);
                void navigate({ to: '/settings', search: { section: s.id }, replace: true });
              }}
              className={`h-8 shrink-0 whitespace-nowrap rounded-md px-2.5 text-left text-[13.5px] ${s.id === active ? 'bg-hover font-medium text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink'}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div key={active} className="mx-auto w-full max-w-[720px] animate-fade px-4 py-6 sm:px-8">
            <h2 className="pb-4 text-[18px] font-semibold tracking-tight">{SETTINGS_SECTIONS.find((s) => s.id === active)?.label}</h2>
            <Body />
          </div>
        </div>
      </div>
    </div>
  );
}
