/** Height of one hour on the time grid. Everything else is derived from it. */
export const HOUR_PX = 52;
export const PX_PER_MIN = HOUR_PX / 60;
export const DAY_MIN = 24 * 60;

export const minToPx = (min: number) => min * PX_PER_MIN;
export const pxToMin = (px: number) => px / PX_PER_MIN;

/** Droppable id for a calendar day column. */
export const calendarDropId = (day: string) => `calendar:${day}`;
export const isCalendarDrop = (id: unknown): id is string => typeof id === 'string' && id.startsWith('calendar:');
export const dayOfCalendarDrop = (id: string) => id.slice('calendar:'.length);
