import {
  buildVariableContextFromStepInfos,
  resolveAiAgentTestPrompt,
} from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/utils/resolveAiAgentTestPrompt';

describe('resolveAiAgentTestPrompt', () => {
  const candidateStepId = '0191a76e-bf48-417c-b2e2-7ce97e49edf3';
  const profileStepId = '4a2b0979-c2c2-4d04-9c8f-6ea2a9399cf8';
  const prompt = `Name: {{${candidateStepId}.first.name}}\nAbout: {{${profileStepId}.about}}`;

  it('substitutes variables from previous step results', () => {
    const { resolvedPrompt, missingVariablePaths } = resolveAiAgentTestPrompt({
      prompt,
      context: {
        [candidateStepId]: { first: { name: 'Jane Doe' } },
        [profileStepId]: { about: 'Operator at a search firm' },
      },
    });

    expect(missingVariablePaths).toEqual([]);
    expect(resolvedPrompt).toBe(
      'Name: Jane Doe\nAbout: Operator at a search firm',
    );
  });

  it('reports missing paths when a previous step has no result', () => {
    const { resolvedPrompt, missingVariablePaths } = resolveAiAgentTestPrompt({
      prompt,
      context: {
        [candidateStepId]: { first: { name: 'Jane Doe' } },
      },
    });

    expect(missingVariablePaths).toEqual([`${profileStepId}.about`]);
    expect(resolvedPrompt).toBe(prompt);
  });

  it('builds context from workflow run step infos', () => {
    expect(
      buildVariableContextFromStepInfos({
        [candidateStepId]: {
          result: { first: { name: 'Jane' } },
        },
        skip: { result: undefined },
      }),
    ).toEqual({
      [candidateStepId]: { first: { name: 'Jane' } },
    });
  });
});
