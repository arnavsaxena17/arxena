import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { IconPlus, IconX, IconAlertCircle } from 'twenty-ui';
import { Button } from '@/ui/input/button/components/Button';
import { IconEdit } from '@tabler/icons-react';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useRecoilState } from 'recoil';
import { activeEnrichmentState, enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';


const AVAILABLE_MODELS = [
  {
    color: "green",
    label: "GPT 3.5 Turbo",
    position: 0,
    value: "gpt35turbo"
  },
  {
    color: "turquoise",
    label: "GPT-4o",
    position: 1,
    value: "gpt4o"
  },
  {
    color: "turquoise",
    label: "gpt-4o-mini",
    position: 1,
    value: "gpt4omini"
  },
];

const Container = styled.div`
//   max-width: 56rem;
  width:80%
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const sharedInputStyles = `
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  font-weight: 500;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  outline: none;
  font-family: inherit;
  transition: all 0.2s;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
`;

const Input = styled.input`
  ${sharedInputStyles}
  width: 90%;
`;

const TextArea = styled.textarea`
  ${sharedInputStyles}
  resize: vertical;
  width: 90%;
`;

const Select = styled.select`
  ${sharedInputStyles}
  width: 96%;
`;

const FieldsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FieldContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;
const EnumValuesInput = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const EnumValueRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;



const FieldCard = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  font-family: inherit;

  border-radius: 0.5rem;
  transition: all 0.2s;

  &:hover {
    border-color: #d1d5db;
  }
`;

const FieldContent = styled.div`
  flex: 1;
`;

const FieldHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FieldName = styled.span`
  font-weight: 500;
`;

const FieldType = styled.span`
  color: #6b7280;
  font-size: 0.875rem;
`;

const RequiredBadge = styled.span`
  color: #ef4444;
  font-size: 0.75rem;
`;

const FieldDescription = styled.p`
  color: #4b5563;
  font-size: 0.875rem;
  margin-top: 0.25rem;
`;

const AddFieldForm = styled.div`
  padding: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
    form {
    margin: 0;
  }

`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CodeBlock = styled.div`
  background: #1f2937;
  color: white;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-top: 1.5rem;

  pre {
    white-space: pre-wrap;
    overflow-x: auto;
  }
`;

const ErrorAlert = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #dc2626;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const SelectedFieldsContainer = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const SelectedFieldTag = styled.div`
  background: #f3f4f6;
  padding: 0.5rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
`;

const MultiSelect = styled.select`
  ${sharedInputStyles}
  width: 96%;
  height: auto;
  font-family: inherit;

  min-height: 80px;
  multiple: true;
`;

const SelectLabel = styled.label`
  font-weight: 500;
  margin-bottom: 0.5rem;
  display: block;
`;

const ModelCodeDisplay = styled.div<{ show: boolean }>`
  margin-top: 1.5rem;
  opacity: ${props => props.show ? 1 : 0};
  transition: opacity 0.3s ease-in-out;
`;

interface DynamicModelCreatorProps {
  objectNameSingular: string;
  index: number;
  onError: (error: string) => void;
}


// const validateFieldName = (name: string) => {
//   if (!name) {
//     return 'Field name is required';
//   }
  
//   // Add camelCase validation
//   if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
//     return 'Field name must be in camelCase (start with lowercase letter, followed by letters/numbers)';
//   }
  
//   const isDuplicate = fields.some(
//     (field: { name: string; id: number }) => 
//       field.name.toLowerCase() === name.toLowerCase() && 
//       field.id !== editingFieldId
//   );
  
//   if (isDuplicate) {
//     return 'Field name must be unique';
//   }
  
//   return '';
// };


// Component Implementation
const DynamicModelCreator: React.FC<DynamicModelCreatorProps> = ({ 
  objectNameSingular, 
  index, 
  onError, // Add this prop

}) => {
  const [showAddField, setShowAddField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [error, setError] = useState<string>('');

  // Initialize local state with deep copy of current enrichment
  const currentEnrichment = useMemo(() => ({
    ...enrichments[index],
    fields: [...(enrichments[index]?.fields || [])],
    selectedMetadataFields: [...(enrichments[index]?.selectedMetadataFields || [])]
  }), [enrichments, index]);

  const [fields, setFields] = useState(currentEnrichment.fields);
  const [newField, setNewField] = useState({
    name: '',
    type: 'text',
    description: '',
    enumValues: [] as string[], // Add this line

  });

  const handleFieldNameValidation = (name: string) => {
    const validationError = validateFieldName(name);
    if (validationError) {
      onError(validationError);
      return false;
    }
    onError('');
    return true;
  };


  const handleFieldNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    handleFieldNameValidation(newName);
    setNewField({ ...newField, name: newName });
  };




  // Reset local state when switching enrichments
  useEffect(() => {
    const currentEnrichment = enrichments[index];
    if (currentEnrichment) {
      setFields([...currentEnrichment.fields]);
      
      // Reset form state
      setNewField({
        name: '',
        type: 'text',
        description: '',
        enumValues:[]
      });


      if (typeof currentEnrichment.bestOf === 'undefined') {
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
  }, [index, enrichments]);

  // Update enrichment state only when local state changes
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: objectNameSingular,
  });


  const handleModelNameChange = (value: string) => {
    const validationError = validateModelName(value);
    if (validationError) {
      setError(validationError);
    } else {
      setError('');
      // Update model name directly in enrichments
      setEnrichments(prev => {
        const newEnrichments = [...prev];
        if (newEnrichments[index]) {
          newEnrichments[index] = {
            ...newEnrichments[index],
            modelName: value
          };
        }
        return newEnrichments;
      });
    }
  };
  

  
  const currentFieldNames = objectMetadataItem?.fields.map(field => field.name);


  const fieldTypes = useMemo(() => [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'enum', label: 'Enum' },
  ], []);
  
  
  const validateFieldName = (name: string) => {
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
  
  
  
  const validateModelName = (name: string) => {
    if (!name) return 'Model name is required';
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
      return 'Model name must start with a capital letter and contain only letters and numbers';
    }
    return '';
  };

  const addField = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
  
    // Validate field name
    const nameValidationError = validateFieldName(newField.name);
    if (nameValidationError) {
      setError(nameValidationError);
      return;
    }
  
    setEnrichments(prev => {
      const newEnrichments = prev.map((enrichment, idx) => {
        if (idx === index) {
          const currentFields = enrichment.fields || [];
          const updatedFields = editingFieldId 
            ? currentFields.map((field: { id: number; }) => 
                field.id === editingFieldId ? { ...newField, id: editingFieldId } : field)
            : [...currentFields, { ...newField, id: Date.now() }];
          return {
            ...enrichment,
            fields: updatedFields
          };
        }
        return enrichment;
      });
      return newEnrichments;
    });
  
    if (!editingFieldId) {
      setNewField({
        name: '',
        type: 'text',
        description: '',
        enumValues: []
      });
      setShowAddField(false);
    }
    setEditingFieldId(null);
    setError(''); // Clear any existing errors
  }, [newField, editingFieldId, index, setEnrichments, validateFieldName]);
  
  


  console.log("Enrichmetnsa re these:", enrichments);
    // const handleMetadataFieldsChange = (selectedOptions: string[]) => {
    //   setEnrichments(prev => {
    //     const newEnrichments = prev.map((enrichment, idx) => 
    //       idx === index ? {
    //         ...enrichment,
    //         selectedMetadataFields: selectedOptions
    //       } : enrichment
    //     );
    //     return newEnrichments;
    //   });
    // };
  
  
  
    const removeField = useCallback((fieldId: number) => {
      setEnrichments(prev => {
        const newEnrichments = prev.map((enrichment, idx) => {
          if (idx === index) {
            return {
              ...enrichment,
              fields: enrichment.fields.filter((field: { id: number; }) => field.id !== fieldId)
            };
          }
          return enrichment;
        });
        return newEnrichments;
      });
    }, [index, setEnrichments]);
  

  
  const generateModelCode = useCallback(() => {
  
    let code = `from pydantic import BaseModel, Field\n\n`;
    code += `class ${enrichments[index]?.modelName}(BaseModel):\n`;
    
    // Add custom fields
    fields.forEach((field: { name: any; type: string | number; required: any; description: any; }) => {
      const typeMap: { [key: string]: string } = {
        text: 'str',
        number: 'int',
        boolean: 'bool',
        float: 'float',
        enum: 'str',
      };
  
      code += `    ${field.name}: ${typeMap[field.type]} = Field(`;
      code += field.required ? '...' : 'None';
      code += `, description="${field.description}")\n`;
    });
    
    return code;
  }, [enrichments, index, fields]);  // Update dependencies

  
  
  return (
    <Container>

      {error && (
        <ErrorAlert>
          <IconAlertCircle size={16} stroke={1.5} />
          {error}
        </ErrorAlert>
      )}

      <SelectLabel>Model Name</SelectLabel>
      <Input
        type="text"
        placeholder="Model Name"
        value={enrichments[index]?.modelName || ''}
        onChange={e => 
          handleModelNameChange(e.target.value)
        }
        />

      <SelectLabel>Prompt</SelectLabel>
      <TextArea
        placeholder="Enter your prompt here..."
        value={enrichments[index]?.prompt || ''}
        onChange={e => {
          setEnrichments(prev => {
            const newEnrichments = [...prev];
            if (newEnrichments[index]) {
              newEnrichments[index] = {
                ...newEnrichments[index],
                prompt: e.target.value
              };
            }
            return newEnrichments;
          });
        }}
        rows={4}
      />


      <SelectLabel>Select Model</SelectLabel>
      <Select
          value={enrichments[index]?.selectedModel || 'gpt4omini'}
          onChange={e => {
        const selectedModel = e.target.value;
        console.log("selectedModel::", selectedModel);
        setEnrichments(prev => {
          const newEnrichments = [...prev];
          if (newEnrichments[index]) {
            newEnrichments[index] = {
          ...newEnrichments[index],
          selectedModel: selectedModel
            };
          }
          return newEnrichments;
        });
          }}
        >
        <option>Select a model...</option>
        {AVAILABLE_MODELS.map(model => (
          <option key={model.value} value={model.value}>
        {model.label}
          </option>
        ))}
      </Select>



      <SelectLabel>Select Metadata Fields</SelectLabel>
      <MultiSelect
        multiple
        value={enrichments[index]?.selectedMetadataFields || []}
        onChange={e => {
          const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
          setEnrichments(prev => {
        const newEnrichments = [...prev];
        if (newEnrichments[index]) {
          newEnrichments[index] = {
            ...newEnrichments[index],
            selectedMetadataFields: selectedOptions
          };
        }
        return newEnrichments;
          });
        }}>
        {objectMetadataItem?.fields.map(field => (
          <option key={field.name} value={field.name}>
        {field.label}
          </option>
        ))}
      </MultiSelect>


      {enrichments[index]?.selectedMetadataFields?.length > 0 && (
        <SelectedFieldsContainer>
          {enrichments[index].selectedMetadataFields.map((fieldName: string) => (
            <SelectedFieldTag key={fieldName}>
              {fieldName}
              <IconX
                size={14}
                stroke={1.5}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setEnrichments(prev => {
                    const newEnrichments = [...prev];
                    if (newEnrichments[index]) {
                      newEnrichments[index] = {
                        ...newEnrichments[index],
                        selectedMetadataFields: newEnrichments[index].selectedMetadataFields.filter(
                          (                          name: string) => name !== fieldName
                        )
                      };
                    }
                    return newEnrichments;
                  });
                }}
              />
            </SelectedFieldTag>
          ))}
        </SelectedFieldsContainer>
      )}


  <SelectLabel>Create New Fields</SelectLabel>

    <FieldsList>
    {currentEnrichment.fields.map((field: { id: number; name: string; type: string; description: string; enumValues:string[] }) => (
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
          setEditingFieldId(field.id);
          setNewField(field);
        }}
        variant="secondary"
        title="Edit"
        />
        <Button Icon={IconX} onClick={() => removeField(field.id)} variant="secondary" title="Remove" />
      </FieldCard>
      
      {/* Add edit form directly below the field being edited */}
      {editingFieldId === field.id && (
        <AddFieldForm onSubmit={(e: React.FormEvent) => e.preventDefault()}>
        <Input
          type="text"
          placeholder="Field Name"
          value={newField.name}
          onChange={e => {
            const newName = e.target.value;
            const validationError = validateFieldName(newName);
            if (validationError) {
              setError(validationError);
            } else {
              setError('');
            }
        
          e.stopPropagation();
          setNewField({ ...newField, name: e.target.value });
          setError('');
          }}
        />
        <Select 
          value={newField.type} 
          onChange={e => setNewField({ ...newField, type: e.target.value })}
        >
          {fieldTypes.map(type => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
          ))}
        </Select>
        {newField.type === 'enum' && (
          <EnumValuesInput>
            <SelectLabel>Enum Values</SelectLabel>
            {(newField.enumValues || []).map((value, index) => (
              <EnumValueRow key={index}>
                <Input
                  type="text"
                  value={value}
                  onChange={e => {
                    const newEnumValues = [...newField.enumValues];
                    newEnumValues[index] = e.target.value;
                    setNewField({ ...newField, enumValues: newEnumValues });
                  }}
                />
                <Button
                  Icon={IconX}
                  variant="secondary"
                  onClick={() => {
                    const newEnumValues = newField.enumValues.filter((_, i) => i !== index);
                    setNewField({ ...newField, enumValues: newEnumValues });
                  }}
                  title="Remove enum value"
                />
              </EnumValueRow>
            ))}
            <Button
              Icon={IconPlus}
              variant="secondary"
              onClick={() => {
                setNewField({
                  ...newField,
                  enumValues: [...(newField.enumValues || []), '']
                });
              }}
              title="Add enum value"
            />
          </EnumValuesInput>
        )}


        <TextArea 
          placeholder="Field Description" 
          value={newField.description} 
          onChange={e => setNewField({ ...newField, description: e.target.value })} 
          rows={3} 
        />

        <ButtonGroup>
          <Button Icon={IconPlus}   onClick={(e: React.MouseEvent) => { e.preventDefault(); addField(e);}}  variant="primary" title="Save" />
          <Button
          variant="secondary"
          accent="danger"
          onClick={() => {
            setEditingFieldId(null);
            setError('');
            setNewField({
            name: '',
            type: 'text',
            description: '',
            enumValues:[]
            });
          }}
          title="Cancel"
          />
        </ButtonGroup>
        </AddFieldForm>
      )}
      </FieldContainer>
    ))}


{!showAddField ? (
  <Button 
    Icon={IconPlus} 
    onClick={() => setShowAddField(true)} 
    variant="primary" 
    title="Add New Field" 
  />
) : (
  <AddFieldForm>
    <Input
      type="text"
      placeholder="Field Name"
      value={newField.name}
      
      onChange={e => {
        const newName = e.target.value;
        const validationError = validateFieldName(newName);
        if (validationError) {
          setError(validationError);
        } else {
          setError('');
        }
    
        setNewField({ ...newField, name: e.target.value });
        setError('');
      }}
    />
    <Select 
      value={newField.type} 
      onChange={e => setNewField({ ...newField, type: e.target.value })}
    >
      {fieldTypes.map(type => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </Select>

    {newField.type === 'enum' && (
      <EnumValuesInput>
        <SelectLabel>Enum Values</SelectLabel>
        {(newField.enumValues || []).map((value, index) => (
          <EnumValueRow key={index}>
            <Input
              type="text"
              value={value}
              onChange={e => {
                const newName = e.target.value;
                const validationError = validateFieldName(newName);
                if (validationError) {
                  setError(validationError);
                } else {
                  setError('');
                }
            
                const newEnumValues = [...newField.enumValues];
                newEnumValues[index] = e.target.value;
                setNewField({ ...newField, enumValues: newEnumValues });
              }}
            />
            <Button
              Icon={IconX}
              variant="secondary"
              onClick={() => {
                const newEnumValues = newField.enumValues.filter((_, i) => i !== index);
                setNewField({ ...newField, enumValues: newEnumValues });
              }}
              title="Remove enum value"
            />
          </EnumValueRow>
        ))}
        <Button
          Icon={IconPlus}
          variant="secondary"
          onClick={() => {
            setNewField({
              ...newField,
              enumValues: [...(newField.enumValues || []), '']
            });
          }}
          title="Add enum value"
        />
      </EnumValuesInput>
    )}


    <TextArea 
      placeholder="Field Description" 
      value={newField.description} 
      onChange={e => setNewField({ ...newField, description: e.target.value })} 
      rows={3} 
    />
    <ButtonGroup>
      <Button Icon={IconPlus} onClick={addField} variant="primary" title="Add" />
      <Button
        variant="secondary"
        accent="danger"
        onClick={() => {
          setShowAddField(false);
          setError('');
          setNewField({
            name: '',
            type: 'text',
            description: '',
            enumValues:[]
          });
        }}
        title="Cancel"
      />
    </ButtonGroup>
  </AddFieldForm>
  )}

  </FieldsList>


  <SelectLabel>Best Of</SelectLabel>
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '90%'
}}>
  <Input
    type="number"
    min="1"
    value={enrichments[index]?.bestOf || 1}
    onChange={e => {
  
      const value = parseInt(e.target.value) || 1;
      setEnrichments(prev => {
        const newEnrichments = [...prev];
        if (newEnrichments[index]) {
          newEnrichments[index] = {
            ...newEnrichments[index],
            bestOf: value
          };
        }
        return newEnrichments;
      });
    }}
    style={{ width: '80px' }}
  />
</div>



    {(fields.length > 0) && (
      <ModelCodeDisplay show={true}>
      <SelectLabel>Generated Model Code</SelectLabel>
        <CodeBlock>
          <pre>{generateModelCode()}</pre>
        </CodeBlock>
      </ModelCodeDisplay>
    )}
    </Container>
  );
};
export default DynamicModelCreator;