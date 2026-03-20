import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Injectable, Logger } from '@nestjs/common';
import { MessageParam, StreamEventSender } from './assistant.types';
import { McpAssistantToolExecutorService } from './mcp-assistant-tool-executor.service';
import { CLAUDE_MODEL, MAX_TOKENS } from './mcp-assistant.constants';
import { McpLinkedinQueryRegenerationService } from './mcp-linkedin-query-regeneration.service';
import { throwIfAborted } from './utils/mcp-assistant-abort.util';
import {
    extractLinkedInSearchErrorMessage,
    isLinkedInSearchError,
} from './utils/mcp-assistant-linkedin-error.util';
import { emitTableDataIfJson } from './utils/mcp-assistant-stream-events.util';

@Injectable()
export class McpAnthropicMessageProcessorService {
  private readonly logger = new Logger(McpAnthropicMessageProcessorService.name);

  constructor(
    private readonly toolExecutor: McpAssistantToolExecutorService,
    private readonly linkedinQueryRegeneration: McpLinkedinQueryRegenerationService,
  ) {}

  async streamAnthropicRound(
    anthropic: Anthropic,
    messages: MessageParam[],
    availableTools: Anthropic.Messages.Tool[],
    systemPrompt: string | undefined,
    sendEvent: StreamEventSender,
    abortSignal?: AbortSignal,
  ): Promise<
    Array<
      | { type: 'text'; text: string }
      | {
          type: 'tool_use';
          id: string;
          name: string;
          input: Record<string, unknown>;
        }
    >
  > {
    const stream = anthropic.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages as Anthropic.MessageParam[],
        tools: availableTools,
      },
      abortSignal ? { signal: abortSignal } : undefined,
    );
    stream.on('text', (delta: string) => {
      sendEvent('text', { delta });
    });
    stream.on('error', (err: Error) => {
      sendEvent('error', { error: err.message });
    });
    const finalMessage = await stream.finalMessage();
    throwIfAborted(abortSignal);
    return finalMessage.content as Array<
      | { type: 'text'; text: string }
      | {
          type: 'tool_use';
          id: string;
          name: string;
          input: Record<string, unknown>;
        }
    >;
  }

  async processAnthropicAssistantContent(
    assistantContent: Array<
      | { type: 'text'; text: string }
      | {
          type: 'tool_use';
          id: string;
          name: string;
          input: Record<string, unknown>;
        }
    >,
    client: Client,
    apiToken: string,
    sendEvent: StreamEventSender,
    allToolCalls: Array<{ name: string; args: Record<string, unknown> }>,
    assistantThreadId?: string,
    searchType?: 'classic' | 'sales_navigator' | 'recruiter',
    abortSignal?: AbortSignal,
  ): Promise<{
    toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    }>;
    textParts: string[];
    linkedInSearchError?: string;
    regenerationMessage?: string;
  }> {
    const textParts: string[] = [];
    const toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
    }> = [];
    for (const block of assistantContent) {
      throwIfAborted(abortSignal);
      if (block.type === 'text') {
        textParts.push(block.text);
      }
      if (block.type === 'tool_use') {
        const toolArgs = block.input ?? {};
        if (!sendEvent('tool_use', { name: block.name })) break;
        const { textContent, fromCache } =
          await this.toolExecutor.executeToolAndGetResult(
            client,
            block.name,
            toolArgs,
            apiToken,
            sendEvent,
            assistantThreadId,
            searchType,
            abortSignal,
          );
        if (!fromCache) allToolCalls.push({ name: block.name, args: toolArgs });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: textContent,
        });
        emitTableDataIfJson(sendEvent, textContent, block.name);
        const regenerationMessage =
          await this.linkedinQueryRegeneration.maybeRegenerateLinkedinQuerySet(
            client,
            apiToken,
            sendEvent,
            assistantThreadId,
            block.name,
            searchType,
          );
        if (regenerationMessage) {
          return {
            toolResults,
            textParts,
            regenerationMessage,
          };
        }
        if (isLinkedInSearchError(block.name, textContent)) {
          const userMessage = extractLinkedInSearchErrorMessage(textContent);
          this.logger.warn(
            `[McpAnthropicMessageProcessorService] LinkedIn search tool "${block.name}" failed; breaking flow. Error: ${userMessage.slice(0, 100)}`,
          );
          return {
            toolResults,
            textParts,
            linkedInSearchError: `LinkedIn search failed: ${userMessage}`,
          };
        }
      }
    }
    return { toolResults, textParts };
  }
}
