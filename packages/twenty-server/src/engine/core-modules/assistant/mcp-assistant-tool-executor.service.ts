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
   * Notify the assistant UI to link the current thread to a project(SSE → patch + refetch).
   * create_project, get_project_by_id (success), and an unambiguous find_project_by_name (single row).
   */
  private tryEmitJobAttachedFromToolResult(
    toolName: string,
    textContent: string,
    sendEvent: StreamEventSender,
  ): void {
    try {
      if (toolName === 'create_project') {
        const parsed = JSON.parse(textContent) as Record<string, unknown>;
        const projectId =
          (parsed.id as string | undefined) ??
          (parsed.projectId as string | undefined) ??
          ((parsed.job as Record<string, unknown> | undefined)?.id as
            | string
            | undefined);
        if (typeof projectId === 'string' && projectId) {
          sendEvent('job_attached', { projectId });
        }
        return;
      }
      if (toolName === 'get_project_by_id') {
        const parsed = JSON.parse(textContent) as {
          status?: string;
          job?: { id?: string };
        };
        if (parsed.status === 'Success' && typeof parsed.job?.id === 'string') {
          sendEvent('job_attached', { projectId: parsed.job.id });
        }
        return;
      }
      if (toolName === 'find_project_by_name') {
        const parsed = JSON.parse(textContent) as {
          count?: unknown;
          jobs?: Array<{ id?: string }>;
        };
        if (
          parsed.count === 1 &&
          Array.isArray(parsed.projects) &&
          parsed.projects.length === 1 &&
          typeof parsed.projects[0]?.id === 'string'
        ) {
          sendEvent('job_attached', { projectId: parsed.projects[0].id });
        }
      }
    } catch {
      // not JSON or unexpected shape
    }
  }

  /**
   * Emit org_chart SSE so McpClientChat can show a snippet and the results panel
   * can open ArxOrgChart (same payload shape as streaming MCP client events).
   */
  private tryEmitOrgChartFromToolResult(
    toolName: string,
    textContent: string,
    sendEvent: StreamEventSender,
  ): void {
    if (
      toolName !== 'get_org_chart' &&
      toolName !== 'search_org_charts_by_country' &&
      toolName !== 'search_org_charts_by_function'
    ) {
      return;
    }
    try {
      const parsed = JSON.parse(textContent) as Record<string, unknown>;

      const emitOne = (o: Record<string, unknown>) => {
        const companyId = o.companyId;
        const viewUrl = o.viewUrl;
        if (
          typeof companyId !== 'string' ||
          !companyId ||
          typeof viewUrl !== 'string' ||
          !viewUrl
        ) {
          return;
        }
        sendEvent('org_chart', {
          orgChart: {
            companyId,
            companyName:
              typeof o.companyName === 'string' && o.companyName
                ? o.companyName
                : companyId,
            slug:
              typeof o.slug === 'string' && o.slug ? o.slug : companyId,
            viewUrl,
            ...(typeof o.country === 'string' ? { country: o.country } : {}),
            ...(typeof o.functionRoot === 'string'
              ? { functionRoot: o.functionRoot }
              : {}),
          },
        });
      };

      if (toolName === 'get_org_chart') {
        emitOne(parsed);
        return;
      }

      const orgCharts = parsed.orgCharts;
      if (!Array.isArray(orgCharts)) {
        return;
      }
      for (const item of orgCharts) {
        if (item && typeof item === 'object') {
          emitOne(item as Record<string, unknown>);
        }
      }
    } catch {
      // not JSON or unexpected shape
    }
  }

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
      this.tryEmitOrgChartFromToolResult(name, cachedResult, sendEvent);
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

      this.tryEmitJobAttachedFromToolResult(name, textContent, sendEvent);
      this.tryEmitOrgChartFromToolResult(name, textContent, sendEvent);

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
