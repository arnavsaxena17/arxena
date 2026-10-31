import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

export const wrapWithErrorHandler = (
  toolName: string,
  executeFn: (
    args: Record<string, unknown>,
    callOptions?: { toolCallId?: string },
  ) => Promise<ToolOutput>,
): ((
  args: Record<string, unknown>,
  callOptions?: { toolCallId?: string },
) => Promise<ToolOutput>) => {
  return async (
    args: Record<string, unknown>,
    callOptions?: { toolCallId?: string },
  ) => {
    try {
      return await executeFn(args, callOptions);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        success: false,
        message: `Failed to execute ${toolName}`,
        error: errorMessage,
      };
    }
  };
};
