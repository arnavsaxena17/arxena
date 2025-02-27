import { createState } from 'twenty-ui';

export const isArxEnrichModalOpenState = createState<boolean>({
  key: 'isArxEnrichModalOpenState',
  defaultValue: false,
});

export const enrichmentsState = createState<any[]>({
  key: 'enrichmentsState',
  defaultValue: [{
    modelName: '',
    prompt: '', // Add this field
    fields: [],
    selectedMetadataFields: [],
    selectedModel: 'gpt4omini',
  }],
});

export const activeEnrichmentState = createState<number | null>({
  key: 'activeEnrichmentState',
  defaultValue: null,
});