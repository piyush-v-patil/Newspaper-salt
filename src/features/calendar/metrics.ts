/** Height of one hour on the time grid, in pixels. Zooming changes it; everything else is derived from it. */
let hourPx = 52;

/** The zoom steps, smallest first. */
export const HOUR_HEIGHTS = [36, 44, 52, 64, 80, 100];
export const DEFAULT_HOUR_PX = 52;

export function setHourPx(px: number): void {
  hourPx = px;
}
export const hourHeight = () => hourPx;

export const DAY_MIN = 24 * 60;

export const minToPx = (min: number) => (min * hourPx) / 60;
export const pxToMin = (px: number) => (px * 60) / hourPx;

/** Droppable id for a calendar day column. */
export const calendarDropId = (day: string) => `calendar:${day}`;
export const isCalendarDrop = (id: unknown): id is string => typeof id === 'string' && id.startsWith('calendar:');
export const dayOfCalendarDrop = (id: string) => id.slice('calendar:'.length);
