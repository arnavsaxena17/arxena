import { enrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';
import { DEFAULT_ENRICHMENT, DEFAULT_FIELD } from '../constants';
import { NewField } from '../types';

export const useEnrichmentState = (index: number) => {
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [showAddField, setShowAddField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [newField, setNewField] = useState<NewField>(DEFAULT_FIELD);
  const [error, setError] = useState<string>('');

  // Initialize local state with deep copy of current enrichment
  const currentEnrichment = useMemo(() => {
    if (!enrichments[index]) {
      return DEFAULT_ENRICHMENT;
    }

    return {
      ...DEFAULT_ENRICHMENT,
      ...enrichments[index],
      fields: enrichments[index].fields.map(field => ({
        ...field,
        enumValues: field.enumValues || []
      })),
      selectedMetadataFields: [...(enrichments[index].selectedMetadataFields || [])]
    };
  }, [enrichments, index]);

  // Reset local state when switching enrichments
  useEffect(() => {
    const currentEnrichment = enrichments[index];
    if (currentEnrichment) {
      // Reset form state
      setNewField(DEFAULT_FIELD);
      
      if (typeof currentEnrichment?.bestOf === 'undefined') {
        setEnrichments(prev => {
          const newEnrichments = [...prev];
          if (newEnrichments[index]) {
            newEnrichments[index] = {
              ...newEnrichments[index],
              bestOf: 1
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

  const updateEnrichment = useCallback((updates: Partial<typeof currentEnrichment>) => {
    setEnrichments(prev => {
      const newEnrichments = [...prev];
      if (newEnrichments[index]) {
        newEnrichments[index] = {
          ...newEnrichments[index],
          ...updates
        };
      }
      return newEnrichments;
    });
  }, [index, setEnrichments]);

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
    resetForm
  };
};
