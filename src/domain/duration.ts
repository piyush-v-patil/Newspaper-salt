/**
 * Reads a typed duration and returns minutes, or null if it is not one.
 * Accepts "30", "30m", "45 min", "2h", "1.5h", "1h30", "1h 30m" and "1:30".
 * A bare number means minutes.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;

  let minutes: number | null = null;
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{1,2}):(\d{2})$/))) {
    minutes = Number(m[1]) * 60 + Number(m[2]);
  } else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?\s*(?:(\d{1,2})\s*(?:m|min|mins)?)?$/))) {
    minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  } else if ((m = s.match(/^(\d+)\s*(?:m|min|mins|minute|minutes)?$/))) {
    minutes = Number(m[1]);
  }

  if (minutes === null || !Number.isFinite(minutes)) return null;
  minutes = Math.round(minutes);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

/** Common estimates offered before anything is typed. */
export const DURATION_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240];

/** "30 min", "1 hr", "1 hr 30 min" */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
