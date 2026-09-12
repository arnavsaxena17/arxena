import { OUTREACH_AI_SCENARIO_CATALOG } from 'src/engine/core-modules/outreach-command/prompts/fixtures/outreach-ai-scenario-catalog';
import { buildOutreachAiScenarioPrompt } from 'src/engine/core-modules/outreach-command/prompts/fixtures/run-outreach-ai-live-eval';
import { OUTREACH_AI_LEGACY_SAMPLE_TRANSCRIPT } from 'src/engine/core-modules/outreach-command/prompts/fixtures/transcripts/outreach-ai-naresh-transcripts';
import { validateOutreachInboundSignals } from 'src/engine/core-modules/outreach-command/utils/validate-outreach-inbound-signals.util';

describe('outreach-ai-scenario-catalog', () => {
  it('has unique scenario ids', () => {
    const ids = OUTREACH_AI_SCENARIO_CATALOG.map((scenario) => scenario.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every must and pass node kind at least once', () => {
    const requiredNodeKinds = new Set(
      OUTREACH_AI_SCENARIO_CATALOG.filter(
        (scenario) =>
          scenario.priority === 'must' || scenario.priority === 'pass',
      ).map((scenario) => scenario.nodeKind),
    );

    expect(requiredNodeKinds.has('extract_inbound_signals')).toBe(true);
    expect(requiredNodeKinds.has('draft_sales_reply')).toBe(true);
    expect(requiredNodeKinds.has('qualify')).toBe(true);
    expect(requiredNodeKinds.has('first_message_opener')).toBe(true);
    expect(requiredNodeKinds.has('connection_note')).toBe(true);
    expect(requiredNodeKinds.has('post_reply_follow_up_1')).toBe(true);
    expect(requiredNodeKinds.has('linkedin_follow_up_1')).toBe(true);
  });

  it('builds prompts that inject scenario inputs for extract and draft', () => {
    for (const scenario of OUTREACH_AI_SCENARIO_CATALOG.filter(
      (item) =>
        item.nodeKind === 'extract_inbound_signals' ||
        item.nodeKind === 'draft_sales_reply',
    )) {
      const prompt = buildOutreachAiScenarioPrompt(scenario);

      expect(prompt.length).toBeGreaterThan(40);

      if (scenario.inputs.transcript) {
        expect(prompt).toContain(scenario.inputs.transcript.slice(0, 40));
      }

      if (scenario.nodeKind === 'extract_inbound_signals') {
        expect(prompt).toContain('acceptedSlotIndex');
      }

      if (scenario.nodeKind === 'draft_sales_reply') {
        expect(prompt).toContain(
          scenario.inputs.conversationStage ?? 'INTENT',
        );
      }
    }
  });

  it('matches validate expectations when feeding expected extract outputs', () => {
    for (const scenario of OUTREACH_AI_SCENARIO_CATALOG.filter(
      (item) => item.expected.extract && item.expected.validate,
    )) {
      const validated = validateOutreachInboundSignals({
        transcript: scenario.inputs.transcript,
        slots: scenario.inputs.slots,
        lastInboundChannel: scenario.inputs.lastChannel,
        ...scenario.expected.extract,
      });

      expect(validated).toMatchObject(scenario.expected.validate ?? {});
    }
  });

  it('keeps legacy sample transcript available for inbound prompt specs', () => {
    expect(OUTREACH_AI_LEGACY_SAMPLE_TRANSCRIPT).toContain(
      'gaurav.zatakia@flomattress.com',
    );
    expect(OUTREACH_AI_LEGACY_SAMPLE_TRANSCRIPT.split('\n---\n').length).toBe(
      10,
    );
  });

  it('injects sender enrichment into qualify / connection / first-message prompts', () => {
    for (const scenario of OUTREACH_AI_SCENARIO_CATALOG.filter((item) =>
      [
        'qualify',
        'connection_note',
        'first_message_opener',
        'post_reply_follow_up_1',
        'linkedin_follow_up_2',
      ].includes(item.nodeKind),
    )) {
      const prompt = buildOutreachAiScenarioPrompt(scenario);

      expect(prompt).toContain('SENDER_JSON');
    }
  });
});
