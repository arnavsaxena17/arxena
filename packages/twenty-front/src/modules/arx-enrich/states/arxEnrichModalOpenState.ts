import { createState } from 'twenty-ui';

export const isArxEnrichModalOpenState = createState<boolean>({
  key: 'isArxEnrichModalOpenState',
  defaultValue: false,
});

export const enrichmentsState = createState<any[]>({
  key: 'enrichmentsState',
  defaultValue: [{
    modelName: '',
    prompt: '',
    fields: [],
    aiFilterDescription: '',
    selectedMetadataFields: [],
    selectedModel: 'gpt4omini',
    bestOf: 1
  }],
});

export const activeEnrichmentState = createState<number>({
  key: 'activeEnrichmentState',
  defaultValue: 0,
});

export const recordsToEnrichState = createState<any[]>({
  key: 'recordsToEnrichState',
  defaultValue: [],
});

export const currentJobIdState = createState<string | null>({
  key: 'currentJobIdState',
  defaultValue: null,
});