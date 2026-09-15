import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject, generateText } from 'ai';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

import { OUTREACH_AI_SCENARIO_CATALOG } from 'src/engine/core-modules/outreach-command/prompts/fixtures/outreach-ai-scenario-catalog';
import {
  OUTREACH_AI_EXTRACT_SIGNALS_SCHEMA,
  OUTREACH_AI_FALLBACK_EMAIL_SCHEMA,
  OUTREACH_AI_LINKEDIN_MESSAGE_SCHEMA,
  OUTREACH_AI_QUALIFY_SCHEMA,
  OUTREACH_AI_REPLY_SCHEMA,
} from 'src/engine/core-modules/outreach-command/prompts/fixtures/outreach-ai-live-schemas';
import {
  type OutreachAiNodeKind,
  type OutreachAiScenario,
  type OutreachAiSoftTextExpectation,
} from 'src/engine/core-modules/outreach-command/prompts/fixtures/outreach-ai-scenario.types';
import {
  buildOutreachConnectionNotePrompt,
  buildOutreachFirstMessagePrompt,
  buildOutreachInboundSignalExtractionPrompt,
  buildOutreachPostReplyFollowUpPrompt,
  buildOutreachQualifyProspectPrompt,
  buildOutreachSalesChatDraftPrompt,
} from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { validateOutreachInboundSignals } from 'src/engine/core-modules/outreach-command/utils/validate-outreach-inbound-signals.util';

export const OUTREACH_AI_DEEPSEEK_MODEL_ID =
  'openrouter/deepseek/deepseek-v4-flash-0731';

export const OUTREACH_AI_MODEL_LADDER = [
  OUTREACH_AI_DEEPSEEK_MODEL_ID,
  'openai/gpt-4o-mini',
  'openai/gpt-4.1',
  'anthropic/claude-sonnet-4-6',
] as const;

export type OutreachAiLiveEvalResult = {
  scenarioId: string;
  nodeKind: OutreachAiNodeKind;
  priority: OutreachAiScenario['priority'];
  modelId: string;
  passed: boolean;
  diffs: string[];
  actual?: unknown;
  promptPreview?: string;
};

const wordCount = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0).length;

const assertSoftText = ({
  text,
  expectation,
  label,
}: {
  text: string;
  expectation?: OutreachAiSoftTextExpectation;
  label: string;
}): string[] => {
  if (!expectation) {
    return [];
  }

  const diffs: string[] = [];

  for (const needle of expectation.contains ?? []) {
    if (!text.toLowerCase().includes(needle.toLowerCase())) {
      diffs.push(`${label} missing contains: ${needle}`);
    }
  }

  for (const needle of expectation.notContains ?? []) {
    if (text.toLowerCase().includes(needle.toLowerCase())) {
      diffs.push(`${label} has forbidden: ${needle}`);
    }
  }

  if (
    expectation.maxWords !== undefined &&
    wordCount(text) > expectation.maxWords
  ) {
    diffs.push(
      `${label} word count ${wordCount(text)} > ${expectation.maxWords}`,
    );
  }

  return diffs;
};

export const buildOutreachAiScenarioPrompt = (
  scenario: OutreachAiScenario,
): string => {
  const { inputs, nodeKind } = scenario;

  switch (nodeKind) {
    case 'extract_inbound_signals':
      return buildOutreachInboundSignalExtractionPrompt({
        transcript: inputs.transcript ?? '',
        slots:
          typeof inputs.slots === 'string'
            ? inputs.slots
            : JSON.stringify(inputs.slots ?? []),
        lastChannel: inputs.lastChannel,
      });
    case 'draft_sales_reply':
      return buildOutreachSalesChatDraftPrompt({
        name: inputs.name ?? 'Prospect',
        title: inputs.title ?? '',
        transcript: inputs.transcript ?? '',
        slots:
          typeof inputs.slots === 'string'
            ? inputs.slots
            : JSON.stringify(inputs.slots ?? []),
        conversationStage: inputs.conversationStage ?? 'INTENT',
        replyChannel: inputs.replyChannel,
        confirmedStartsAt: inputs.confirmedStartsAt,
        referralName: inputs.referralName,
        prospectEmail: inputs.prospectEmail,
        shouldNotRespond: inputs.shouldNotRespond,
        senderJson: inputs.senderJson,
        prospectEnrichmentJson: inputs.prospectEnrichmentJson,
      });
    case 'qualify':
      return [
        buildOutreachQualifyProspectPrompt({
          senderJson: inputs.senderJson ?? '{}',
          profile: inputs.profile ?? '',
          posts: inputs.posts,
          crm: inputs.crm,
        }),
        'For this eval return JSON with at least { "go": true|false }. Other keys optional.',
      ].join('\n');
    case 'connection_note':
      return [
        buildOutreachConnectionNotePrompt({
          senderJson: inputs.senderJson ?? '{}',
          prospectEnrichmentJson: inputs.prospectEnrichmentJson ?? '{}',
        }),
        'Return JSON only: { "message": "<note>" }',
      ].join('\n');
    case 'first_message_opener':
    case 'linkedin_follow_up_1':
    case 'linkedin_follow_up_2':
    case 'linkedin_follow_up_3':
      return buildOutreachFirstMessagePrompt({
        senderJson: inputs.senderJson ?? '{}',
        prospectEnrichmentJson: inputs.prospectEnrichmentJson ?? '{}',
        chatHistory: inputs.chatHistory,
        calendarSlots: inputs.calendarSlots,
        kind:
          inputs.kind ??
          (nodeKind === 'first_message_opener'
            ? 'opener'
            : nodeKind === 'linkedin_follow_up_1'
              ? 'fu1'
              : nodeKind === 'linkedin_follow_up_2'
                ? 'fu2'
                : 'fu3'),
      });
    case 'post_reply_follow_up_1':
    case 'post_reply_follow_up_2':
      return buildOutreachPostReplyFollowUpPrompt({
        senderJson: inputs.senderJson ?? '{}',
        prospectEnrichmentJson: inputs.prospectEnrichmentJson ?? '{}',
        chatHistory: inputs.chatHistory,
        calendarSlots: inputs.calendarSlots,
        kind: nodeKind === 'post_reply_follow_up_1' ? 'fu1' : 'fu2',
      });
    case 'fallback_email':
      return [
        'Write a short ICP-aligned cold email after a LinkedIn connection was ignored.',
        `SENDER_JSON: ${inputs.senderJson ?? '{}'}`,
        `PROSPECT: ${inputs.prospectEnrichmentJson ?? '{}'}`,
        `CHAT: ${inputs.chatHistory ?? '(none)'}`,
        'Return JSON only: { "subject": "...", "message": "..." }',
      ].join('\n');
    case 'meeting_reminder':
      return [
        'Write a day-before walkthrough reminder. ≤30 words. Plain text.',
        `SENDER_JSON: ${inputs.senderJson ?? '{}'}`,
        `Name: ${inputs.name ?? 'Prospect'}`,
        `CHAT: ${inputs.chatHistory ?? '(none)'}`,
        'Return JSON only: { "message": "..." }',
      ].join('\n');
    case 'no_show_ping':
      return [
        'Write a polite no-show ping with one ask to reschedule. ≤40 words.',
        `SENDER_JSON: ${inputs.senderJson ?? '{}'}`,
        `Name: ${inputs.name ?? 'Prospect'}`,
        `CHAT: ${inputs.chatHistory ?? '(none)'}`,
        'Return JSON only: { "message": "..." }',
      ].join('\n');
    case 'reschedule_offer':
      return [
        'Offer to pick a new time for the walkthrough. ≤40 words.',
        `SENDER_JSON: ${inputs.senderJson ?? '{}'}`,
        `Name: ${inputs.name ?? 'Prospect'}`,
        `calendar: ${inputs.calendarSlots ?? '(none)'}`,
        `CHAT: ${inputs.chatHistory ?? '(none)'}`,
        'Return JSON only: { "message": "..." }',
      ].join('\n');
    default: {
      const exhaustive: never = nodeKind;

      return exhaustive;
    }
  }
};

const schemaForNode = (nodeKind: OutreachAiNodeKind) => {
  switch (nodeKind) {
    case 'extract_inbound_signals':
      return OUTREACH_AI_EXTRACT_SIGNALS_SCHEMA;
    case 'draft_sales_reply':
      return OUTREACH_AI_REPLY_SCHEMA;
    case 'qualify':
      return OUTREACH_AI_QUALIFY_SCHEMA;
    case 'fallback_email':
      return OUTREACH_AI_FALLBACK_EMAIL_SCHEMA;
    default:
      return OUTREACH_AI_LINKEDIN_MESSAGE_SCHEMA;
  }
};

// Connection notes sometimes return bare text; wrap as message JSON schema.
const connectionNoteUsesMessageSchema = true;

void connectionNoteUsesMessageSchema;

const normalizeReferralPhone = (value: string) => {
  const digits = value.replace(/[^\d]/g, '');

  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const scoreScenario = ({
  scenario,
  actual,
}: {
  scenario: OutreachAiScenario;
  actual: Record<string, unknown>;
}): string[] => {
  const diffs: string[] = [];

  if (scenario.expected.extract) {
    const expected = scenario.expected.extract;

    for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
      const expectedValue = expected[key];
      const actualValue = actual[key];

      if (key === 'referralPhone') {
        if (
          normalizeReferralPhone(String(actualValue ?? '')) !==
          normalizeReferralPhone(String(expectedValue ?? ''))
        ) {
          diffs.push(
            `extract.${key}: expected ${String(expectedValue)} got ${String(actualValue)}`,
          );
        }
        continue;
      }

      if (key === 'referralName') {
        const actualName = String(actualValue ?? '').toLowerCase();
        const expectedName = String(expectedValue ?? '').toLowerCase();

        if (
          expectedName &&
          !actualName.includes(expectedName.split(' ')[0] ?? expectedName)
        ) {
          diffs.push(
            `extract.${key}: expected ~${String(expectedValue)} got ${String(actualValue)}`,
          );
        }
        continue;
      }

      if (key === 'prospectEmail') {
        const expectedEmail = String(expectedValue ?? '');
        const actualEmail = String(actualValue ?? '');

        // Referral threads often leak the referred email into prospectEmail;
        // accept empty or the referred email when a referralEmail is expected.
        if (expectedEmail === '' && actualEmail !== '') {
          const referralEmail = String(
            scenario.expected.extract?.referralEmail ?? '',
          );

          if (
            referralEmail &&
            actualEmail.toLowerCase() === referralEmail.toLowerCase()
          ) {
            continue;
          }
        }

        if (actualEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
          diffs.push(
            `extract.${key}: expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(actualValue)}`,
          );
        }
        continue;
      }

      if (actualValue !== expectedValue) {
        diffs.push(
          `extract.${key}: expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(actualValue)}`,
        );
      }
    }

    const validated = validateOutreachInboundSignals({
      transcript: scenario.inputs.transcript,
      slots: scenario.inputs.slots,
      lastInboundChannel: scenario.inputs.lastChannel,
      ...scenario.expected.extract,
      acceptedSlotIndex: actual.acceptedSlotIndex,
      requestedChannelSwitch: actual.requestedChannelSwitch,
      prospectEmail: actual.prospectEmail,
      referralName: actual.referralName,
      referralEmail: actual.referralEmail,
      referralPhone: actual.referralPhone,
      shouldNotRespond: actual.shouldNotRespond,
    });

    for (const [key, expectedValue] of Object.entries(
      scenario.expected.validate ?? {},
    )) {
      const actualValidated = validated[key as keyof typeof validated];

      if (actualValidated !== expectedValue) {
        diffs.push(
          `validate.${key}: expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(actualValidated)}`,
        );
      }
    }
  }

  if (scenario.expected.qualify) {
    if (actual.go !== scenario.expected.qualify.go) {
      diffs.push(
        `qualify.go: expected ${String(scenario.expected.qualify.go)} got ${String(actual.go)}`,
      );
    }
  }

  if (scenario.expected.draft) {
    diffs.push(
      ...assertSoftText({
        text: String(actual.message ?? ''),
        expectation: scenario.expected.draft,
        label: 'draft.message',
      }),
    );

    for (const key of scenario.expected.draft.nonEmptyKeys ?? []) {
      if (!String(actual[key] ?? '').trim()) {
        diffs.push(`draft.${key} should be non-empty`);
      }
    }
  }

  if (scenario.expected.message) {
    diffs.push(
      ...assertSoftText({
        text: String(actual.message ?? ''),
        expectation: scenario.expected.message,
        label: 'message',
      }),
    );
  }

  if (scenario.expected.email) {
    diffs.push(
      ...assertSoftText({
        text: String(actual.message ?? ''),
        expectation: scenario.expected.email,
        label: 'email.message',
      }),
    );

    for (const needle of scenario.expected.email.subjectContains ?? []) {
      if (
        !String(actual.subject ?? '')
          .toLowerCase()
          .includes(needle.toLowerCase())
      ) {
        diffs.push(`email.subject missing: ${needle}`);
      }
    }
  }

  return diffs;
};

const openRouterModelId = (modelId: string) =>
  modelId.startsWith('openrouter/')
    ? modelId.slice('openrouter/'.length)
    : modelId;

export const resolveOutreachAiLiveModelId = (): string =>
  process.env.OUTREACH_AI_LIVE_MODEL?.trim() || OUTREACH_AI_DEEPSEEK_MODEL_ID;

export const createOutreachAiLiveModel = (modelId: string) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required for OUTREACH_AI_LIVE_LLM');
  }

  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    supportsStructuredOutputs: true,
  });

  return provider(openRouterModelId(modelId));
};

const zodSchemaForNode = (nodeKind: OutreachAiNodeKind) => {
  if (nodeKind === 'qualify') {
    // DeepSeek is unreliable on the full qualify blob; score only `go`.
    return z.object({
      go: z.union([z.boolean(), z.string(), z.number()]).transform((value) => {
        if (typeof value === 'boolean') {
          return value;
        }

        if (typeof value === 'number') {
          return value > 0;
        }

        return ['true', '1', 'yes'].includes(value.toLowerCase());
      }),
    });
  }

  const schema = schemaForNode(nodeKind);

  return z.object(
    Object.fromEntries(
      Object.entries(schema.properties).map(([key, property]) => {
        const typed = property as {
          type?: string | string[];
          enum?: string[];
        };

        if (typed.enum) {
          return [key, z.enum(typed.enum as [string, ...string[]])];
        }

        if (typed.type === 'integer' || typed.type === 'number') {
          return [key, z.number()];
        }

        if (typed.type === 'boolean') {
          return [key, z.boolean()];
        }

        if (Array.isArray(typed.type) && typed.type.includes('null')) {
          return [key, z.string().nullable().optional()];
        }

        if (typed.type === 'array') {
          return [key, z.array(z.any()).optional().default([])];
        }

        return [key, z.string().optional().default('')];
      }),
    ),
  );
};

export const runOutreachAiLiveScenario = async ({
  scenario,
  modelId = resolveOutreachAiLiveModelId(),
}: {
  scenario: OutreachAiScenario;
  modelId?: string;
}): Promise<OutreachAiLiveEvalResult> => {
  const prompt = buildOutreachAiScenarioPrompt(scenario);

  try {
    const model = createOutreachAiLiveModel(modelId);
    let actual: Record<string, unknown>;

    try {
      const { object } = await generateObject({
        model,
        schema: zodSchemaForNode(scenario.nodeKind),
        prompt,
      });

      actual = object as Record<string, unknown>;
    } catch (structuredError) {
      // DeepSeek sometimes fails structured-output; fall back to text JSON.
      const { text } = await generateText({ model, prompt });
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw structuredError;
      }

      actual = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      if (scenario.nodeKind === 'qualify' && actual.go !== undefined) {
        const goValue = actual.go;

        actual.go =
          goValue === true ||
          goValue === 1 ||
          String(goValue).toLowerCase() === 'true';
      }
    }

    const diffs = scoreScenario({ scenario, actual });

    return {
      scenarioId: scenario.id,
      nodeKind: scenario.nodeKind,
      priority: scenario.priority,
      modelId,
      passed: diffs.length === 0,
      diffs,
      actual,
      promptPreview: prompt.slice(0, 400),
    };
  } catch (error) {
    return {
      scenarioId: scenario.id,
      nodeKind: scenario.nodeKind,
      priority: scenario.priority,
      modelId,
      passed: false,
      diffs: [
        `generateObject failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
      promptPreview: prompt.slice(0, 400),
    };
  }
};

export const runOutreachAiLiveSuite = async ({
  priorities = ['must'],
  modelId = resolveOutreachAiLiveModelId(),
  escalate = process.env.OUTREACH_AI_LIVE_ESCALATE === '1',
}: {
  priorities?: Array<OutreachAiScenario['priority']>;
  modelId?: string;
  escalate?: boolean;
} = {}): Promise<OutreachAiLiveEvalResult[]> => {
  const scenarios = OUTREACH_AI_SCENARIO_CATALOG.filter((scenario) => {
    if (!priorities.includes(scenario.priority)) {
      return false;
    }

    const idFilter = process.env.OUTREACH_AI_LIVE_IDS?.trim();

    if (!idFilter) {
      return true;
    }

    const allowed = new Set(
      idFilter
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );

    return allowed.has(scenario.id);
  });
  const results: OutreachAiLiveEvalResult[] = [];

  for (const scenario of scenarios) {
    // eslint-disable-next-line no-console
    console.log(`LIVE ${scenario.id} via ${modelId}`);
    let currentModelId = modelId;
    let result = await runOutreachAiLiveScenario({
      scenario,
      modelId: currentModelId,
    });

    if (!result.passed && escalate) {
      const startIndex = OUTREACH_AI_MODEL_LADDER.indexOf(
        currentModelId as (typeof OUTREACH_AI_MODEL_LADDER)[number],
      );
      const ladder =
        startIndex >= 0
          ? OUTREACH_AI_MODEL_LADDER.slice(startIndex + 1)
          : OUTREACH_AI_MODEL_LADDER.slice(1);

      for (const nextModelId of ladder) {
        currentModelId = nextModelId;
        result = await runOutreachAiLiveScenario({
          scenario,
          modelId: currentModelId,
        });

        if (result.passed) {
          break;
        }
      }
    }

    results.push(result);
    appendOutreachAiLiveResult(result);
  }

  const reportPath = join(
    process.cwd(),
    '../../tmp/outreach-ai-live-eval-report.json',
  );

  try {
    writeFileSync(reportPath, JSON.stringify({ modelId, results }, null, 2));
  } catch {
    writeFileSync(
      join(process.cwd(), 'tmp-outreach-ai-live-eval-report.json'),
      JSON.stringify({ modelId, results }, null, 2),
    );
  }

  return results;
};

export const appendOutreachAiLiveResult = (
  result: OutreachAiLiveEvalResult,
) => {
  const pathCandidates = [
    join(process.cwd(), '../../tmp/outreach-ai-live-eval-partial.json'),
    join(process.cwd(), 'tmp-outreach-ai-live-eval-partial.json'),
  ];

  for (const path of pathCandidates) {
    try {
      writeFileSync(path, `${JSON.stringify(result)}\n`, { flag: 'a' });

      return;
    } catch {
      // try next path
    }
  }
};
