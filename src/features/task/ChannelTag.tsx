import type { Channel } from '@/data/types';

/** "#name" tinted with the channel's colour. */
export function ChannelTag({ channel }: { channel: Channel }) {
  return (
    <span
      className="channel-tag inline-flex max-w-full items-center truncate rounded px-1.5 py-px text-[12px] font-medium"
      style={{ '--tag': channel.color } as React.CSSProperties}
    >
      #{channel.name}
    </span>
  );
}
