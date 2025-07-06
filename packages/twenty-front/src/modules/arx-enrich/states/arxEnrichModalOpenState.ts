import { atom } from 'recoil';
import { createState } from 'twenty-ui';

export type EnrichmentField = {
  name: string;
  type: string;
  description: string;
  id: number;
  enumValues?: string[];
};

export type Enrichment = {
  modelName: string;
  prompt: string;
  fields: EnrichmentField[];
  filterDescription: string;
  selectedMetadataFields: string[];
  selectedModel: string;
  bestOf?: number;
  createdAt?: string;
};

export const isArxEnrichModalOpenState = createState<boolean>({
  key: 'isArxEnrichModalOpenState',
  defaultValue: false,
});

export const enrichmentsState = atom<Enrichment[]>({
  key: 'enrichmentsState',
  default: []
});

export const sampleEnrichmentsState = atom<Enrichment[]>({
  key: 'sampleEnrichmentsState',
  default: []
});

export const activeEnrichmentState = atom<number>({
  key: 'activeEnrichmentState',
  default: 0
});

export const recordsToEnrichState = createState<any[]>({
  key: 'recordsToEnrichState',
  defaultValue: [],
});

export const currentJobIdState = createState<string | null>({
  key: 'currentJobIdState',
  defaultValue: null,
});