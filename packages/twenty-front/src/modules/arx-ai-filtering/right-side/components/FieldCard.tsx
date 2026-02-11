import { EnrichmentField } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { IconEdit, IconX } from '@tabler/icons-react';
import { Button } from '@ui/input/button/components/Button';
import React from 'react';
import { NewField } from '../types';
import { FieldForm } from './FieldForm';
import {
    FieldCard,
    FieldContainer,
    FieldContent,
    FieldDescription,
    FieldHeader,
    FieldName,
    FieldType
} from './StyledComponents';

type FieldCardComponentProps = {
  field: EnrichmentField;
  editingFieldId: number | null;
  newField: NewField;
  setNewField: (field: NewField) => void;
  onEdit: (field: EnrichmentField) => void;
  onRemove: (fieldId: number) => void;
  onSave: (e?: React.MouseEvent) => void;
  onCancel: () => void;
  error: string;
  setError: (error: string) => void;
  validateFieldName: (name: string) => string;
};

export const FieldCardComponent: React.FC<FieldCardComponentProps> = ({
  field,
  editingFieldId,
  newField,
  setNewField,
  onEdit,
  onRemove,
  onSave,
  onCancel,
  error,
  setError,
  validateFieldName
}) => {
  return (
    <FieldContainer key={field.id}>
      <FieldCard>
        <FieldContent>
          <FieldHeader>
            <FieldName>{field.name}</FieldName>
            <FieldType>({field.type})</FieldType>
          </FieldHeader>
          <FieldDescription>{field.description}</FieldDescription>
        </FieldContent>
        <Button
          Icon={IconEdit}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(field);
          }}
          variant="secondary"
          title="Edit"
        />
        <Button 
          Icon={IconX} 
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(field.id);
          }} 
          variant="secondary" 
          title="Remove"
          type="button"
        />
      </FieldCard>
      
      {editingFieldId === field.id && (
        <FieldForm
          newField={newField}
          setNewField={setNewField}
          onSave={onSave}
          onCancel={onCancel}
          error={error}
          setError={setError}
          validateFieldName={validateFieldName}
        />
      )}
    </FieldContainer>
  );
};
