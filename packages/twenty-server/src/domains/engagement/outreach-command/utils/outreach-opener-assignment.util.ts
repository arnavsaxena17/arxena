export type OutreachOpenerVariant = 'question' | 'demo';

export type OutreachOpenerShape =
  | 'observation_question'
  | 'thanks_question'
  | 'fact_comment';

const OUTREACH_OPENER_SHAPES: readonly OutreachOpenerShape[] = [
  'observation_question',
  'thanks_question',
  'fact_comment',
];

const hashOutreachSeed = (seed: string): number => {
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
};

// Deterministic, so a retry or a re-run keeps the same shape for the same prospect.
export const pickOutreachOpenerShape = (seed: string): OutreachOpenerShape =>
  OUTREACH_OPENER_SHAPES[
    hashOutreachSeed(`shape:${seed}`) % OUTREACH_OPENER_SHAPES.length
  ];

// 50/50 split for the question-ask vs demo-ask test.
export const pickOutreachOpenerVariant = (
  seed: string,
): OutreachOpenerVariant =>
  hashOutreachSeed(`variant:${seed}`) % 2 === 0 ? 'question' : 'demo';

export const OUTREACH_OPENER_SHAPE_RULES: Record<OutreachOpenerShape, string> =
  {
    observation_question:
      'SHAPE: one fact in their own words, then one question. Two to three short sentences.',
    thanks_question:
      'SHAPE: a brief thanks for accepting, then one specific question. Two sentences. Naming the fact is optional here.',
    fact_comment:
      'SHAPE: a short remark on the fact that shows you understood it, then one light question. Three sentences at most.',
  };

export const OUTREACH_OPENER_ASK_RULES: Record<OutreachOpenerVariant, string> =
  {
    question:
      'ASK: one easy question about how they run things today, answerable in one sentence. Do not ask for a call, demo, walkthrough, or time. Do not name the sender company or product.',
    demo: 'ASK: one soft offer to show them how this would look for their business, phrased as a question they can say no to. No clock times, no links, no product features.',
  };

export const OUTREACH_OPENER_SHAPE_RULE_MARKER =
  '<<<OUTREACH_OPENER_SHAPE_RULE>>>';
export const OUTREACH_OPENER_ASK_RULE_MARKER = '<<<OUTREACH_OPENER_ASK_RULE>>>';
export const OUTREACH_OPENER_SEED_MARKER_PREFIX = '<<<OUTREACH_OPENER_SEED:';
export const OUTREACH_OPENER_SEED_MARKER_SUFFIX = '>>>';

// After workflow chip resolve, fill deferred shape/ask rules from the candidate id.
export const applyOutreachOpenerSeedRewrite = (prompt: string): string => {
  const seedMarkerStart = prompt.indexOf(OUTREACH_OPENER_SEED_MARKER_PREFIX);

  if (seedMarkerStart < 0) {
    return prompt;
  }

  const seedStart = seedMarkerStart + OUTREACH_OPENER_SEED_MARKER_PREFIX.length;
  const seedEnd = prompt.indexOf(OUTREACH_OPENER_SEED_MARKER_SUFFIX, seedStart);

  if (seedEnd < 0) {
    return prompt;
  }

  const seed = prompt.slice(seedStart, seedEnd).trim();

  if (seed.length === 0 || seed.includes('{{')) {
    return prompt;
  }

  const variant = pickOutreachOpenerVariant(seed);
  const shape = pickOutreachOpenerShape(seed);
  const seedMarker = prompt.slice(
    seedMarkerStart,
    seedEnd + OUTREACH_OPENER_SEED_MARKER_SUFFIX.length,
  );

  return prompt
    .replaceAll(
      OUTREACH_OPENER_SHAPE_RULE_MARKER,
      OUTREACH_OPENER_SHAPE_RULES[shape],
    )
    .replaceAll(
      OUTREACH_OPENER_ASK_RULE_MARKER,
      OUTREACH_OPENER_ASK_RULES[variant],
    )
    .replace(
      seedMarker,
      `Opener assignment: shape=${shape}, variant=${variant}`,
    );
};
