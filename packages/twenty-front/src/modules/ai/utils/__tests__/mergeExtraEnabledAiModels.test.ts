import { mergeExtraEnabledAiModels } from '@/ai/utils/mergeExtraEnabledAiModels';

describe('mergeExtraEnabledAiModels', () => {
  const catalog = [
    { modelId: 'openai/gpt-4.1' },
    { modelId: 'openai/gpt-4o-mini' },
    { modelId: 'openrouter/deepseek/deepseek-v4-flash-0731' },
  ];

  it('returns enabled models when no extras are requested', () => {
    const enabled = [{ modelId: 'openai/gpt-4.1' }];

    expect(mergeExtraEnabledAiModels(enabled, catalog, [])).toBe(enabled);
  });

  it('appends extra catalog models that are not already enabled', () => {
    const enabled = [{ modelId: 'openai/gpt-4.1' }];

    expect(
      mergeExtraEnabledAiModels(enabled, catalog, [
        'openai/gpt-4o-mini',
        'openrouter/deepseek/deepseek-v4-flash-0731',
      ]),
    ).toEqual([
      { modelId: 'openai/gpt-4.1' },
      { modelId: 'openai/gpt-4o-mini' },
      { modelId: 'openrouter/deepseek/deepseek-v4-flash-0731' },
    ]);
  });

  it('does not duplicate extras that are already enabled', () => {
    const enabled = [
      { modelId: 'openai/gpt-4.1' },
      { modelId: 'openai/gpt-4o-mini' },
    ];

    expect(
      mergeExtraEnabledAiModels(enabled, catalog, ['openai/gpt-4o-mini']),
    ).toEqual(enabled);
  });

  it('ignores extra ids that are not in the catalog', () => {
    const enabled = [{ modelId: 'openai/gpt-4.1' }];

    expect(
      mergeExtraEnabledAiModels(enabled, catalog, ['missing/model']),
    ).toEqual(enabled);
  });
});
