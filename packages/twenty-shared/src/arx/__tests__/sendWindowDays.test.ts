import {
  DEFAULT_SEND_WINDOW_DAYS,
  formatSendWindowDays,
  formatSendWindowDaysSummary,
  parseSendWindowDays,
} from '../sendWindowDays';

describe('sendWindowDays', () => {
  it('parses comma-separated weekday numbers', () => {
    expect(parseSendWindowDays('1,3,5')).toEqual([1, 3, 5]);
  });

  it('deduplicates and sorts parsed days', () => {
    expect(parseSendWindowDays('5,1,1,3')).toEqual([1, 3, 5]);
  });

  it('falls back to default when value is empty or invalid', () => {
    expect(parseSendWindowDays(null)).toEqual(DEFAULT_SEND_WINDOW_DAYS);
    expect(parseSendWindowDays('')).toEqual(DEFAULT_SEND_WINDOW_DAYS);
    expect(parseSendWindowDays('bad,99')).toEqual(DEFAULT_SEND_WINDOW_DAYS);
  });

  it('formats days for persistence', () => {
    expect(formatSendWindowDays([4, 2, 3])).toBe('2,3,4');
  });

  it('summarizes weekday presets', () => {
    expect(formatSendWindowDaysSummary([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(formatSendWindowDaysSummary([2, 3, 4])).toBe('Tue, Wed, Thu');
    expect(formatSendWindowDaysSummary([0, 1, 2, 3, 4, 5, 6])).toBe(
      'Every day',
    );
  });
});
