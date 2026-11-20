import { shouldIncludeOutreachActionRules } from 'src/engine/metadata-modules/ai/ai-chat/utils/should-include-outreach-action-rules.util';

describe('shouldIncludeOutreachActionRules', () => {
  it('should leave the outreach rules out of a find request', () => {
    expect(
      shouldIncludeOutreachActionRules({
        lastUserText:
          'Make a list of the nephrologists of top hospitals in Mumbai',
      }),
    ).toBe(false);
  });

  it.each([
    'start outreach to everyone',
    'enroll these people',
    'save them to the CRM',
    'send connection requests',
    'set up the sequencer',
  ])('should include them when the user asks to act: %s', (lastUserText) => {
    expect(shouldIncludeOutreachActionRules({ lastUserText })).toBe(true);
  });

  it('should include them when rows are selected', () => {
    expect(
      shouldIncludeOutreachActionRules({
        lastUserText: 'what next',
        selectedPersonIds: ['person-1'],
      }),
    ).toBe(true);
  });
});
