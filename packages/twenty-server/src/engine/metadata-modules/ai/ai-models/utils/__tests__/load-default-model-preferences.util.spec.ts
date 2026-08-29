import { DEFAULT_RECOMMENDED_MODELS } from 'src/engine/metadata-modules/ai/ai-models/utils/load-default-model-preferences.util';

describe('DEFAULT_RECOMMENDED_MODELS', () => {
  it('includes GPT-4o mini and DeepSeek V4 Flash', () => {
    expect(DEFAULT_RECOMMENDED_MODELS).toEqual(
      expect.arrayContaining([
        'openai/gpt-4o-mini',
        'openrouter/deepseek/deepseek-v4-flash-0731',
      ]),
    );
  });
});
