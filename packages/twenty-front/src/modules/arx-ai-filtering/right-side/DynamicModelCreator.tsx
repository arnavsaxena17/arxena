import { IconAlertCircle, IconPlus } from 'twenty-ui/icons';
import { candidateDataState, processedDataSelector } from '@/candidate-table/states/states';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { Button } from 'twenty-ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

// Local imports
import { AVAILABLE_MODELS, DEFAULT_FIELD } from './constants';
import { useApiCalls } from './hooks/useApiCalls';
import { useDebounce } from './hooks/useDebounce';
import { useEnrichmentState } from './hooks/useEnrichmentState';
import { DynamicModelCreatorProps } from './types';
import { generateModelCode } from './utils/modelCode';
import { validateFieldName, validateModelName } from './utils/validation';
import { normalizeEnrichmentResumeFlag } from '@/arx-ai-filtering/utils/resumeMetadata';

// Components
import { FieldCardComponent } from './components/FieldCard';
import { FieldForm } from './components/FieldForm';
import { MetadataFieldsSelector } from './components/MetadataFieldsSelector';
import { SampleOpenAICall } from './components/SampleOpenAICall';
import { TokenAnalysisComponent } from './components/TokenAnalysis';

// Styled components
import {
    Container,
    ErrorAlert,
    FieldsList,
    SelectLabel,
    StyledInput,
    StyledSelect,
    StyledTextArea
} from './components/StyledComponents';

const DynamicModelCreator: React.FC<DynamicModelCreatorProps> = ({ 
  objectNameSingular, 
  index, 
  onError,
  otherFieldKeys,
  isLoadingFields,
  apiError
}) => {
    const processedData = useRecoilValue(processedDataSelector);
  const candidateData = useRecoilValue(candidateDataState);
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: objectNameSingular,
  });

  // Custom hooks
  const {
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
  } = useEnrichmentState(index);

  const {
    isProcessing,
    isComputingTokens,
    tokenAnalysis,
    processAIFilter,
    computeTokens
  } = useApiCalls(index, onError);

  // Local state for filter description with debouncing
  const [localFilterDescription, setLocalFilterDescription] = useState(
    currentEnrichment.filterDescription || ''
  );
  const debouncedFilterDescription = useDebounce(localFilterDescription, 500);

  // Update enrichments when debounced value changes
  useEffect(() => {
    updateEnrichment({ filterDescription: debouncedFilterDescription });
  }, [debouncedFilterDescription, updateEnrichment]);

  // Field validation
  const validateFieldNameCallback = useCallback((name: string) => {
    return validateFieldName(name, currentEnrichment.fields, editingFieldId);
  }, [currentEnrichment.fields, editingFieldId]);

  // Event handlers
  const handleModelNameChange = useCallback((value: string) => {
    const validationError = validateModelName(value);
    if (validationError) {
      setError(validationError);
    } else {
      setError('');
      updateEnrichment({ modelName: value });
    }
  }, [setError, updateEnrichment]);

  const handleAddField = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const nameValidationError = validateFieldNameCallback(newField.name);
    if (nameValidationError) {
      setError(nameValidationError);
      return;
    }

    const fieldToAdd = {
      ...newField,
      enumValues: newField.type === 'enum' ? (newField.enumValues || []) : []
    };

    const updatedFields = editingFieldId 
      ? currentEnrichment.fields.map(field => 
          field.id === editingFieldId ? { ...fieldToAdd, id: editingFieldId } : field)
      : [...currentEnrichment.fields, { ...fieldToAdd, id: Date.now() }];

    updateEnrichment({ fields: updatedFields });

    if (!editingFieldId) {
      setNewField(DEFAULT_FIELD);
      setShowAddField(false);
    }
    setEditingFieldId(null);
    setError('');
  }, [newField, editingFieldId, currentEnrichment.fields, validateFieldNameCallback, setError, updateEnrichment, setNewField, setShowAddField, setEditingFieldId]);

  const handleRemoveField = useCallback((fieldId: number) => {
    if (currentEnrichment.fields.length <= 1) {
      setError('Minimum 1 field is required. Cannot remove the last field.');
      // Scroll to top to make error message visible
      const formElement = document.getElementById('NewArxEnrichForm');
      formElement?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const updatedFields = currentEnrichment.fields.filter(field => field.id !== fieldId);
    updateEnrichment({ fields: updatedFields });
    setError('');
  }, [currentEnrichment.fields, setError, updateEnrichment]);

  const handleEditField = useCallback((field: any) => {
    setEditingFieldId(field.id);
    setNewField(field);
  }, [setEditingFieldId, setNewField]);

  const handleFieldToggle = useCallback((fieldName: string, isChecked: boolean) => {
    const currentSelected = currentEnrichment.selectedMetadataFields || [];
    const updatedSelected = isChecked
      ? [...new Set([...currentSelected, fieldName])]
      : currentSelected.filter(name => name !== fieldName);
    
    updateEnrichment({ selectedMetadataFields: updatedSelected });
  }, [currentEnrichment.selectedMetadataFields, updateEnrichment]);

  const handleFieldRemove = useCallback((fieldName: string) => {
    const updatedSelected = currentEnrichment.selectedMetadataFields.filter(
      name => name !== fieldName
    );
    updateEnrichment({ selectedMetadataFields: updatedSelected });
  }, [currentEnrichment.selectedMetadataFields, updateEnrichment]);

  const handleIncludeResumeToggle = useCallback((isChecked: boolean) => {
    updateEnrichment({ includeResume: isChecked });
  }, [updateEnrichment]);

  const handleProcessAIFilter = useCallback(async () => {
    try {
      const config = await processAIFilter(localFilterDescription, otherFieldKeys);
      if (config) {
        const normalized = normalizeEnrichmentResumeFlag({
          modelName: config.modelName,
          prompt: config.prompt,
          fields: config.fields || [],
          selectedMetadataFields: config.selectedMetadataFields || [],
          selectedModel: config.selectedModel || 'gpt4omini',
          bestOf: config.bestOf || 1,
        });
        updateEnrichment(normalized);
      }
    } catch (error) {
      // Error is handled in the hook
    }
  }, [processAIFilter, localFilterDescription, otherFieldKeys, updateEnrichment]);

  const handleComputeTokens = useCallback(async () => {
    try {
      await computeTokens(currentEnrichment);
    } catch (error) {
      // Error is handled in the hook
    }
  }, [computeTokens, currentEnrichment]);

  // Generate model code
  const modelCode = generateModelCode(currentEnrichment.modelName, currentEnrichment.fields);

  return (
    <Container>
      {error && (
        <ErrorAlert>
          <IconAlertCircle size={16} stroke={1.5} />
          {error}
        </ErrorAlert>
      )}

      {/* AI Filter Description - Only show when processAIFilter has not been done */}
      {!currentEnrichment.prompt || !currentEnrichment.selectedMetadataFields?.length ? (
        <>
          <SelectLabel>AI Filter Description</SelectLabel>
          <StyledTextArea
            placeholder="Enter your AI filter description here..."
            value={localFilterDescription}
            onChange={e => setLocalFilterDescription(e.target.value)}
            rows={4}
          />

          {/* Process AI Filter Button */}
          <Button
            variant="primary"
            title="Process AI Filter"
            onClick={handleProcessAIFilter}
            disabled={isProcessing}
            type="button"
          >
            {isProcessing ? 'Processing...' : 'Process AI Filter'}
          </Button>
        </>
      ) : null}

      {/* Model Name */}
      {currentEnrichment.modelName && (
        <>
          <SelectLabel>Model Name</SelectLabel>
          <StyledInput
            type="text"
            placeholder="Model Name"
            value={currentEnrichment.modelName}
            onChange={e => handleModelNameChange(e.target.value)}
          />
        </>
      )}

      {/* Prompt */}
      {currentEnrichment.prompt && (
        <>
          <SelectLabel>Prompt</SelectLabel>
          <StyledTextArea
            placeholder="Enter your prompt here..."
            value={currentEnrichment.prompt}
            onChange={e => updateEnrichment({ prompt: e.target.value })}
            rows={4}
          />
        </>
      )}

      {/* Model Selection */}
      {currentEnrichment.selectedModel  && (
        <>
          <SelectLabel>Select Model</SelectLabel>
          <StyledSelect
            value={currentEnrichment.selectedModel}
            onChange={e => updateEnrichment({ selectedModel: e.target.value })}
          >
            <option>Select a model...</option>
            {AVAILABLE_MODELS.map(model => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </StyledSelect>
        </>
      )}

      {/* Metadata Fields Selector - Only show after AI filter is processed */}
      {currentEnrichment.prompt && (
        <>
          <SelectLabel>Select Column Headers</SelectLabel>
          <MetadataFieldsSelector
            otherFieldKeys={otherFieldKeys}
            isLoadingFields={isLoadingFields}
            apiError={apiError}
            selectedMetadataFields={currentEnrichment.selectedMetadataFields}
            includeResume={currentEnrichment.includeResume === true}
            onFieldToggle={handleFieldToggle}
            onFieldRemove={handleFieldRemove}
            onIncludeResumeToggle={handleIncludeResumeToggle}
          />
        </>
      )}

      {/* Fields Management */}
      {currentEnrichment.fields?.length > 0 && (
        <>
          <SelectLabel>Create New Columns</SelectLabel>
          <FieldsList>
            {currentEnrichment.fields.map((field) => (
              <FieldCardComponent
                key={field.id}
                field={field}
                editingFieldId={editingFieldId}
                newField={newField}
                setNewField={setNewField}
                onEdit={handleEditField}
                onRemove={handleRemoveField}
                onSave={handleAddField}
                onCancel={resetForm}
                error={error}
                setError={setError}
                validateFieldName={validateFieldNameCallback}
              />
            ))}
          </FieldsList>
          
          {/* Add New Field Button */}
          {!showAddField && (
            <Button
              Icon={IconPlus}
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAddField(true);
                setEditingFieldId(null);
                setNewField(DEFAULT_FIELD);
                setError('');
              }}
              variant="secondary"
              title="Add New Field"
              type="button"
            >
              Add New Field
            </Button>
          )}
          
          {/* New Field Form */}
          {showAddField && (
            <FieldForm
              newField={newField}
              setNewField={setNewField}
              onSave={handleAddField}
              onCancel={resetForm}
              error={error}
              setError={setError}
              validateFieldName={validateFieldNameCallback}
            />
          )}
        </>
      )}

            {/* Sample Open AI Call */}
      {currentEnrichment.modelName && 
       currentEnrichment.prompt && 
       ((currentEnrichment.selectedMetadataFields?.length ?? 0) > 0 ||
         currentEnrichment.includeResume === true) && 
       candidateData && (
        <SampleOpenAICall
          prompt={currentEnrichment.prompt}
          selectedMetadataFields={currentEnrichment.selectedMetadataFields}
          includeResume={currentEnrichment.includeResume === true}
          fields={currentEnrichment.fields}
          candidateData={candidateData}
        />
      )}

      {/* Best Of Setting */}
      {currentEnrichment.bestOf !== 1 && (
        <>
          <SelectLabel>Best Of</SelectLabel>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '90%'
          }}>
            <StyledInput
              type="number"
              min="1"
              value={currentEnrichment.bestOf}
              onChange={e => {
                const value = parseInt(e.target.value) || 1;
                updateEnrichment({ bestOf: value });
              }}
              style={{ width: '80px' }}
            />
          </div>
        </>
      )}

      {/* Token Analysis */}
      {currentEnrichment.fields.length > 0 && (
        <TokenAnalysisComponent
          show={true}
          modelCode={modelCode}
          isComputingTokens={isComputingTokens}
          tokenAnalysis={tokenAnalysis}
          onComputeTokens={handleComputeTokens}
        />
      )}
    </Container>
  );
};
export default DynamicModelCreator;