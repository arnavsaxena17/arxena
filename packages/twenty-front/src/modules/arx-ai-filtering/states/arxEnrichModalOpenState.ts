import { atom } from 'recoil';
import { createState } from 'twenty-ui';
import type { AiFilter, AiFilterField } from 'twenty-shared';

export type { AiFilter, AiFilterField };

export type AiFilterWithDescription = AiFilter & { filterDescription?: string };

export const isArxAiFilteringModalOpenState = atom<boolean>({
  key: 'isArxAiFilteringModalOpenState',
  default: false,
});

export const isArxAiFilteringModalMinimizedState = atom<boolean>({
  key: 'isArxAiFilteringModalMinimizedState',
  default: false,
});

export const aiFiltersState = atom<AiFilterWithDescription[]>({
  key: 'aiFiltersState',
  default: [],
});

export const sampleAiFiltersState = atom<AiFilterWithDescription[]>({
  key: 'sampleAiFiltersState',
  default: []
});

export const activeAiFilterState = atom<number | null>({
  key: 'activeAiFilterState',
  default: null,
});

export const recordsToAiFilterState = createState<any[]>({
  key: 'recordsToAiFilterState',
  defaultValue: [],
});

export const currentJobIdState = atom<string>({
  key: 'currentJobIdState',
  default: '',
});

export const isArxEnrichModalOpenState = isArxAiFilteringModalOpenState;
export const isArxEnrichModalMinimizedState = isArxAiFilteringModalMinimizedState;
export const enrichmentsState = aiFiltersState;
export const sampleEnrichmentsState = sampleAiFiltersState;
export const activeEnrichmentState = activeAiFilterState;
export const recordsToEnrichState = recordsToAiFilterState;
export type Enrichment = AiFilterWithDescription;
export type EnrichmentField = AiFilterField;