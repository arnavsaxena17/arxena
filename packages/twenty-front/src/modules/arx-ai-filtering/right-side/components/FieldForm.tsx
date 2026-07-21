import { IconPlus, IconX } from 'twenty-ui/icons';
import { Button } from 'twenty-ui';
import React from 'react';

import { FIELD_TYPES } from '../constants';
import { NewField } from '../types';
import {
    AddFieldForm,
    ButtonGroup,
    EnumValueRow,
    EnumValuesInput,
    SelectLabel,
    StyledInput,
    StyledSelect,
    StyledTextArea
} from './StyledComponents';

type FieldFormProps = {
  newField: NewField;
  setNewField: (field: NewField) => void;
  onSave: (e?: React.MouseEvent) => void;
  onCancel: () => void;
  error: string;
  setError: (error: string) => void;
  validateFieldName: (name: string) => string;
};

export const FieldForm: React.FC<FieldFormProps> = ({
  newField,
  setNewField,
  onSave,
  onCancel,
  error,
  setError,
  validateFieldName
}) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const validationError = validateFieldName(newName);
    if (validationError) {
      setError(validationError);
    } else {
      setError('');
    }
    setNewField({ ...newField, name: newName });
  };

  const handleEnumValueChange = (idx: number, value: string) => {
    const newEnumValues = [...(newField.enumValues || [])];
    newEnumValues[idx] = value;
    setNewField({ ...newField, enumValues: newEnumValues });
  };

  const removeEnumValue = (idx: number) => {
    const newEnumValues = (newField.enumValues || []).filter((_, i) => i !== idx);
    setNewField({ ...newField, enumValues: newEnumValues });
  };

  const addEnumValue = () => {
    setNewField({
      ...newField,
      enumValues: [...(newField.enumValues || []), '']
    });
  };

  return (
    <AddFieldForm onSubmit={(e: React.FormEvent) => e.preventDefault()}>
      <StyledInput
        type="text"
        placeholder="Field Name"
        value={newField.name}
        onChange={handleNameChange}
      />
      
      <StyledSelect 
        value={newField.type} 
        onChange={e => setNewField({ ...newField, type: e.target.value as any })}
      >
        {FIELD_TYPES.map(type => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </StyledSelect>
      
      {newField.type === 'enum' && (
        <EnumValuesInput>
          <SelectLabel>Enum Values</SelectLabel>
          {(newField.enumValues || []).map((value, idx) => (
            <EnumValueRow key={idx}>
              <StyledInput
                type="text"
                value={value}
                onChange={e => handleEnumValueChange(idx, e.target.value)}
              />
              <Button
                Icon={IconX}
                variant="secondary"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeEnumValue(idx);
                }}
                title="Remove enum value"
                type="button"
              />
            </EnumValueRow>
          ))}
          <Button
            Icon={IconPlus}
            variant="secondary"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              addEnumValue();
            }}
            title="Add enum value"
            type="button"
          />
        </EnumValuesInput>
      )}

      <StyledTextArea 
        placeholder="Field Description" 
        value={newField.description} 
        onChange={e => setNewField({ ...newField, description: e.target.value })} 
        rows={3} 
      />

      <ButtonGroup>
        <Button 
          Icon={IconPlus}   
          onClick={(e: React.MouseEvent) => { 
            e.preventDefault(); 
            onSave(e);
          }}  
          variant="primary" 
          title="Save"
          type="button"
        />
        <Button
          variant="secondary"
          accent="danger"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          title="Cancel"
          type="button"
        />
      </ButtonGroup>
    </AddFieldForm>
  );
};
