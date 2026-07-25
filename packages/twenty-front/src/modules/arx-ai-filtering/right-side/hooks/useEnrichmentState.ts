import {
  enrichmentsState,
  type Enrichment,
  type EnrichmentField,
} from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ENRICHMENT, DEFAULT_FIELD } from '../constants';
import { NewField } from '../types';

export const useEnrichmentState = (index: number) => {
  const [enrichments, setEnrichments] = useAtomState(enrichmentsState);
  const [showAddField, setShowAddField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [newField, setNewField] = useState<NewField>(DEFAULT_FIELD);
  const [error, setError] = useState<string>('');

  const currentEnrichment = useMemo(() => {
    if (!enrichments[index]) {
      return DEFAULT_ENRICHMENT;
    }

    return {
      ...DEFAULT_ENRICHMENT,
      ...enrichments[index],
      fields: enrichments[index].fields.map((field: EnrichmentField) => ({
        ...field,
        enumValues: field.enumValues || [],
      })),
      selectedMetadataFields: [
        ...(enrichments[index].selectedMetadataFields || []),
      ],
    };
  }, [enrichments, index]);

  useEffect(() => {
    const currentEnrichmentItem = enrichments[index];
    if (currentEnrichmentItem) {
      setNewField(DEFAULT_FIELD);

      if (typeof currentEnrichmentItem?.bestOf === 'undefined') {
        setEnrichments((previousEnrichments) => {
          const newEnrichments = [...previousEnrichments];
          if (newEnrichments[index]) {
            newEnrichments[index] = {
              ...newEnrichments[index],
              bestOf: 1,
            };
          }
          return newEnrichments;
        });
      }

      setShowAddField(false);
      setEditingFieldId(null);
      setError('');
    }
  }, [index, enrichments, setEnrichments]);

  const updateEnrichment = useCallback(
    (updates: Partial<Enrichment>) => {
      setEnrichments((previousEnrichments) => {
        const newEnrichments = [...previousEnrichments];
        if (newEnrichments[index]) {
          newEnrichments[index] = {
            ...newEnrichments[index],
            ...updates,
          };
        }
        return newEnrichments;
      });
    },
    [index, setEnrichments],
  );

  const resetForm = useCallback(() => {
    setNewField(DEFAULT_FIELD);
    setShowAddField(false);
    setEditingFieldId(null);
    setError('');
  }, []);

  return {
    currentEnrichment,
    showAddField,
    setShowAddField,
    editingFieldId,
    setEditingFieldId,
    newField,
    setNewField,
    error,
    setError,
    updateEnrichment,
    resetForm,
  };
};
