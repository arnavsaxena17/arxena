import { ALL_MODELS, REQUIREMENTS, type PromptMode, type SearchType } from './constants';
import type { AnySearchRequest } from './schemas';
import type { ScoreBreakdown } from './scoring';

export type RunResult = {
  modelId:       string;
  modelLabel:    string;
  reqId:         string;
  reqLabel:      string;
  searchType:    SearchType;
  promptMode:    PromptMode;
  score:         ScoreBreakdown | null;
  queries:       AnySearchRequest[];
  raw:           string;
  error:         string | null;
  durationMs:    number;
  inputTokens:   number;
  outputTokens:  number;
  cachedTokens:  number;   // tokens served from OpenAI prompt cache (50% price)
  costUsd:       number;
  evalCostUsd:   number;
};

export type EvalModel = (typeof ALL_MODELS)[number];
export type EvalRequirement = (typeof REQUIREMENTS)[number];

export type WorkItem = {
  searchType:  SearchType;
  promptMode:  PromptMode;
  model:       EvalModel;
  req:         EvalRequirement;
  idx:         number;
};

export type OverallSummary = {
  model: EvalModel;
  avgTotal: number | null;
  errors: number;
  avgMs: number;
  avgCost: number;
};
