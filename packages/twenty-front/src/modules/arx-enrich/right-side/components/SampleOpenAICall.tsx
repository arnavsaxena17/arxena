import styled from '@emotion/styled';
import React from 'react';
import { CodeBlock, SelectLabel } from './StyledComponents';

type SampleOpenAICallProps = {
  prompt: string;
  selectedMetadataFields: string[];
  fields: any[];
  candidateData: any;
};



export const SampleOpenAICallSelectLabel = styled.label`
  font-weight: 500;
  // margin-bottom: 0.5rem;
  align-self: flex-start;
  display: block;
`;


export const SampleOpenAICall: React.FC<SampleOpenAICallProps> = ({
  prompt,
  selectedMetadataFields,
  fields,
  candidateData
}) => {
  console.log("candidateData in SampleOpenAICall", candidateData);
  console.log("selectedMetadataFields in SampleOpenAICall", selectedMetadataFields);
  console.log("fields in SampleOpenAICall", fields);
  console.log("prompt in SampleOpenAICall", prompt);
  
  // Helper function to get field value from candidateFieldValues
  const getFieldValue = (fieldName: string) => {
    if (!candidateData?.candidateFieldValues?.edges) return null;
    
    const field = candidateData?.candidateFieldValues?.edges?.find(
      (edge: any) => edge?.node?.candidateFields?.name === fieldName
    );
    return field?.node?.name || null;
  };

  const metadataValues = selectedMetadataFields.map(fieldName => {
    const value = getFieldValue(fieldName);
    return `${fieldName}: ${value !== null && value !== undefined ? JSON.stringify(value) : 'null'}`;
  }).join('\n');

  const expectedOutputFormat = fields?.map(field => 
    `${field.name}: ${field.type === 'text' ? 'string' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : field.type === 'enum' ? `enum(${field.enumValues?.join(', ') || ''})` : 'string'}`
  ).join('\n') || 'No fields defined';

  return (
    <>
      <SelectLabel>Sample Open AI Call</SelectLabel>
      <CodeBlock>
      <SampleOpenAICallSelectLabel>Prompt:</SampleOpenAICallSelectLabel>

      <pre>{`${prompt}\n\nData:\n${metadataValues}`}</pre>
      </CodeBlock>
      <CodeBlock>
      <SampleOpenAICallSelectLabel>Expected Output Columns:</SampleOpenAICallSelectLabel>
      <pre>{` ${expectedOutputFormat}`}</pre>
      </CodeBlock>



    </>
  );
};
