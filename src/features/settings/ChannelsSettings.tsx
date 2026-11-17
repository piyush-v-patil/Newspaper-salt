import { Clock, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CHANNEL_COLORS, createChannel, createContext, deleteContext, updateChannel, updateContext } from '@/data/commands/channels';
import { useChannelMap, useContexts, useSettings } from '@/data/ReferenceData';
import { formatClock } from '@/domain/dates';
import type { Channel, Context, Id } from '@/data/types';
import { compareKeys } from '@/domain/ordering';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/ui/Popover';
import { TimeInput, Toggle } from './controls';

function ColorPicker({ channel }: { channel: Channel }) {
  const [open, setOpen] = useState(false);
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Colour of #${channel.name}`} className="grid h-7 w-7 place-items-center rounded-md hover:bg-hover">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: channel.color }} />
        </button>
      </PopoverTrigger>
      <PopoverContent label="Channel colour">
        <div className="grid grid-cols-6 gap-1.5 p-2.5">
          {CHANNEL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use ${color}`}
              aria-pressed={color === channel.color}
              onClick={() => {
                void updateChannel(channel.id, { color });
                setOpen(false);
              }}
              className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-surface ${color === channel.color ? 'ring-2 ring-ink' : ''}`}
              style={{ background: color }}
            />
          ))}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

/** Hours this channel's tasks are auto-scheduled in; "Any time" means working hours. */
function HoursPicker({ channel }: { channel: Channel }) {
  const { timeFormat } = useSettings();
  const [open, setOpen] = useState(false);
  // Shown straight away; the saved value catches up a moment later.
  const [pending, setPending] = useState<{ value: Channel['hours'] } | null>(null);
  const hours = (pending ? pending.value : channel.hours) ?? null;
  const set = (next: Channel['hours']) => {
    setPending({ value: next });
    void updateChannel(channel.id, { hours: next }).finally(() => setPending(null));
  };
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Hours of #${channel.name}`}
          className={`flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] ${hours ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-hover'}`}
        >
          <Clock size={12} />
          {hours ? `${formatClock(hours.startMin, timeFormat)} – ${formatClock(hours.endMin, timeFormat)}` : 'Work hours'}
        </button>
      </PopoverTrigger>
      <PopoverContent label="Channel hours">
        <div className="flex w-[260px] flex-col gap-2.5 p-3 text-[13px]">
          <p className="text-[12.5px] leading-relaxed text-ink-3">When you auto-schedule a #{channel.name} task, it goes in these hours instead of your working hours.</p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hours !== null}
              onChange={(e) => set(e.target.checked ? { startMin: 18 * 60, endMin: 21 * 60 } : null)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Own hours
          </label>
          {hours && (
            <div className="flex items-center gap-1.5">
              <TimeInput label={`#${channel.name} from`} value={hours.startMin} onChange={(startMin) => startMin < hours.endMin && set({ ...hours, startMin })} />
              <span className="text-ink-3">–</span>
              <TimeInput label={`#${channel.name} until`} value={hours.endMin} onChange={(endMin) => endMin > hours.startMin && set({ ...hours, endMin })} />
            </div>
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

function ChannelRow({ channel, contexts }: { channel: Channel; contexts: Context[] }) {
  return (
    <li data-testid="channel-row" className={`flex items-center gap-2 py-1.5 ${channel.enabled ? '' : 'opacity-55'}`}>
      <ColorPicker channel={channel} />
      <span className="text-[14px] text-ink-3">#</span>
      <input
        key={channel.name}
        defaultValue={channel.name}
        aria-label="Channel name"
        onBlur={(e) => void updateChannel(channel.id, { name: e.currentTarget.value })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-[14px] outline-none focus:bg-hover"
      />
      <select
        aria-label={`Context of #${channel.name}`}
        value={channel.contextId ?? ''}
        onChange={(e) => void updateChannel(channel.id, { contextId: e.target.value || null })}
        className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px] text-ink-2"
      >
        {contexts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="">No context</option>
      </select>
      <HoursPicker channel={channel} />
      <button
        type="button"
        aria-pressed={channel.isDefault}
        onClick={() => void updateChannel(channel.id, { isDefault: !channel.isDefault })}
        title="New tasks get this channel when none is chosen"
        className={`h-7 rounded-md px-2 text-[12px] ${channel.isDefault ? 'bg-accent-soft font-medium text-accent' : 'text-ink-3 hover:bg-hover'}`}
      >
        Default
      </button>
      <Toggle checked={channel.enabled} onChange={(enabled) => void updateChannel(channel.id, { enabled })} label={`Show #${channel.name}`} />
    </li>
  );
}

function AddField({ placeholder, label, onAdd }: { placeholder: string; label: string; onAdd: (name: string) => Promise<unknown> }) {
  const [value, setValue] = useState('');
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.trim()) {
          void onAdd(value);
          setValue('');
        }
      }}
      placeholder={placeholder}
      aria-label={label}
      autoComplete="off"
      className="mt-1 rounded-md border border-dashed border-line-strong bg-transparent px-2.5 py-1.5 text-[13px] outline-none placeholder:text-ink-3 focus:border-accent"
    />
  );
}

/** Contexts and their channels: names, colours, which count as personal, which is the default. */
export function ChannelsSettings() {
  const contexts = useContexts();
  const channelMap = useChannelMap();
  const channels = useMemo(() => [...channelMap.values()].sort((a, b) => compareKeys(a.order, b.order)), [channelMap]);
  const groups: { context: Context | null; items: Channel[] }[] = [
    ...contexts.map((context) => ({ context, items: channels.filter((c) => c.contextId === context.id) })),
    { context: null, items: channels.filter((c) => !contexts.some((x) => x.id === c.contextId)) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] leading-relaxed text-ink-2">
        Contexts group channels, such as Work and Personal. Tasks in a personal context never count toward your workload limit. A channel you switch off is hidden from pickers and filters; its tasks keep their tag.
      </p>
      {groups.map(({ context, items }) => {
        if (!context && items.length === 0) return null;
        return (
          <section key={context?.id ?? 'none'} aria-label={context ? context.name : 'No context'} className="flex flex-col gap-1 rounded-xl border border-line p-4">
            {context ? (
              <div className="flex items-center gap-3 pb-2">
                <input
                  key={context.name}
                  defaultValue={context.name}
                  aria-label="Context name"
                  onBlur={(e) => void updateContext(context.id, { name: e.currentTarget.value.trim() })}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-[15px] font-semibold outline-none focus:bg-hover"
                />
                <span className="text-[12.5px] text-ink-2">Personal</span>
                <Toggle checked={context.isPersonal} onChange={(isPersonal) => void updateContext(context.id, { isPersonal })} label={`${context.name} is personal`} />
                <button type="button" aria-label={`Delete context ${context.name}`} onClick={() => void deleteContext(context.id)} className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-over">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <h3 className="pb-2 text-[15px] font-semibold text-ink-2">No context</h3>
            )}
            <ul className="flex flex-col">
              {items.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} contexts={contexts} />
              ))}
            </ul>
            {context && <AddField placeholder="Add channel" label={`Add channel to ${context.name}`} onAdd={(name) => createChannel(name, context.id as Id)} />}
          </section>
        );
      })}
      <AddField placeholder="Add context" label="Add context" onAdd={createContext} />
    </div>
  );
}
