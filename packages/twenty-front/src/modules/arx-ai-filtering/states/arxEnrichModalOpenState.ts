import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { AiFilter, AiFilterField } from 'twenty-shared/arx';

export type { AiFilter, AiFilterField };

export type AiFilterWithDescription = AiFilter & {
  filterDescription?: string;
  createdAt?: string;
};

export const isArxAiFilteringModalOpenState = createAtomState<boolean>({
  key: 'isArxAiFilteringModalOpenState',
  defaultValue: false,
});

export const isArxAiFilteringModalMinimizedState = createAtomState<boolean>({
  key: 'isArxAiFilteringModalMinimizedState',
  defaultValue: false,
});

export const aiFiltersState = createAtomState<AiFilterWithDescription[]>({
  key: 'aiFiltersState',
  defaultValue: [],
});

export const sampleAiFiltersState = createAtomState<AiFilterWithDescription[]>({
  key: 'sampleAiFiltersState',
  defaultValue: [],
});

export const activeAiFilterState = createAtomState<number | null>({
  key: 'activeAiFilterState',
  defaultValue: null,
});

export const recordsToAiFilterState = createAtomState<any[]>({
  key: 'recordsToAiFilterState',
  defaultValue: [],
});

export const currentProjectIdState = createAtomState<string>({
  key: 'currentProjectIdState',
  defaultValue: '',
});

export const isArxEnrichModalOpenState = isArxAiFilteringModalOpenState;
export const isArxEnrichModalMinimizedState = isArxAiFilteringModalMinimizedState;
export const enrichmentsState = aiFiltersState;
export const sampleEnrichmentsState = sampleAiFiltersState;
export const activeEnrichmentState = activeAiFilterState;
export const recordsToEnrichState = recordsToAiFilterState;
export type Enrichment = AiFilterWithDescription;
export type EnrichmentField = AiFilterField;
