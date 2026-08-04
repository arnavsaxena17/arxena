import { z } from 'zod';

// openai/helpers/zod (zodResponseFormat / zodTextFormat) still uses Zod 3
// converters and collapses Zod 4 object schemas to { type: 'string' }.

const toOpenAiJsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'draft-7',
  }) as Record<string, unknown>;

  delete jsonSchema['$schema'];

  return jsonSchema;
};

// Chat Completions `response_format` shape (replaces zodResponseFormat)
export const toOpenAiJsonSchemaResponseFormat = (
  schema: z.ZodType,
  name: string,
) => ({
  type: 'json_schema' as const,
  json_schema: {
    name,
    strict: true,
    schema: toOpenAiJsonSchema(schema),
  },
});

// Responses API `text.format` shape (replaces zodTextFormat)
export const toOpenAiResponsesJsonSchemaFormat = (
  schema: z.ZodType,
  name: string,
) => ({
  type: 'json_schema' as const,
  name,
  strict: true,
  schema: toOpenAiJsonSchema(schema),
});
