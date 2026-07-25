import { styled } from '@linaria/react';
import React from 'react';
import { getCandidateCustomField } from 'twenty-shared/utils';
import { CodeBlock, SelectLabel } from './StyledComponents';

type SampleOpenAICallProps = {
  prompt: string;
  selectedMetadataFields: string[];
  fields: any[];
  candidateData: any;
  includeResume?: boolean;
};

export const SampleOpenAICallSelectLabel = styled.label`
  font-weight: 500;
  align-self: flex-start;
  display: block;
`;

export const SampleOpenAICall: React.FC<SampleOpenAICallProps> = ({
  prompt,
  selectedMetadataFields,
  fields,
  candidateData,
  includeResume = false,
}) => {
  console.log('candidateData in SampleOpenAICall', candidateData);
  console.log(
    'selectedMetadataFields in SampleOpenAICall',
    selectedMetadataFields,
  );
  console.log('fields in SampleOpenAICall', fields);
  console.log('prompt in SampleOpenAICall', prompt);

  const getFieldValue = (fieldName: string) => {
    const value = getCandidateCustomField(candidateData, fieldName);

    if (value === null || value === undefined) {
      return null;
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  };

  const metadataValues = selectedMetadataFields
    .map((fieldName) => {
      const value = getFieldValue(fieldName);
      return `${fieldName}: ${value !== null && value !== undefined ? JSON.stringify(value) : 'null'}`;
    })
    .join('\n');

  const resumeContextLine = includeResume
    ? '\nresume: [CV attachment text will be loaded when Create AI Filter runs]'
    : '';

  const expectedOutputFormat =
    fields
      ?.map(
        (field) =>
          `${field.name}: ${field.type === 'text' ? 'string' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : field.type === 'enum' ? `enum(${field.enumValues?.join(', ') || ''})` : 'string'}`,
      )
      .join('\n') || 'No fields defined';

  return (
    <>
      <SelectLabel>Sample Open AI Call</SelectLabel>
      <CodeBlock>
        <SampleOpenAICallSelectLabel>Prompt:</SampleOpenAICallSelectLabel>
        <pre>{`${prompt}\n\nData:\n${metadataValues}${resumeContextLine}`}</pre>
      </CodeBlock>
      <CodeBlock>
        <SampleOpenAICallSelectLabel>
          Expected Output Columns:
        </SampleOpenAICallSelectLabel>
        <pre>{` ${expectedOutputFormat}`}</pre>
      </CodeBlock>
    </>
  );
};
