import { atom } from 'recoil';
import { createState } from 'twenty-ui';

export type EnrichmentField = {
  id: number;
  name: string;
  type: string;
  description: string;
  required: boolean;
  enumValues?: string[];
};

export type Enrichment = {
  modelName: string;
  fields: EnrichmentField[];
  selectedMetadataFields: string[];
  filterDescription: string;
  prompt: string;
  selectedModel: string;
  bestOf: number;
};

export const isArxEnrichModalOpenState = atom<boolean>({
  key: 'isArxEnrichModalOpenState',
  default: false,
});

export const enrichmentsState = atom<Enrichment[]>({
  key: 'enrichmentsState',
  default: [],
});

export const sampleEnrichmentsState = atom<Enrichment[]>({
  key: 'sampleEnrichmentsState',
  default: []
});

export const activeEnrichmentState = atom<number | null>({
  key: 'activeEnrichmentState',
  default: null,
});

export const recordsToEnrichState = createState<any[]>({
  key: 'recordsToEnrichState',
  defaultValue: [],
});

export const currentJobIdState = atom<string>({
  key: 'currentJobIdState',
  default: '',
});