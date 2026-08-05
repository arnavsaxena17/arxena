import { z } from 'zod';

// openai/helpers/zod (zodResponseFormat / zodTextFormat) still uses Zod 3
// converters and collapses Zod 4 object schemas to { type: 'string' }.

// OpenAI strict json_schema requires every properties key in required, and
// additionalProperties: false on every object.
const enforceOpenAiStrictObjectRules = (
  schema: Record<string, unknown>,
): void => {
  if (schema.type === 'object' && isRecord(schema.properties)) {
    schema.additionalProperties = false;
    schema.required = Object.keys(schema.properties);
  }

  for (const value of Object.values(schema)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item)) {
          enforceOpenAiStrictObjectRules(item);
        }
      }
    } else if (isRecord(value)) {
      enforceOpenAiStrictObjectRules(value);
    }
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toOpenAiJsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'draft-7',
  }) as Record<string, unknown>;

  delete jsonSchema['$schema'];
  enforceOpenAiStrictObjectRules(jsonSchema);

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
