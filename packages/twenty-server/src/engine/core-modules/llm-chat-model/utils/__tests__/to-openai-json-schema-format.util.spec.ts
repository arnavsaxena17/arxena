import { z } from 'zod';

import { toOpenAiJsonSchemaResponseFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';

describe('toOpenAiJsonSchemaResponseFormat', () => {
  it('puts every object property in required for OpenAI strict mode', () => {
    const schema = z.object({
      original_requirement: z.string(),
      position_title: z.string().nullable().optional(),
      years_min: z.number().nullable().optional(),
    });

    const responseFormat = toOpenAiJsonSchemaResponseFormat(
      schema,
      'agent1Parser',
    );
    const jsonSchema = responseFormat.json_schema.schema as {
      required?: string[];
      properties?: Record<string, unknown>;
      additionalProperties?: boolean;
    };

    expect(jsonSchema.additionalProperties).toBe(false);
    expect(jsonSchema.required?.sort()).toEqual(
      ['original_requirement', 'position_title', 'years_min'].sort(),
    );
    expect(Object.keys(jsonSchema.properties ?? {}).sort()).toEqual(
      jsonSchema.required?.sort(),
    );
  });
});
