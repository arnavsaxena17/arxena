import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { parse } from 'yaml';

export type SourcingScenario = {
  id: string;
  purpose: 'recruiting' | 'sales';
  repeat: number;
  expect: {
    must_call: string[];
    must_not_call: string[];
    max_questions: number;
    plan_assertions: string[];
  };
  judge: string[];
  setup: string;
  userSays: string;
  scriptedReplies: string;
};

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;

const readSection = (body: string, heading: string): string => {
  const match = body.match(
    new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`),
  );

  return match ? match[1].trim() : '';
};

export const parseScenario = (text: string): SourcingScenario => {
  const split = text.match(FRONT_MATTER);

  if (!split) {
    throw new Error('Scenario has no front matter');
  }

  const frontMatter = parse(split[1]) as Record<string, unknown>;
  const body = text.slice(split[0].length);
  const expectation = (frontMatter.expect ?? {}) as Record<string, unknown>;
  const userLine = readSection(body, 'User says')
    .split('\n')
    .find((line) => line.startsWith('> '));

  return {
    id: String(frontMatter.id),
    purpose: frontMatter.purpose === 'sales' ? 'sales' : 'recruiting',
    repeat: Number(frontMatter.repeat ?? 1),
    expect: {
      must_call: (expectation.must_call as string[] | undefined) ?? [],
      must_not_call: (expectation.must_not_call as string[] | undefined) ?? [],
      max_questions: Number(expectation.max_questions ?? 4),
      plan_assertions:
        (expectation.plan_assertions as string[] | undefined) ?? [],
    },
    judge: (frontMatter.judge as string[] | undefined) ?? [],
    setup: readSection(body, 'Setup'),
    userSays: userLine ? userLine.slice(2) : '',
    scriptedReplies: readSection(body, 'Scripted replies'),
  };
};

const DEFAULT_AD_HOC_SETUP =
  'No earlier brief. Cap approved once: USD 5. Naukri extension not connected.';
const DEFAULT_AD_HOC_REPLIES =
  '- If asked for a target count: "25".\n- If asked what "in Mumbai" means: "reps based in Mumbai (companies anywhere in India)".\n- If asked which titles count as sales rep: "rep family (sales representative, medical representative, territory sales, field sales)".\n- If asked for a Bright Data / search budget: accept about 25 records / ~$0.05.\n- If asked anything else: accept the recommended option.';

// One prompt typed by hand, to see which path the skills take for it
export const adHocScenario = (
  prompt: string,
  setup: string = DEFAULT_AD_HOC_SETUP,
  scriptedReplies: string = DEFAULT_AD_HOC_REPLIES,
): SourcingScenario => ({
  id: 'adhoc',
  purpose: 'recruiting',
  repeat: 1,
  expect: {
    must_call: [],
    must_not_call: [],
    max_questions: 4,
    plan_assertions: [],
  },
  judge: [],
  setup,
  userSays: prompt,
  scriptedReplies,
});

export const loadScenarios =(directory: string): SourcingScenario[] =>
  readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.scenario.md'))
    .sort()
    .map((fileName) =>
      parseScenario(readFileSync(join(directory, fileName), 'utf-8')),
    );
