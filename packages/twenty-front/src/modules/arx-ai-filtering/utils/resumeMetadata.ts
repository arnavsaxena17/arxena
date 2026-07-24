import { RESUME_METADATA_FIELD } from '@/arx-ai-filtering/right-side/constants';
import type { Enrichment } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';

export const normalizeEnrichmentResumeFlag = (
  enrichment: Enrichment,
): Enrichment => {
  const selectedMetadataFields = enrichment.selectedMetadataFields || [];
  const hasResumeMarker = selectedMetadataFields.includes(RESUME_METADATA_FIELD);

  return {
    ...enrichment,
    includeResume: enrichment.includeResume === true || hasResumeMarker,
    selectedMetadataFields: selectedMetadataFields.filter(
      (field) => field !== RESUME_METADATA_FIELD,
    ),
  };
};

export const buildSelectedMetadataFieldsForPersist = (
  enrichment: Enrichment,
): string[] => {
  const fields = (enrichment.selectedMetadataFields || []).filter(
    (field) => field !== RESUME_METADATA_FIELD,
  );

  if (enrichment.includeResume) {
    return [...fields, RESUME_METADATA_FIELD];
  }

  return fields;
};

export const hasAiFilterContext = (enrichment: Enrichment): boolean => {
  return (
    (enrichment.selectedMetadataFields?.length ?? 0) > 0 ||
    enrichment.includeResume === true
  );
};
