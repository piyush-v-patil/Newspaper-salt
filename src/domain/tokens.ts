import type { DailyPriority } from '@/data/types';
import { parseDuration } from './duration';

export interface ParsedTitle {
  title: string;
  plannedMin?: number;
  channelName?: string;
  priority?: DailyPriority;
}

const PRIORITY_WORDS: Record<string, DailyPriority> = {
  urgent: 'urgent',
  priority: 'priority',
  normal: 'normal',
  low: 'low',
};

/**
 * Pulls typing shortcuts out of a task title: "~30m" sets planned time,
 * "#name" a channel, "!urgent" a priority. A token only counts at the start
 * of a word, so "Ship it!" and "issue #42" keep their punctuation... unless
 * the text after # is a plausible channel name, which a bare number is not.
 */
export function extractTokens(text: string): ParsedTitle {
  const result: ParsedTitle = { title: '' };
  const kept: string[] = [];

  for (const word of text.trim().split(/\s+/)) {
    const body = word.slice(1);
    if (word.startsWith('~') && result.plannedMin === undefined) {
      const minutes = parseDuration(body);
      if (minutes !== null) {
        result.plannedMin = minutes;
        continue;
      }
    } else if (word.startsWith('#') && result.channelName === undefined && /^[a-z][\w-]*$/i.test(body)) {
      result.channelName = body.toLowerCase();
      continue;
    } else if (word.startsWith('!') && result.priority === undefined && body.toLowerCase() in PRIORITY_WORDS) {
      result.priority = PRIORITY_WORDS[body.toLowerCase()];
      continue;
    }
    kept.push(word);
  }

  result.title = kept.join(' ');
  return result;
}
