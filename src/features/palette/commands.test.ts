import { describe, expect, it } from 'vitest';
import { COMMANDS, matches } from './commands';

const find = (query: string) => COMMANDS.filter((c) => matches(c, query)).map((c) => c.id);

describe('command palette matching', () => {
  it('matches every word, in any order, across label and keywords', () => {
    expect(find('board')).toEqual(['board']);
    expect(find('week plan')).toContain('weekly-plan');
    expect(find('backup')).toEqual(['settings-data']);
    expect(find('dark mode')).toEqual(['dark']);
    expect(find('sett cha')).toEqual(['settings-channels']);
  });

  it('finds nothing for unrelated words, and everything for an empty query', () => {
    expect(find('zebra')).toEqual([]);
    expect(find('')).toHaveLength(COMMANDS.length);
  });

  it('has unique ids', () => {
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length);
  });
});
