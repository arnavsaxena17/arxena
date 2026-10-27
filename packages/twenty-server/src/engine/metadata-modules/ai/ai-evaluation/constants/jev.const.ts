export const JEV_MODEL_ID = 'typesafe-ai/jev';

export const JEV_MODEL_ALIASES = [
  JEV_MODEL_ID,
  'jev',
  'typesafe/jev',
  'typesafe/jev-latest',
  'typesafe/jev-1.13',
] as const;

// OpenRouter decisions endpoint (same path as JevDecisionsService)
export const JEV_EVALUATE_URL = 'https://openrouter.ai/api/alpha/decisions';

// Wire model id for OpenRouter; UI / isJevModelId still use JEV_MODEL_ID aliases
export const JEV_OPENROUTER_MODEL_ID = 'typesafe/jev-1.13';

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
