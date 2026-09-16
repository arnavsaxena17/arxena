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
  it('wraps fetch-linkedin-messages so {{step.text}} is a us/them transcript', () => {
    const result = maybeWithLlmFormattedText('fetch-linkedin-messages', {
      success: true,
      messages: [
        {
          text: 'Thanks, I am interested. Can we talk next week?',
          isSender: false,
        },
      ],
    });

    expect(result).toEqual({
      success: true,
      messages: [
        {
          text: 'Thanks, I am interested. Can we talk next week?',
          isSender: false,
        },
      ],
      text: 'them: Thanks, I am interested. Can we talk next week?',
    });
  });

  it('adds formatted slots text for calendar availability', () => {
    const slots = [
      {
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-01-01T00:30:00.000Z',
      },
    ];

    expect(
      maybeWithLlmFormattedText('get-calendar-availability', {
        success: true,
        slots,
      }),
    ).toEqual({
      success: true,
      slots,
      text: '(0) Thu, Jan 1 · 5:30–6:00 AM IST',
    });
  });
});
