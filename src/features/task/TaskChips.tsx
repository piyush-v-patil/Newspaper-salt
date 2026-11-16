import { CalendarDays, Clock, Flag, Hash } from 'lucide-react';
import { useChannelMap } from '@/data/ReferenceData';
import { BACKLOG, type DailyPriority, type Id, type TaskDay } from '@/data/types';
import { today } from '@/domain/clock';
import { formatMinutes } from '@/domain/dates';
import { relativeDayLabel } from '@/domain/dayLabels';
import { Chip } from './Chip';
import { PRIORITY_LABELS } from './pickers/options';
import { ChannelPicker, DatePicker, PriorityPicker, TimePicker } from './pickers/pickers';

interface Props {
  day: TaskDay;
  plannedMin: number | null;
  channelId: Id | null;
  priority: DailyPriority;
  onDay: (day: TaskDay) => void;
  onPlanned: (minutes: number | null) => void;
  onChannel: (channelId: Id | null) => void;
  onPriority: (priority: DailyPriority) => void;
}

/** The row of property chips shared by the add-task window and the task page. */
export function TaskChips({ day, plannedMin, channelId, priority, onDay, onPlanned, onChannel, onPriority }: Props) {
  const channel = useChannelMap().get(channelId ?? '');
  const pick = <T,>(apply: (value: T) => void, close: () => void) => (value: T) => {
    apply(value);
    close();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip icon={CalendarDays} name="Date" active label={day === BACKLOG ? 'Backlog' : relativeDayLabel(day, today())}>
        {(close) => <DatePicker onPick={pick(onDay, close)} />}
      </Chip>
      <Chip icon={Clock} name="Planned time" active={plannedMin !== null} label={plannedMin === null ? 'Planned' : formatMinutes(plannedMin)}>
        {(close) => <TimePicker value={plannedMin} onPick={pick(onPlanned, close)} />}
      </Chip>
      <Chip icon={Hash} name="Channel" active={!!channel} color={channel?.color} label={channel ? channel.name : 'Channel'}>
        {(close) => <ChannelPicker value={channelId} onPick={pick(onChannel, close)} />}
      </Chip>
      <Chip icon={Flag} name="Priority" active={priority !== 'normal'} label={priority === 'normal' ? 'Priority' : PRIORITY_LABELS[priority]}>
        {(close) => <PriorityPicker onPick={pick(onPriority, close)} />}
      </Chip>
    </div>
  );
}
