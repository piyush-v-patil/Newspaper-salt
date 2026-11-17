import { createChannel } from '@/data/commands/channels';
import { useObjectives } from '@/data/queries';
import { useChannels, useContexts, useSettings } from '@/data/ReferenceData';
import type { BacklogPriority, DailyPriority, Id, TaskDay } from '@/data/types';
import { BACKLOG_PRIORITIES } from '@/domain/backlog';
import { today } from '@/domain/clock';
import { weekStartOf } from '@/domain/weeks';
import { PickerPanel } from './PickerPanel';
import { channelOptions, dateOptions, dueOptions, priorityOptions, timeOptions, type ChannelChoice } from './options';
import type { Day } from '@/domain/dates';

interface TimePickerProps {
  value: number | null;
  onPick: (minutes: number | null) => void;
  /** Wording for the option that clears the value. */
  clearLabel?: string;
}

export function TimePicker({ value, onPick, clearLabel }: TimePickerProps) {
  return (
    <PickerPanel label="Time" placeholder="e.g. 45 or 1h30" getOptions={(q) => timeOptions(q, value, clearLabel)} onSelect={onPick} />
  );
}

/** Resolves a channel choice to an id, creating the channel if it is new. */
export async function resolveChannel(choice: ChannelChoice): Promise<Id | null> {
  return 'create' in choice ? (await createChannel(choice.create)).id : choice.id;
}

export function ChannelPicker({ value, onPick }: { value: Id | null; onPick: (channelId: Id | null) => void }) {
  const channels = useChannels();
  const contexts = useContexts();
  return (
    <PickerPanel
      label="Channel"
      placeholder="Find or create a channel"
      getOptions={(q) => channelOptions(q, channels, contexts, value)}
      onSelect={(choice) => void resolveChannel(choice).then(onPick)}
    />
  );
}

export function DatePicker({ onPick }: { onPick: (day: TaskDay) => void }) {
  const weekStartsOn = useSettings().weekStartsOn;
  return (
    <PickerPanel label="Date" placeholder="Move to… (e.g. dec 3)" getOptions={(q) => dateOptions(q, today(), weekStartsOn)} onSelect={onPick} />
  );
}

export function DueDatePicker({ value, onPick }: { value: Day | null; onPick: (day: Day | null) => void }) {
  const weekStartsOn = useSettings().weekStartsOn;
  return (
    <PickerPanel
      label="Due date"
      placeholder="Due by… (e.g. dec 3)"
      getOptions={(q) => dueOptions(q, today(), weekStartsOn, value)}
      onSelect={onPick}
    />
  );
}

export function PriorityPicker({ onPick }: { onPick: (priority: DailyPriority) => void }) {
  return <PickerPanel label="Priority" placeholder="Set priority" getOptions={priorityOptions} onSelect={onPick} />;
}

export function BacklogPriorityPicker({ onPick }: { onPick: (priority: BacklogPriority) => void }) {
  return (
    <PickerPanel
      label="Priority"
      placeholder="Set backlog priority"
      getOptions={(query) => {
        const q = query.trim().toLowerCase();
        const options = BACKLOG_PRIORITIES.map((p, i) => ({ key: p.id, label: p.label, value: p.id, hint: String(i + 1) }));
        if (/^[1-5]$/.test(q)) return [options[Number(q) - 1]];
        return q ? options.filter((o) => o.label.toLowerCase().startsWith(q)) : options;
      }}
      onSelect={onPick}
    />
  );
}

/** This week's objectives, to link a task to one (or to none). */
export function ObjectivePicker({ value, onPick }: { value: Id | null; onPick: (objectiveId: Id | null) => void }) {
  const { weekStartsOn } = useSettings();
  const objectives = useObjectives(weekStartOf(today(), weekStartsOn));
  return (
    <PickerPanel
      label="Weekly objective"
      placeholder="Link to an objective"
      emptyText="No objectives this week. Add one under This week."
      getOptions={(query) => {
        const q = query.trim().toLowerCase();
        const options: { key: string; label: string; value: Id | null }[] = objectives
          .filter((o) => o.title.toLowerCase().includes(q))
          .map((o) => ({ key: o.id, label: o.title, value: o.id }));
        if (!q && value !== null) options.push({ key: 'none', label: 'No objective', value: null });
        return options;
      }}
      onSelect={onPick}
    />
  );
}
