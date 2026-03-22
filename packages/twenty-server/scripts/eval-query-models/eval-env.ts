import { ALL_MODELS, ALL_PROMPT_MODES, ALL_SEARCH_TYPES, REQUIREMENTS, type PromptMode, type SearchType } from './constants';
import type { EvalModel, EvalRequirement } from './eval-types';

function parseCommaEnvList(envValue: string | undefined): string[] | null {
  if (!envValue?.trim()) return null;
  return envValue.split(',').map(s => s.trim()).filter(Boolean);
}

export function resolveFilteredSets(): { models: EvalModel[]; reqs: EvalRequirement[]; searchTypes: SearchType[]; promptModes: PromptMode[] } {
  const modelFilter = parseCommaEnvList(process.env.EVAL_MODELS);
  const reqFilter   = parseCommaEnvList(process.env.EVAL_REQS);
  const typeRaw     = parseCommaEnvList(process.env.EVAL_SEARCH_TYPES);
  const modeRaw     = parseCommaEnvList(process.env.EVAL_PROMPT_MODE);

  const models = modelFilter
    ? ALL_MODELS.filter(m => modelFilter.includes(m.id))
    : ALL_MODELS;
  const reqs = reqFilter
    ? REQUIREMENTS.filter(r => reqFilter.includes(r.id))
    : REQUIREMENTS;
  const searchTypes   = (typeRaw as SearchType[] | null) ?? ALL_SEARCH_TYPES;
  const promptModes   = modeRaw
    ? ALL_PROMPT_MODES.filter(p => modeRaw.includes(p))
    : ['detailed' as PromptMode];

  return { models, reqs, searchTypes, promptModes };
}
