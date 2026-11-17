import { useSyncExternalStore } from 'react';

/** Below this width the navigation collapses into a drawer. */
const COMPACT_NAV = 1000;
/** Below this width the right panel opens over the content instead of beside it. */
const OVERLAY_PANEL = 1100;
/** Phone-sized: panels take the full width. */
const PHONE = 640;

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/** How much room the window has, in the three steps the layout cares about. */
export function useLayout(): { compactNav: boolean; overlayPanel: boolean; phone: boolean } {
  const width = useSyncExternalStore(subscribe, () => window.innerWidth, () => 1440);
  return { compactNav: width < COMPACT_NAV, overlayPanel: width < OVERLAY_PANEL, phone: width < PHONE };
}
