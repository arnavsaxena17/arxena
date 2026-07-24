import { EnrichmentField } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';

export const generateModelCode = (modelName: string, fields: EnrichmentField[]): string => {
  let code = `from pydantic import BaseModel, Field\n\n`;
  code += `class ${modelName}(BaseModel):\n`;
  
  // Add custom fields
  fields.forEach((field: EnrichmentField) => {
    const typeMap: { [key: string]: string } = {
      text: 'str',
      number: 'int',
      boolean: 'bool',
      float: 'float',
      enum: 'str',
    };

    code += `    ${field.name}: ${typeMap[field.type]} = Field(`;
    code += field.description ? `, description="${field.description}")` : ')';
    code += '\n';
  });
  
  return code;
};
