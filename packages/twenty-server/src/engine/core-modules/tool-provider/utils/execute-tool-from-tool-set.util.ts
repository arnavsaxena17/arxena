import { type ToolSet } from 'ai';
import { type ToolCategory } from 'twenty-shared/ai';
import { z } from 'zod';

import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

const isZodSchema = (schema: unknown): schema is z.ZodType =>
  schema !== null &&
  typeof schema === 'object' &&
  'safeParseAsync' in schema &&
  typeof (schema as { safeParseAsync?: unknown }).safeParseAsync === 'function';

const formatZodError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'input';

      return `${path}: ${issue.message}`;
    })
    .join('; ');

// Invokes a tool from a factory-generated ToolSet by name. Used by providers
// whose tools are produced as opaque AI-SDK ToolSet closures (view, metadata,
// workflow, dashboard, view-field) and which therefore cannot dispatch by
// executionRef alone.
export const executeToolFromToolSet = async (
  toolSet: ToolSet,
  toolName: string,
  args: Record<string, unknown>,
  category: ToolCategory,
): Promise<ToolOutput> => {
  const tool = toolSet[toolName];

  if (!tool?.execute) {
    throw new Error(
      `Tool "${toolName}" not found in ToolSet for category "${category}"`,
    );
  }

  let parsedArgs: unknown = args;

  if (isZodSchema(tool.inputSchema)) {
    const parsed = await tool.inputSchema.safeParseAsync(args);

    if (!parsed.success) {
      return {
        success: false,
        message: `Invalid arguments for "${toolName}"`,
        error: formatZodError(parsed.error),
      };
    }

    parsedArgs = parsed.data;
  }

  return tool.execute(parsedArgs as Record<string, unknown>, {
    toolCallId: '',
    messages: [],
  }) as Promise<ToolOutput>;
};
