import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { MessageParam, StreamEventSender } from './assistant.types';
import { McpInProcessToolRunnerService } from './mcp-in-process-tool-runner.service';
import { McpToolCallCacheService } from './mcp-tool-call-cache.service';
import { throwIfAborted } from './utils/mcp-assistant-abort.util';
import { sanitizeArgsForLog } from './utils/mcp-assistant-args.util';

@Injectable()
export class McpAssistantToolExecutorService {
  private readonly logger = new Logger(McpAssistantToolExecutorService.name);

  constructor(
    private readonly toolCallCache: McpToolCallCacheService,
    private readonly inProcessToolRunner: McpInProcessToolRunnerService,
  ) {}

  /**
   * OpenAI requires historical `assistant.tool_calls` to be paired with matching
   * `role: "tool"` messages in the *same* payload.
   */
  async historyToOpenAIMessagesWithExecutedTools(
    history: MessageParam[],
    currentUserContent: string,
    opts: {
      client: Client;
      apiToken: string;
      systemPrompt?: string;
      assistantThreadId?: string;
      searchType?: 'classic' | 'sales_navigator' | 'recruiter';
      sendEvent?: StreamEventSender;
    },
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
    const {
      client,
      apiToken,
      systemPrompt,
      assistantThreadId,
      searchType,
      sendEvent,
    } = opts;

    const silentSendEvent: StreamEventSender = sendEvent
      ? sendEvent
      : () => true;

    const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      out.push({ role: 'system', content: systemPrompt });
    }

    const toolResultsByToolUseId = new Map<string, string>();
    for (const m of history) {
      if (m.role !== 'user' || typeof m.content === 'string') continue;
      for (const tr of m.content) {
        toolResultsByToolUseId.set(tr.tool_use_id, tr.content);
      }
    }

    for (const m of history) {
      if (m.role === 'user') {
        if (typeof m.content === 'string') {
          out.push({ role: 'user', content: m.content });
        }
        continue;
      }

      if (m.role !== 'assistant') continue;

      const content = m.content as Array<
        | { type: 'text'; text: string }
        | {
            type: 'tool_use';
            id: string;
            name: string;
            input: Record<string, unknown>;
          }
      >;

      const textParts: string[] = [];
      const toolUses: Array<{
        id: string;
        name: string;
        input: Record<string, unknown>;
      }> = [];

      for (const block of content) {
        if (block.type === 'text') {
          textParts.push(block.text);
          continue;
        }
        toolUses.push({
          id: block.id,
          name: block.name,
          input: block.input ?? {},
        });
      }

      if (toolUses.length === 0) {
        out.push({
          role: 'assistant',
          content: textParts.join('\n').trim() || null,
        });
        continue;
      }

      const toolCallParams: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }> = toolUses.map((tu) => ({
        id: tu.id,
        type: 'function' as const,
        function: { name: tu.name, arguments: JSON.stringify(tu.input ?? {}) },
      }));

      out.push({
        role: 'assistant',
        content: textParts.join('\n').trim() || null,
        tool_calls: toolCallParams,
      });

      for (const toolUse of toolUses) {
        let toolContent = toolResultsByToolUseId.get(toolUse.id);
        if (toolContent == null) {
          const result = await this.executeToolAndGetResult(
            client,
            toolUse.name,
            toolUse.input ?? {},
            apiToken,
            silentSendEvent,
            assistantThreadId,
            searchType,
          );
          toolContent = result.textContent;
          toolResultsByToolUseId.set(toolUse.id, toolContent);
        }

        out.push({
          role: 'tool',
          tool_call_id: toolUse.id,
          content: toolContent ?? '',
        });
      }
    }

    out.push({ role: 'user', content: currentUserContent });
    return out;
  }

  async executeToolAndGetResult(
    client: Client,
    name: string,
    args: Record<string, unknown>,
    apiToken: string,
    sendEvent: StreamEventSender,
    assistantThreadId?: string,
    searchType?: 'classic' | 'sales_navigator' | 'recruiter',
    abortSignal?: AbortSignal,
  ): Promise<{ textContent: string; fromCache: boolean }> {
    throwIfAborted(abortSignal);
    let effectiveArgs = { ...args };
    if (assistantThreadId != null && assistantThreadId !== '') {
      effectiveArgs = { ...effectiveArgs, assistantThreadId };
    }
    if (searchType) {
      effectiveArgs = { ...effectiveArgs, searchType };
    }
    const cacheKey = this.toolCallCache.buildKey(name, effectiveArgs);
    const cachedResult = this.toolCallCache.getCachedToolResult(cacheKey);
    if (cachedResult !== null) {
      this.logger.log(
        `Skipping duplicate ${name} call (already executed in this session)`,
      );
      sendEvent?.('status', { message: `Skipping duplicate ${name} call...` });
      return { textContent: cachedResult, fromCache: true };
    }
    const inProcessResult =
      await this.inProcessToolRunner.runStreamingToolInProcess(
        name,
        effectiveArgs,
        apiToken,
        sendEvent,
        abortSignal,
      );
    if (inProcessResult !== null) {
      this.logger.log(`Tool "${name}" completed in-process.`);
      return { textContent: inProcessResult, fromCache: false };
    }
    this.logger.log(
      `Calling MCP subprocess for tool: ${name} (args: ${JSON.stringify(sanitizeArgsForLog(effectiveArgs))})`,
    );
    try {
      throwIfAborted(abortSignal);
      const result = await client.callTool({
        name,
        arguments: effectiveArgs,
      });
      throwIfAborted(abortSignal);
      const textContent =
        result.content
          ?.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
          .join('\n') ?? '';

      if (!result.content || textContent.trim() === '') {
        this.logger.warn(
          `MCP tool "${name}" returned empty content. Raw result: ${JSON.stringify(result)}`,
        );
        const fallback = JSON.stringify({
          error: `Tool "${name}" returned empty content`,
          toolName: name,
          hasContent: !!result.content,
          rawResult: result,
        });
        this.toolCallCache.cacheToolResult(cacheKey, fallback);
        return { textContent: fallback, fromCache: false };
      }
      this.toolCallCache.cacheToolResult(cacheKey, textContent);
      this.logger.log(
        `MCP tool "${name}" result (first 300 chars): ${textContent.slice(0, 300)}`,
      );

      if (name === 'create_job') {
        try {
          const parsed = JSON.parse(textContent) as Record<string, unknown>;
          const jobId =
            (parsed.id as string | undefined) ??
            (parsed.jobId as string | undefined) ??
            ((parsed.job as Record<string, unknown> | undefined)?.id as
              | string
              | undefined);
          if (typeof jobId === 'string' && jobId) {
            sendEvent('job_attached', { jobId });
          }
        } catch {
          // textContent not JSON – ignore
        }
      }

      return { textContent, fromCache: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `MCP tool "${name}" failed: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      const textContent = JSON.stringify({ error: message });
      return { textContent, fromCache: false };
    }
  }
}
