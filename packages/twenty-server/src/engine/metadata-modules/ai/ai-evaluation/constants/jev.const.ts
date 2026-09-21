export const JEV_MODEL_ID = 'typesafe-ai/jev';

export const JEV_MODEL_ALIASES = [
  JEV_MODEL_ID,
  'jev',
  'typesafe/jev',
  'typesafe/jev-latest',
  'typesafe/jev-1.13',
] as const;

export const JEV_EVALUATE_URL = 'https://ai-gateway.vercel.sh/v1/evaluate';

// Threshold for mapping Jev boolean probabilities to true/false
export const JEV_BOOLEAN_PROBABILITY_THRESHOLD = 0.5;

export const DEFAULT_JEV_SCORE_CRITERIA = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
] as const;
