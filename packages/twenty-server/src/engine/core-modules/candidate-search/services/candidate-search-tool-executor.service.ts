import { Injectable, Logger } from '@nestjs/common';
import { CandidateSearchToolRegistryService, ToolContext, ToolResult } from './candidate-search-tool-registry.service';

@Injectable()
export class CandidateSearchToolExecutorService {
  private readonly logger = new Logger(CandidateSearchToolExecutorService.name);

  constructor(
    private readonly toolRegistry: CandidateSearchToolRegistryService,
  ) {}

  /**
   * Execute a tool by name with arguments and context
   */
  async executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ToolContext,
  ): Promise<string> {
    try {
      this.logger.log(`Executing tool: ${toolName} with args: ${JSON.stringify(args, null, 2)}`);

      // Send tool execution event
      context.sendEvent?.('tool_call', {
        tool: toolName,
        args,
        status: 'executing',
        message: `Executing ${toolName}...`,
      });

      const result = await this.toolRegistry.executeTool(toolName, args, context);

      if (!result.success) {
        this.logger.error(`Tool ${toolName} failed: ${result.error}`);
        context.sendEvent?.('tool_call', {
          tool: toolName,
          args,
          status: 'error',
          error: result.error,
          message: `Tool ${toolName} failed: ${result.error}`,
        });

        // Return error as JSON string for LLM
        return JSON.stringify({
          success: false,
          error: result.error,
        });
      }

      // Send tool completion event
      context.sendEvent?.('tool_call', {
        tool: toolName,
        args,
        status: 'completed',
        message: `Completed ${toolName}`,
      });

      // Format result as JSON string for LLM consumption
      // The result should be formatted in a way that's easy for the LLM to understand
      return JSON.stringify({
        success: true,
        data: result.data,
      });
    } catch (error) {
      this.logger.error(`Error executing tool ${toolName}: ${error}`);
      context.sendEvent?.('tool_call', {
        tool: toolName,
        args,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        message: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
      });

      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeTools(
    toolCalls: Array<{ id: string; name: string; args: any }>,
    context: ToolContext,
  ): Promise<Array<{ id: string; name: string; result: string }>> {
    const results: Array<{ id: string; name: string; result: string }> = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeTool(toolCall.name, toolCall.args, context);
      results.push({
        id: toolCall.id,
        name: toolCall.name,
        result,
      });
    }

    return results;
  }

  /**
   * Format tool result for LLM consumption
   * This ensures results are in a consistent, LLM-friendly format
   */
  formatToolResult(result: ToolResult): string {
    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Unknown error',
      });
    }

    // Format data in a way that's easy for LLM to parse and reason about
    // For complex objects, we might want to add natural language descriptions
    return JSON.stringify({
      success: true,
      data: result.data,
    });
  }
}

