import camelCase from 'lodash.camelcase';
import React from 'react';
import { CodeBlock, SelectLabel } from './StyledComponents';

type SampleOpenAICallProps = {
  prompt: string;
  selectedMetadataFields: string[];
  fields: any[];
  firstRow: any;
};

export const SampleOpenAICall: React.FC<SampleOpenAICallProps> = ({
  prompt,
  selectedMetadataFields,
  fields,
  firstRow
}) => {
  const metadataValues = selectedMetadataFields.map(fieldName => {
    const value = firstRow?.[camelCase(fieldName)];
    return `${fieldName}: ${value !== null && value !== undefined ? JSON.stringify(value) : 'null'}`;
  }).join('\n');

  const expectedOutputFormat = fields?.map(field => 
    `${field.name}: ${field.type === 'text' ? 'string' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : field.type === 'enum' ? `enum(${field.enumValues?.join(', ') || ''})` : 'string'}`
  ).join('\n') || 'No fields defined';

  return (
    <>
      <SelectLabel>Sample Open AI Call</SelectLabel>
      <CodeBlock>
        <pre>{`Prompt: ${prompt}
${metadataValues}


Expected Output Format:
${expectedOutputFormat}`}</pre>
      </CodeBlock>
    </>
  );
};
