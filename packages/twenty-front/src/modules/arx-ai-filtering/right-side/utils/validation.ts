import { EnrichmentField } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';

export const validateFieldName = (
  name: string, 
  fields: EnrichmentField[], 
  editingFieldId: number | null
): string => {
  if (!name) {
    return 'Field name is required';
  }
  
  // Strict camelCase validation
  if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
    return 'Field name must be in camelCase (start with lowercase letter, followed by letters/numbers)';
  }

  const isDuplicate = fields.some(
    (field: { name: string; id: number }) => 
      field.name.toLowerCase() === name.toLowerCase() && 
      field.id !== editingFieldId
  );
  
  if (isDuplicate) {
    return 'Field name must be unique';
  }
  
  return '';
};

export const validateModelName = (name: string): string => {
  if (!name) return 'Model name is required';
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    return 'Model name must start with a capital letter and contain only letters and numbers';
  }
  return '';
};
