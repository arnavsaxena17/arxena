import { EnrichmentField } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';

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
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCandidates: number;
  estimatedCost: number;
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
