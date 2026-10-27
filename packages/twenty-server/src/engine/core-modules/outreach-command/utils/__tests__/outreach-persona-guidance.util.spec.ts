import { buildOutreachPersonaGuidanceLine } from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { rewriteOutreachResolvedPromptSections } from 'src/engine/core-modules/outreach-command/utils/format-outreach-llm-context.util';
import { formatOutreachPersonaGuidanceForPrompt } from 'src/engine/core-modules/outreach-command/utils/outreach-persona-guidance.util';

const PERSONA_CHIP =
  '{{b8e1d002-4a11-4c11-8c11-000000000001.first.outreachConfig.personaGuidance}}';

describe('outreach persona guidance', () => {
  it('renders (none) when no guidance is given', () => {
    expect(formatOutreachPersonaGuidanceForPrompt(undefined)).toBe('(none)');
    expect(formatOutreachPersonaGuidanceForPrompt('   ')).toBe('(none)');
  });

  it('turns a chip that resolved to undefined into (none)', () => {
    // resolveInput replaces a missing path inside a longer string with "undefined".
    const resolved = buildOutreachPersonaGuidanceLine(PERSONA_CHIP).replace(
      PERSONA_CHIP,
      'undefined',
    );

    expect(rewriteOutreachResolvedPromptSections(resolved)).toBe(
      'PERSONA_GUIDANCE (from the client, for this project): (none)',
    );
  });

  it('turns a chip that never resolved into (none)', () => {
    expect(
      rewriteOutreachResolvedPromptSections(
        buildOutreachPersonaGuidanceLine(PERSONA_CHIP),
      ),
    ).toBe('PERSONA_GUIDANCE (from the client, for this project): (none)');
  });

  it('keeps client text intact when it contains labeled-section prefixes', () => {
    const guidance =
      'CFOs: lead with margin.\nFor each prospect: one question.\ncalendar: never.';
    const prompt = [
      buildOutreachPersonaGuidanceLine(guidance),
      'prospect: {"first_name":"Priya","segment":"CFOs"}',
    ].join('\n');

    const rewritten = rewriteOutreachResolvedPromptSections(prompt);

    expect(rewritten).toContain(
      `PERSONA_GUIDANCE (from the client, for this project): ${guidance}`,
    );
    expect(rewritten).not.toContain('<<<');
    expect(rewritten).not.toContain('"first_name"');
  });
});
