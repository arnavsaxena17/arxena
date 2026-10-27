import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

import {
  type ScenarioTrace,
  type ToolCall,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/run-scenario';
import { type SourcingScenario } from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/scenario';

export type Check = { name: string; passed: boolean; detail?: string };

export type JudgeVerdict = {
  assertion: string;
  verdict: 'pass' | 'fail' | 'unclear';
  evidence: string;
};

// Facts a profile cannot show. They must never be a fitment criterion, because
// an unknown must-have fails the row at the profile stage.
const LATER_CHECK_WORDS = /\b(age|ctc|salary|compensation|notice|lpa|pay)\b/i;

const FITMENT_TOOLS = new Set(['preview_ai_column', 'run_ai_column']);

type Criterion = { key?: unknown; description?: unknown; mustHave?: unknown };

const criteriaOf = (call: ToolCall): Criterion[] => {
  const fitment = call.args.fitment;

  if (typeof fitment === 'object' && fitment !== null) {
    const criteria = (fitment as { criteria?: unknown }).criteria;

    return Array.isArray(criteria) ? (criteria as Criterion[]) : [];
  }

  return [];
};

const questionCount = (calls: ToolCall[]): number =>
  calls
    .filter((call) => call.tool === 'ask_questions')
    .reduce((total, call) => {
      const questions = call.args.questions;

      return total + (Array.isArray(questions) ? questions.length : 1);
    }, 0);

export const gradeDeterministic = (
  scenario: SourcingScenario,
  trace: ScenarioTrace,
): Check[] => {
  const called = new Set(trace.calls.map((call) => call.tool));
  const checks: Check[] = [];

  checks.push({
    name: 'run finished',
    passed: trace.error === undefined,
    detail: trace.error,
  });

  for (const name of scenario.expect.must_call) {
    checks.push({ name: `calls ${name}`, passed: called.has(name) });
  }

  for (const name of scenario.expect.must_not_call) {
    checks.push({ name: `does not call ${name}`, passed: !called.has(name) });
  }

  // purpose: recruiting vs sales — title words like "sales rep" must not pick for-sales
  const loadedSections = new Set(
    trace.calls
      .filter((call) => call.tool === 'load_skills')
      .flatMap((call) =>
        Array.isArray(call.args.sections) ? call.args.sections.map(String) : [],
      ),
  );
  const purposeSection =
    scenario.purpose === 'sales' ? 'for-sales' : 'for-recruiting';
  const wrongPurposeSection =
    scenario.purpose === 'sales' ? 'for-recruiting' : 'for-sales';

  checks.push({
    name: `loads ${purposeSection}`,
    passed: loadedSections.has(purposeSection),
    detail: [...loadedSections].join(',') || 'none',
  });
  checks.push({
    name: `does not load ${wrongPurposeSection}`,
    passed: !loadedSections.has(wrongPurposeSection),
    detail: [...loadedSections].join(',') || 'none',
  });

  const questions = questionCount(trace.calls);

  checks.push({
    name: `asks at most ${scenario.expect.max_questions} questions`,
    passed: questions <= scenario.expect.max_questions,
    detail: `${questions} asked`,
  });

  const offenders = trace.calls
    .filter((call) => FITMENT_TOOLS.has(call.tool))
    .flatMap(criteriaOf)
    .filter(
      (criterion) =>
        criterion.mustHave === true &&
        LATER_CHECK_WORDS.test(
          `${String(criterion.key ?? '')} ${String(criterion.description ?? '')}`,
        ),
    )
    .map((criterion) => String(criterion.key ?? criterion.description));

  checks.push({
    name: 'no must-have criterion about age, pay or notice',
    passed: offenders.length === 0,
    detail: [...new Set(offenders)].join(', '),
  });

  return checks;
};

const condense = (trace: ScenarioTrace): string =>
  trace.calls
    .filter((call) => call.tool !== 'learn_tools')
    .map(
      (call, index) =>
        `${index + 1}. ${call.tool} ${JSON.stringify(call.args).slice(0, 700)}`,
    )
    .join('\n');

// Optional: a second model reads the trace and the natural-language
// assertions. Its verdicts are advice, not a gate.
export const judgeWithModel = async (
  scenario: SourcingScenario,
  trace: ScenarioTrace,
): Promise<JudgeVerdict[]> => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return [];
  }

  const items = [...scenario.expect.plan_assertions, ...scenario.judge];
  const provider = createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  });
  const { text } = await generateText({
    model: provider(
      process.env.SOURCING_EVAL_JUDGE_MODEL ??
        process.env.SOURCING_EVAL_MODEL ??
        'deepseek/deepseek-v4-flash-0731',
    ),
    temperature: 0,
    prompt: `You grade a sourcing agent. The tools were stubs, so ignore any numbers in the final message.\n\nUser request:\n${scenario.userSays}\n\nTool calls in order:\n${condense(trace)}\n\nFinal message:\n${trace.finalText.slice(0, 2500)}\n\nFor each assertion answer pass, fail or unclear with one line of evidence from the calls. Reply with JSON only: [{"assertion": string, "verdict": "pass"|"fail"|"unclear", "evidence": string}].\n\nAssertions:\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
  });

  try {
    const match = text.match(/\[[\s\S]*\]/);

    return match ? (JSON.parse(match[0]) as JudgeVerdict[]) : [];
  } catch {
    return [];
  }
};
