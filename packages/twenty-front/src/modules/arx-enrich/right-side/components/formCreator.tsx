import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
// import { css } from '@emotion/react';
import { IconPlus, IconX, IconAlertCircle } from 'twenty-ui';
import { Button } from '@/ui/input/button/components/Button';

// Styled Components
const Container = styled.div`
//   max-width: 56rem;
width:100%
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

// const Input = styled.input`
//   width: 100%;
//   padding: 0.5rem 1rem;
//   font-size: 1.125rem;
//   font-weight: 500;
//   background: white;
//   border: 1px solid #e5e7eb;
//   border-radius: 0.5rem;
//   outline: none;
//   transition: all 0.2s;

//   &:focus {
//     border-color: #3b82f6;
//     box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
//   }
// `;


const sharedInputStyles = `
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 1.125rem;
  font-weight: 500;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  outline: none;
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


// const Select = styled.select`
//   ${Input};
// `;

// const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
//   padding: 0.5rem 1rem;
//   border-radius: 0.5rem;
//   transition: all 0.2s;
//   display: flex;
//   align-items: center;
//   gap: 0.5rem;
  
//   ${props => props.variant === 'primary' && `
//     background: #3b82f6;
//     color: white;
//     &:hover {
//       background: #2563eb;
//     }
//   `}
  
//   ${props => props.variant === 'secondary' && `
//     color: #4b5563;
//     &:hover {
//       background: #f3f4f6;
//     }
//   `}
// `;

const FieldsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FieldCard = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e5e7eb;
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

// Component Implementation
const DynamicModelCreator: React.FC = () => {
  const [fields, setFields] = useState<any[]>([]);
  const [modelName, setModelName] = useState('');
  const [showAddField, setShowAddField] = useState(false);
  const [error, setError] = useState('');
  const [newField, setNewField] = useState({
    name: '',
    type: 'text',
    description: '',
    required: true
  });

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'float', label: 'Float' },
    { value: 'enum', label: 'Enum' }
  ];

  const validateFieldName = (name: string) => {
    if (!name) return 'Field name is required';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return 'Field name must start with a letter or underscore and contain only letters, numbers, and underscores';
    }
    if (fields.some(field => field.name === name)) {
      return 'Field name must be unique';
    }
    return '';
  };

  const addField = useCallback(() => {
    const validationError = validateFieldName(newField.name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setFields(prevFields => [...prevFields, { ...newField, id: Date.now() }]);
    setNewField({
      name: '',
      type: 'text',
      description: '',
      required: true
    });
    setShowAddField(false);
  }, [newField, fields]);

  const removeField = useCallback((id: number) => {
    setFields(prevFields => prevFields.filter(field => field.id !== id));
  }, []);

  const generateModelCode = useCallback(() => {
    if (!modelName) return '';
    
    let code = `class ${modelName}(BaseModel):\n`;
    fields.forEach(field => {
      const typeMap: { [key: string]: string } = {
        'text': 'str',
        'number': 'int',
        'boolean': 'bool',
        'float': 'float',
        'enum': 'str'
      };
      
      code += `    ${field.name}: ${typeMap[field.type]} = Field(`;
      code += field.required ? '...' : 'None';
      code += `, description="${field.description}")\n`;
    });
    return code;
  }, [modelName, fields]);

  return (
    <Container>
      <Input
        type="text"
        placeholder="Model Name"
        value={modelName}
        onChange={(e) => {
          const value = e.target.value;
          if (/^[A-Z][A-Za-z0-9]*$/.test(value) || value === '') {
            setModelName(value);
            setError('');
          } else {
            setError('Model name must start with a capital letter and contain no spaces');
          }
        }}
      />

      {error && (
        <ErrorAlert>
          <IconAlertCircle size={16} stroke={1.5} />
          {error}
        </ErrorAlert>
      )}

      <FieldsList>
        {fields.map(field => (
          <FieldCard key={field.id}>
            <FieldContent>
              <FieldHeader>
                <FieldName>{field.name}</FieldName>
                <FieldType>({field.type})</FieldType>
                {field.required && <RequiredBadge>required</RequiredBadge>}
              </FieldHeader>
              <FieldDescription>{field.description}</FieldDescription>
            </FieldContent>

            <Button Icon={IconX} onClick={() => removeField(field.id)} variant="secondary" title="Remove" />
          </FieldCard>
        ))}
      </FieldsList>

      {!showAddField ? (
        // <Button variant="secondary" onClick={() => setShowAddField(true)}>
        //   <IconPlus size={20} stroke={1.5} />
        //   Add Field
        // </Button>
        <Button Icon={IconPlus} onClick={() => setShowAddField(true)} variant="secondary" title="Add Field" />

        
      ) : (
        <AddFieldForm>
          <Input
            type="text"
            placeholder="Field Name"
            value={newField.name}
            onChange={(e) => {
              setNewField({ ...newField, name: e.target.value });
              setError('');
            }}
          />
          <Select
            value={newField.type}
            onChange={(e) => setNewField({ ...newField, type: e.target.value })}
          >
            {fieldTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <TextArea
            placeholder="Field Description"
            value={newField.description}
            onChange={(e) => setNewField({ ...newField, description: e.target.value })}
            rows={3}
          />
          <CheckboxContainer>
            <input
              type="checkbox"
              checked={newField.required}
              onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              id="required-checkbox"
            />
            <label htmlFor="required-checkbox">Required</label>
          </CheckboxContainer>
          <ButtonGroup>
            <Button Icon={IconPlus} onClick={addField} variant="primary" title="Add Field" />
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
                  required: true
                });
              }}
            
              title="Cancel"
            />
          </ButtonGroup>
        </AddFieldForm>
      )}

      {fields.length > 0 && modelName && (
        <CodeBlock>
          <pre>{generateModelCode()}</pre>
        </CodeBlock>
      )}
    </Container>
  );
};

export default DynamicModelCreator;