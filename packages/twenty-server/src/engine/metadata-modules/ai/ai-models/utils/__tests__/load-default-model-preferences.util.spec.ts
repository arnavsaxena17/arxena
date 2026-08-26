import { DEFAULT_RECOMMENDED_MODELS } from 'src/engine/metadata-modules/ai/ai-models/utils/load-default-model-preferences.util';

describe('DEFAULT_RECOMMENDED_MODELS', () => {
  it('includes GPT-4o mini and OpenRouter Ox Alpha', () => {
    expect(DEFAULT_RECOMMENDED_MODELS).toEqual(
      expect.arrayContaining([
        'openai/gpt-4o-mini',
        'openrouter/stealth/ox-alpha',
      ]),
    );
  });
});
