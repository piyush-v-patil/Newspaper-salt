import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useUi } from '@/app/uiStore';
import { Kbd } from '@/ui/Kbd';
import { SHORTCUTS } from './shortcuts';

/** "?": every keyboard shortcut on one sheet. */
export function ShortcutSheet() {
  const open = useUi((s) => s.shortcutsOpen);
  const close = () => useUi.setState({ shortcutsOpen: false });
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[6%] z-[61] flex max-h-[86vh] w-[min(880px,calc(100vw-32px))] -translate-x-1/2 flex-col rounded-xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-pop"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
            <Dialog.Title className="text-[15px] font-semibold tracking-tight">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-hover">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="grid min-h-0 grid-cols-1 gap-x-10 gap-y-6 overflow-y-auto px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
