export const AVAILABLE_MODELS = [
  {
    color: "green",
    label: "GPT 3.5 Turbo",
    position: 0,
    value: "gpt35turbo"
  },
  {
    color: "turquoise",
    label: "GPT-4o",
    position: 1,
    value: "gpt4o"
  },
  {
    color: "turquoise",
    label: "gpt-4o-mini",
    position: 1,
    value: "gpt4omini"
  },
  {
    color: "turquoise",
    label: "gpt-4o-mini-search-preview",
    position: 1,
    value: "gpt4ominisearchpreview"
  },
];

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum', label: 'Enum' },
] as const;

export const DEFAULT_FIELD = {
  name: '',
  type: 'text' as const,
  description: '',
  enumValues: [],
  required: false
};

export const DEFAULT_ENRICHMENT = {
  modelName: '',
  prompt: '',
  fields: [],
  filterDescription: '',
  selectedMetadataFields: [],
  selectedModel: 'gpt4omini',
  bestOf: 1,
};
