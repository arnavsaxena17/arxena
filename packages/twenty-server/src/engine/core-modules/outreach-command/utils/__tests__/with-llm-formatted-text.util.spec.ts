import { withLlmFormattedText } from '../with-llm-formatted-text.util';

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
