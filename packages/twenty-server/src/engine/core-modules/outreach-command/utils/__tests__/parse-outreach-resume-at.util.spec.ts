import { parseOutreachResumeAtFromHint } from 'src/engine/core-modules/outreach-command/utils/parse-outreach-resume-at.util';

describe('parseOutreachResumeAtFromHint', () => {
  it('parses "after 15 dec" relative to reference year', () => {
    const result = parseOutreachResumeAtFromHint(
      'I am out of town, lets connect after 15 dec',
      new Date('2026-09-02T12:00:00.000Z'),
    );

    expect(result).toBe('2026-12-15T09:00:00.000Z');
  });

  it('returns null for empty hint', () => {
    expect(parseOutreachResumeAtFromHint('')).toBeNull();
  });
});
