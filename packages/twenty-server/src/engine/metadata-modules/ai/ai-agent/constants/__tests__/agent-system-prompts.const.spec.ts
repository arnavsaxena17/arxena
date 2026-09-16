import {
  buildWorkflowAgentSystemPrompt,
  getWorkflowOutputGeneratorPrompt,
  WORKFLOW_SYSTEM_PROMPTS,
} from 'src/engine/metadata-modules/ai/ai-agent/constants/agent-system-prompts.const';

describe('workflow agent system prompts', () => {
  it('omits tool strategy when hasTools is false', () => {
    const systemPrompt = buildWorkflowAgentSystemPrompt({
      agentPrompt: 'Qualify the prospect.',
      hasTools: false,
    });

    expect(systemPrompt).toBe(
      `${WORKFLOW_SYSTEM_PROMPTS.BASE}\n\nQualify the prospect.`,
    );
    expect(systemPrompt).not.toContain('Tool usage strategy');
  });

  it('includes tool strategy when hasTools is true', () => {
    const systemPrompt = buildWorkflowAgentSystemPrompt({
      agentPrompt: 'Qualify the prospect.',
      hasTools: true,
    });

    expect(systemPrompt).toContain('Tool usage strategy');
    expect(systemPrompt).toContain('Qualify the prospect.');
  });

  it('selects the tool-aware output generator only when tools were used', () => {
    expect(getWorkflowOutputGeneratorPrompt(true)).toBe(
      WORKFLOW_SYSTEM_PROMPTS.OUTPUT_GENERATOR,
    );
    expect(getWorkflowOutputGeneratorPrompt(false)).toBe(
      WORKFLOW_SYSTEM_PROMPTS.OUTPUT_GENERATOR_WITHOUT_TOOLS,
    );
    expect(getWorkflowOutputGeneratorPrompt(false)).not.toContain(
      'tool outputs',
    );
  });
});
