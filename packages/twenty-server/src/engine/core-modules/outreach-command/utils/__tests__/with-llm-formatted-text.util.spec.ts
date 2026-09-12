import {
  maybeWithLlmFormattedText,
  withLlmFormattedText,
} from '../with-llm-formatted-text.util';

describe('withLlmFormattedText', () => {
  it('adds pretty-printed text without nesting text inside itself', () => {
    const result = withLlmFormattedText({
      success: true,
      about: 'Hello',
    });

    expect(result.success).toBe(true);
    expect(result.about).toBe('Hello');
    expect(result.text).toBe(
      JSON.stringify({ success: true, about: 'Hello' }, null, 2),
    );
    expect(result.text).not.toContain('"text"');
  });
});

describe('maybeWithLlmFormattedText', () => {
  it('wraps fetch-linkedin-messages so {{step.text}} resolves', () => {
    const result = maybeWithLlmFormattedText('fetch-linkedin-messages', {
      success: true,
      messages: [{ text: 'Hi' }],
    });

    expect(result).toEqual(
      withLlmFormattedText({
        success: true,
        messages: [{ text: 'Hi' }],
      }),
    );
  });

  it('leaves calendar availability unchanged', () => {
    const slots = [{ startsAt: '2026-01-01T00:00:00.000Z' }];

    expect(
      maybeWithLlmFormattedText('get-calendar-availability', {
        success: true,
        slots,
      }),
    ).toEqual({ success: true, slots });
  });
});
