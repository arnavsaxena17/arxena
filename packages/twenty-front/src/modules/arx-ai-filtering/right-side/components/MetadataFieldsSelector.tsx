import React from 'react';
import { IconX } from 'twenty-ui';
import { OtherFieldKey } from '../types';
import {
    CheckboxField,
    CheckboxFieldsContainer,
    FieldsLoadingContainer,
    LoadingIndicator,
    SelectedFieldsContainer,
    SelectedFieldTag
} from './StyledComponents';

type MetadataFieldsSelectorProps = {
  otherFieldKeys: OtherFieldKey[];
  isLoadingFields: boolean;
  apiError: string | null;
  selectedMetadataFields: string[];
  onFieldToggle: (fieldName: string, isChecked: boolean) => void;
  onFieldRemove: (fieldName: string) => void;
};

export const MetadataFieldsSelector: React.FC<MetadataFieldsSelectorProps> = ({
  otherFieldKeys,
  isLoadingFields,
  apiError,
  selectedMetadataFields,
  onFieldToggle,
  onFieldRemove
}) => {
  if (isLoadingFields) {
    return (
      <FieldsLoadingContainer>
        <LoadingIndicator>Loading fields...</LoadingIndicator>
      </FieldsLoadingContainer>
    );
  }

  if (apiError) {
    return (
      <FieldsLoadingContainer>
        <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>
          {apiError}
        </div>
      </FieldsLoadingContainer>
    );
  }

  return (
    <>
      <CheckboxFieldsContainer>
        {otherFieldKeys.map((field, idx) => (
          <CheckboxField key={`${field.name}-${idx}`}>
            <input
              type="checkbox"
              id={`field-${field.name}-${idx}`}
              checked={selectedMetadataFields.includes(field.name)}
              onChange={(e) => onFieldToggle(field.name, e.target.checked)}
            />
            <label htmlFor={`field-${field.name}-${idx}`}>
              {field.label || field.name}
            </label>
          </CheckboxField>
        ))}
      </CheckboxFieldsContainer>
      
      {otherFieldKeys.length === 0 && !isLoadingFields && (
        <div style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          No custom fields found for this job. Using default metadata fields.
        </div>
      )}

      {selectedMetadataFields.length > 0 && (
        <SelectedFieldsContainer>
          {selectedMetadataFields
            .filter((fieldName: string, index: number, self: string[]) => 
              self.indexOf(fieldName) === index)
            .map((fieldName: string) => (
              <SelectedFieldTag key={`selected-${fieldName}`}>
                {fieldName}
                <IconX size={14} stroke={1.5} style={{ cursor: 'pointer' }} onClick={() => onFieldRemove(fieldName)} />
              </SelectedFieldTag>
            ))}
        </SelectedFieldsContainer>
      )}
    </>
  );
};
