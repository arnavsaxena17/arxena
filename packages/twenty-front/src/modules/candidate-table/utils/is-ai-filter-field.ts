import { Enrichment } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';

export const isAiFilterField = (
  fieldName: string,
  aiFilters: Enrichment[],
) => {
  return aiFilters.some((enrichment) =>
    enrichment?.fields?.some((field: { name: string }) => field.name === fieldName),
  );
};
