import { formatDuration } from './duration';

describe('formatDuration', () => {
  it('writes under an hour in minutes', () => {
    expect(formatDuration(35)).toBe('35 min');
  });

  it('writes an hour or more in hours and minutes', () => {
    expect(formatDuration(75)).toBe('1 h 15 min');
  });

  it('leaves off the minutes on the hour', () => {
    expect(formatDuration(120)).toBe('2 h');
  });
});
