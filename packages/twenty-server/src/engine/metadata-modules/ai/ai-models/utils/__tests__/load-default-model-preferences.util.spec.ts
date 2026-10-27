import { DEFAULT_RECOMMENDED_MODELS } from 'src/engine/metadata-modules/ai/ai-models/utils/load-default-model-preferences.util';

describe('DEFAULT_RECOMMENDED_MODELS', () => {
  it('includes GPT-6 Luna and DeepSeek V4 Flash', () => {
    expect(DEFAULT_RECOMMENDED_MODELS).toEqual(
      expect.arrayContaining([
        'openai/gpt-6-luna',
        'openrouter/deepseek/deepseek-v4.1-flash',
        'openrouter/deepseek/deepseek-v4.1-flash-1017',
        'openrouter/deepseek/deepseek-v4-flash-vision-exp',
        'openrouter/deepseek/deepseek-v4-flash-0731',
      ]),
    );
  });
});
