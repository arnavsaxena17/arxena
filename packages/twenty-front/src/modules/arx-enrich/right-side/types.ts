import { EnrichmentField } from '@/arx-enrich/states/arxEnrichModalOpenState';

export type FieldType = 'text' | 'number' | 'boolean' | 'enum';

export type ModelOption = {
  color: string;
  label: string;
  position: number;
  value: string;
};

export type FieldTypeOption = {
  value: FieldType;
  label: string;
};

export type CandidateField = {
  name: string;
  label: string;
};

export type TokenAnalysis = {
  total_input_tokens: number;
  total_output_tokens: number;
  total_candidates: number;
  total_cost: number;
  cost_statistics: {
    mean_cost: number;
  };
};

export type DynamicModelCreatorProps = {
  objectNameSingular: string;
  index: number;
  onError: (error: string) => void;
  candidateFields: CandidateField[];
  isLoadingFields: boolean;
  apiError: string | null;
};

export type NewField = Omit<EnrichmentField, 'id'>;
