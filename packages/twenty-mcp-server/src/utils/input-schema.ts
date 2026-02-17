import type { McpInputFieldDescriptor } from 'twenty-shared';

/**
 * Builds MCP inputSchema from a shared descriptor array.
 * Single source of truth: descriptors in twenty-shared define both types and schema.
 */
export function descriptorToInputSchema(
  descriptor: readonly McpInputFieldDescriptor[],
): {
  type: 'object';
  properties: Record<string, { type: string; description: string }>;
  required?: string[];
} {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];

  for (const field of descriptor) {
    properties[field.key] = {
      type: field.type,
      description: field.description,
    };
    if (field.required) {
      required.push(field.key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
