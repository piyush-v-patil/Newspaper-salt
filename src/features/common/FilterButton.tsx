import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, ListFilter, X } from 'lucide-react';
import { useUi } from '@/app/uiStore';
import { useChannels, useContexts } from '@/data/ReferenceData';
import type { TaskFilter } from '@/domain/filter';

const item =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] text-ink-2 outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink';

/** Limits the view to one context or channel. Opens with Shift+F. */
export function FilterButton() {
  const { filter, setFilter, filterMenuOpen, setFilterMenuOpen } = useUi();
  const channels = useChannels();
  const contexts = useContexts();

  const same = (f: TaskFilter) => filter?.kind === f.kind && filter.id === f.id;
  const activeLabel =
    filter?.kind === 'channel'
      ? channels.find((c) => c.id === filter.id)?.name
      : contexts.find((c) => c.id === filter?.id)?.name;
  const groups = [
    ...contexts.map((context) => ({ context, items: channels.filter((c) => c.contextId === context.id) })),
    { context: null, items: channels.filter((c) => !contexts.some((x) => x.id === c.contextId)) },
  ];

  return (
    <div className="flex items-center gap-1">
      <Menu.Root open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
        <Menu.Trigger asChild>
          <button
            type="button"
            className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12.5px] hover:bg-hover ${
              filter ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2'
            }`}
          >
            <ListFilter size={13} />
            {filter && activeLabel ? (filter.kind === 'channel' ? `#${activeLabel}` : activeLabel) : 'Filter'}
          </button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={6} className="z-50 max-h-[360px] min-w-[208px] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop data-[state=open]:animate-pop">
            <Menu.Item className={item} onSelect={() => setFilter(null)}>
              <span className="flex-1">All tasks</span>
              {!filter && <Check size={14} />}
            </Menu.Item>
            {groups.map(({ context, items }) => (
              <Menu.Group key={context?.id ?? 'none'}>
                {context && (
                  <Menu.Item className={`${item} mt-1 font-medium !text-ink`} onSelect={() => setFilter({ kind: 'context', id: context.id })}>
                    <span className="flex-1">{context.name}</span>
                    {same({ kind: 'context', id: context.id }) && <Check size={14} />}
                  </Menu.Item>
                )}
                {items.map((channel) => (
                  <Menu.Item key={channel.id} className={`${item} ${context ? 'pl-4' : ''}`} onSelect={() => setFilter({ kind: 'channel', id: channel.id })}>
                    <span className="h-2 w-2 rounded-full" style={{ background: channel.color }} />
                    <span className="flex-1">#{channel.name}</span>
                    {same({ kind: 'channel', id: channel.id }) && <Check size={14} />}
                  </Menu.Item>
                ))}
              </Menu.Group>
            ))}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      {filter && (
        <button type="button" aria-label="Clear filter" onClick={() => setFilter(null)} className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
