import { ANTHROPIC_TOOL_CLASSIC, ANTHROPIC_TOOL_RECRUITER, ANTHROPIC_TOOL_SALES_NAV } from './anthropic-tools';
import type { PromptMode, SearchType } from './constants';
import {
  CLASSIC_PROMPT,
  RECRUITER_PROMPT,
  SALES_NAV_PROMPT,
  SIMPLE_CLASSIC_PROMPT,
  SIMPLE_RECRUITER_PROMPT,
  SIMPLE_SALES_NAV_PROMPT,
} from './prompts/generation-prompts';
import {
  multiClassicSchema,
  multiRecruiterSchema,
  multiSalesNavSchema,
} from './schemas';

export function getSearchTypeConfig(searchType: SearchType, promptMode: PromptMode = 'detailed') {
  if (searchType === 'recruiter') {
    return {
      prompt: promptMode === 'simple' ? SIMPLE_RECRUITER_PROMPT : RECRUITER_PROMPT,
      schema: multiRecruiterSchema,
      anthropicTool: ANTHROPIC_TOOL_RECRUITER,
      noun: 'Recruiter People Search',
    };
  }
  if (searchType === 'sales_navigator') {
    return {
      prompt: promptMode === 'simple' ? SIMPLE_SALES_NAV_PROMPT : SALES_NAV_PROMPT,
      schema: multiSalesNavSchema,
      anthropicTool: ANTHROPIC_TOOL_SALES_NAV,
      noun: 'Sales Navigator People Search',
    };
  }
  return {
    prompt: promptMode === 'simple' ? SIMPLE_CLASSIC_PROMPT : CLASSIC_PROMPT,
    schema: multiClassicSchema,
    anthropicTool: ANTHROPIC_TOOL_CLASSIC,
    noun: 'Classic LinkedIn People Search',
  };
}

export function injectApiField(requests: Record<string, unknown>[], searchType: SearchType): Record<string, unknown>[] {
  const apiVal = searchType === 'recruiter'
    ? 'recruiter'
    : searchType === 'sales_navigator'
      ? 'sales_navigator'
      : 'classic';
  return requests.map(r => ({ api: apiVal, category: 'people', ...r }));
}
