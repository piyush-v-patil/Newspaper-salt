import { describe, expect, it } from 'vitest';
import { extractTokens } from './tokens';

describe('extractTokens', () => {
  it('pulls time, channel and priority out of a title', () => {
    expect(extractTokens('Draft Q4 report ~1h30 #work !urgent')).toEqual({
      title: 'Draft Q4 report',
      plannedMin: 90,
      channelName: 'work',
      priority: 'urgent',
    });
  });

  it('accepts tokens anywhere in the title', () => {
    expect(extractTokens('~45 Review #design mockups')).toEqual({
      title: 'Review mockups',
      plannedMin: 45,
      channelName: 'design',
    });
  });

  it('leaves ordinary punctuation alone', () => {
    expect(extractTokens('Ship it! Fix issue #42 ~soon')).toEqual({ title: 'Ship it! Fix issue #42 ~soon' });
  });

  it('uses only the first token of each kind', () => {
    expect(extractTokens('Plan ~30 ~60 #a #b')).toEqual({ title: 'Plan ~60 #b', plannedMin: 30, channelName: 'a' });
  });
});
