import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as path from 'path';
import { CandidateSearchHandlerService } from 'src/engine/core-modules/candidate-search/services/candidate-search-handler.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
  AssistantChatResponse,
  McpModelProvider,
  MessageParam,
  StreamEventSender,
} from './assistant.types';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const OPENAI_MCP_MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;
const MAX_TOOL_ROUNDS = 10;

const TABLE_LIST_KEYS = ['companies', 'jobs', 'candidates', 'people'] as const;
const STREAMING_TOOL_NAMES = [
  'search_linkedin_with_query',
  'search_linkedin_people',
  'generate_search_parameters',
  'generate_unresolved_search_parameters',
] as const;

/**
 * Tools that should NOT be offered to the "general" assistant flows.
 * They can still be explicitly enabled per-endpoint via `allowedToolNames`
 * in `callJsonWithTools`.
 */
const INTERNAL_TOOL_NAMES = new Set<string>([
  'generate_unresolved_search_parameters',
  'resolve_parameters',
  // LinkedIn query generation internals (expose only the orchestrator tool to general assistant flows)
  'generate_linkedin_query_agent1',
  'generate_linkedin_query_agent2',
  'generate_linkedin_query_agent3',
  'generate_linkedin_query_agent4',
]);

@Injectable()
export class McpAssistantService {
  private readonly logger: Logger = new Logger(McpAssistantService.name); 
  private readonly provider: McpModelProvider;
  private readonly anthropic: Anthropic;
  private readonly openai: OpenAI | null;
  private readonly serverBaseUrl: string;
  private readonly mcpServerScriptPath: string;
  // Cache for recent tool calls to prevent duplicates (key: toolName + normalized args, value: { result, timestamp })
  private readonly toolCallCache = new Map<string, { result: string; timestamp: number }>();
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds cache TTL

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {
    this.provider = this.getMcpModelProvider();
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const openaiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;
    this.openai =
      this.provider === 'openai' && openaiKey
        ? new OpenAI({ apiKey: openaiKey })
        : null;
    this.serverBaseUrl =
      process.env.SERVER_BASE_URL ?? process.env.ARXENA_SITE_BASE_URL ?? 'http://localhost:3000';
    // Resolve relative to this file: from dist/engine/core-modules/assistant -> 6 levels up = packages/ -> sibling twenty-mcp-server
    const packagesDir = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
    this.mcpServerScriptPath =
      process.env.MCP_SERVER_SCRIPT_PATH ??
      path.join(packagesDir, 'twenty-mcp-server', 'dist', 'index.js');
  }

  private getMcpModelProvider(): McpModelProvider {
    const raw = (process.env.MCP_MODEL_PROVIDER ?? 'anthropic').toLowerCase();
    return raw === 'openai' ? 'openai' : 'anthropic';
  }

  /** Sanitize tool args for logging (redact tokens, truncate long strings). */
  private sanitizeArgsForLog(args: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const redactKeys = ['apiToken', 'api_token', 'token', 'password'];
    for (const [k, v] of Object.entries(args)) {
      if (redactKeys.some((rk) => k.toLowerCase().includes(rk))) {
        out[k] = '[redacted]';
      } else if (typeof v === 'string' && v.length > 100) {
        out[k] = v.slice(0, 100) + '...';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private flattenRowForTable(row: Record<string, unknown>): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const nested = v as Record<string, unknown>;
        for (const [nk, nv] of Object.entries(nested)) {
          flat[`${k}_${nk}`] = nv;
        }
      } else {
        flat[k] = v;
      }
    }
    return flat;
  }

  private extractTableRowsFromToolResult(parsed: unknown): Record<string, unknown>[] {
    let rows: Record<string, unknown>[] = [];
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      rows = parsed as Record<string, unknown>[];
    } else if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      for (const key of TABLE_LIST_KEYS) {
        const list = obj[key];
        if (Array.isArray(list) && list.length > 0 && typeof list[0] === 'object' && list[0] !== null) {
          rows = list as Record<string, unknown>[];
          break;
        }
      }
    }
    return rows.map((row) => this.flattenRowForTable(row));
  }

  private mcpToolsToOpenAITools(
    tools: Array<{ name: string; description: string; input_schema: unknown }>,
  ): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters:
          typeof t.input_schema === 'object' && t.input_schema !== null
            ? (t.input_schema as Record<string, unknown>)
            : { type: 'object', properties: {} },
      },
    }));
  }

  private historyToOpenAIMessages(
    history: MessageParam[],
    currentUserContent: string,
    systemPrompt?: string,
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      out.push({ role: 'system', content: systemPrompt });
    }
    for (const m of history) {
      if (m.role === 'user') {
        if (typeof m.content === 'string') {
          out.push({ role: 'user', content: m.content });
        } else {
          for (const tr of m.content) {
            out.push({
              role: 'tool',
              tool_call_id: tr.tool_use_id,
              content: tr.content,
            });
          }
        }
        continue;
      }
      if (m.role === 'assistant') {
        const content = m.content as Array<
          | { type: 'text'; text: string }
          | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        >;
        const textParts: string[] = [];
        for (const block of content) {
          if (block.type === 'text') textParts.push(block.text);
          // IMPORTANT: For OpenAI, historical assistant messages **must not**
          // include `tool_calls` without corresponding tool responses in the
          // same payload. We therefore intentionally drop any historical
          // `tool_use` blocks here and only keep the assistant text. The
          // current turn's tool calls are handled inside the streaming /
          // non‑streaming OpenAI flows, where we always append matching
          // `role: "tool"` messages.
        }
        out.push({
          role: 'assistant',
          content: textParts.join('\n').trim() || null,
        });
      }
    }
    // currentUserContent += '\n\job_brief_understanding is NOT_COMPLETELY_UNDERSTOOD';
    out.push({ role: 'user', content: currentUserContent });
    return out;
  }

  /**
   * OpenAI requires historical `assistant.tool_calls` to be paired with matching
   * `role: "tool"` messages in the *same* payload.
   *
   * Our thread persistence currently stores tool call inputs (`toolCalls`) but
   * not tool outputs. To make OpenAI history coherent, we execute any
   * historical tools that don't have a persisted `tool_result` yet, then
   * inject their `role: "tool"` responses.
   */
  private async historyToOpenAIMessagesWithExecutedTools(
    history: MessageParam[],
    currentUserContent: string,
    opts: {
      client: Client;
      apiToken: string;
      systemPrompt?: string;
      assistantThreadId?: string;
      sendEvent?: StreamEventSender;
    },
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
    const {
      client,
      apiToken,
      systemPrompt,
      assistantThreadId,
      sendEvent,
    } = opts;

    const silentSendEvent: StreamEventSender = sendEvent
      ? sendEvent
      : () => true;

    const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      out.push({ role: 'system', content: systemPrompt });
    }

    // Collect any persisted tool results so we can avoid re-executing.
    const toolResultsByToolUseId = new Map<string, string>();
    for (const m of history) {
      if (m.role !== 'user' || typeof m.content === 'string') continue;
      for (const tr of m.content) {
        toolResultsByToolUseId.set(tr.tool_use_id, tr.content);
      }
    }

    for (const m of history) {
      if (m.role === 'user') {
        // If it's tool_result blocks, we'll inject matching `role: "tool"` messages
        // when we see corresponding historical `assistant.tool_calls`.
        if (typeof m.content === 'string') {
          out.push({ role: 'user', content: m.content });
        }
        continue;
      }

      if (m.role !== 'assistant') continue;

      const content = m.content as Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
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
        toolUses.push({ id: block.id, name: block.name, input: block.input ?? {} });
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

  /**
   * Generate a cache key from tool name and normalized arguments
   */
  private getToolCallCacheKey(name: string, args: Record<string, unknown>): string {
    // Normalize args by sorting keys and stringifying
    const normalized = JSON.stringify(
      Object.keys(args)
        .sort()
        .reduce((acc, key) => {
          const value = args[key];
          // Normalize string values (trim whitespace, lowercase for comparison)
          if (typeof value === 'string') {
            acc[key] = value.trim().toLowerCase();
          } else {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, unknown>),
    );
    return `${name}:${normalized}`;
  }

  /**
   * Check if a tool call result is cached and still valid
   */
  private getCachedToolResult(cacheKey: string): string | null {
    const cached = this.toolCallCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL_MS) {
      this.toolCallCache.delete(cacheKey);
      return null;
    }
    return cached.result;
  }

  /**
   * Cache a tool call result
   */
  private cacheToolResult(cacheKey: string, result: string): void {
    this.toolCallCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
    // Clean up old entries periodically (keep cache size reasonable)
    if (this.toolCallCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.toolCallCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL_MS) {
          this.toolCallCache.delete(key);
        }
      }
    }
  }

  /**
   * Create MCP client, connect, run callback, then close. Ensures client.close() in finally.
   */
  private async withMcpClient<T>(
    apiToken: string,
    fn: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({ name: 'arxena-assistant-client', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.mcpServerScriptPath],
      env: {
        ...process.env,
        ARXENA_API_TOKEN: apiToken.replace(/[\r\n]+/g, ''),
        ARXENA_BASE_URL: this.serverBaseUrl,
      },
    });
    await client.connect(transport);
    try {
      return await fn(client);
    } finally {
      await client.close();
    }
  }

  /**
   * List MCP tools and map to Anthropic Messages tool format.
   */
  private async fetchAnthropicTools(
    client: Client,
  ): Promise<Anthropic.Messages.Tool[]> {
    const toolsResult = await client.listTools();
    return toolsResult.tools
      .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description ?? '',
        input_schema: {
          type: 'object' as const,
          ...(typeof t.inputSchema === 'object' && t.inputSchema !== null
            ? (t.inputSchema as Record<string, unknown>)
            : {}),
        },
      })) as Anthropic.Messages.Tool[];
  }

  /**
   * List MCP tools and map to OpenAI chat completion tools format.
   */
  private async fetchOpenAITools(
    client: Client,
  ): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
    const toolsResult = await client.listTools();
    return this.mcpToolsToOpenAITools(
      toolsResult.tools
        .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name))
        .map((t) => ({
          name: t.name,
          description: t.description ?? '',
          input_schema: t.inputSchema,
        })),
    );
  }

  /**
   * Consume OpenAI stream: accumulate content and tool_calls, emit text deltas.
   * Returns content string and sorted list of tool calls for this turn.
   */
  private async consumeOpenAIStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    sendEvent: StreamEventSender,
  ): Promise<{
    content: string;
    toolCallsList: Array<{ id: string; name: string; args: string; index: number }>;
  }> {
    let content = '';
    const toolCallsAccum = new Map<
      number,
      { id: string; name: string; args: string; index: number }
    >();
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        sendEvent('text', { delta: delta.content });
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const cur = toolCallsAccum.get(idx) ?? {
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            args: tc.function?.arguments ?? '',
            index: idx,
          };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
          toolCallsAccum.set(idx, cur);
        }
      }
    }
    const toolCallsList = [...toolCallsAccum.values()]
      .filter((t) => t.id && t.name)
      .sort((a, b) => a.index - b.index);
    return { content, toolCallsList };
  }

  /**
   * Execute a single tool (cache, in-process, or MCP).
   * Caller should call sendEvent('tool_use', { name }) before this (and break if it returns false).
   * Returns textContent and whether result came from cache (caller updates allToolCalls when !fromCache).
   * When assistantThreadId is provided, it is merged into args so tool handlers receive it.
   */
  private async executeToolAndGetResult(
    client: Client,
    name: string,
    args: Record<string, unknown>,
    apiToken: string,
    sendEvent: StreamEventSender,
    assistantThreadId?: string,
  ): Promise<{ textContent: string; fromCache: boolean }> {
    const effectiveArgs =
      assistantThreadId != null && assistantThreadId !== ''
        ? { ...args, assistantThreadId }
        : args;
    const cacheKey = this.getToolCallCacheKey(name, effectiveArgs);
    const cachedResult = this.getCachedToolResult(cacheKey);
    if (cachedResult !== null) {
      this.logger.log(`Skipping duplicate ${name} call (already executed in this session)`);
      sendEvent?.('status', { message: `Skipping duplicate ${name} call...` });
      return { textContent: cachedResult, fromCache: true };
    }
    const inProcessResult = await this.runStreamingToolInProcess(
      name,
      effectiveArgs,
      apiToken,
      sendEvent,
    );
    if (inProcessResult !== null) {
      this.logger.log(`Tool "${name}" completed in-process.`);
      return { textContent: inProcessResult, fromCache: false };
    }
    this.logger.log(
      `Calling MCP subprocess for tool: ${name} (args: ${JSON.stringify(this.sanitizeArgsForLog(effectiveArgs))})`,
    );
    try {
      const result = await client.callTool({
        name,
        arguments: effectiveArgs,
      });
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
        this.cacheToolResult(cacheKey, fallback);
        return { textContent: fallback, fromCache: false };
      }
      this.cacheToolResult(cacheKey, textContent);
      return { textContent, fromCache: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`MCP tool "${name}" failed: ${message}`, err instanceof Error ? err.stack : undefined);
      const textContent = JSON.stringify({ error: message });
      this.cacheToolResult(cacheKey, textContent);
      return { textContent, fromCache: false };
    }
  }

  /**
   * If tool result is JSON with list-like data, emit table_data event for UI.
   */
  private emitTableDataIfJson(sendEvent: StreamEventSender, textContent: string): void {
    if (!textContent) return;
    try {
      const parsed = JSON.parse(textContent) as unknown;
      const rows = this.extractTableRowsFromToolResult(parsed);
      if (rows.length > 0) {
        const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
        sendEvent('table_data', { columns, rows });
      }
    } catch {
      // not JSON or not a list of objects – ignore
    }
  }

  /**
   * Emit final_text and done events (shared contract for both providers).
   */
  private emitStreamComplete(
    sendEvent: StreamEventSender,
    fullText: string,
    allToolCalls: Array<{ name: string; args: Record<string, unknown> }>,
  ): void {
    sendEvent('final_text', { text: fullText });
    sendEvent('done', {
      text: fullText,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    });
  }

  /**
   * If this tool is a streaming candidate-search tool, run the same message/stream flow
   * in-process with sendEvent and return the tool result string. Otherwise return null.
   */
  private async runStreamingToolInProcess(
    name: string,
    args: Record<string, unknown>,
    apiToken: string,
    sendEvent: StreamEventSender,
  ): Promise<string | null> {
    const isStreamingTool = STREAMING_TOOL_NAMES.includes(name as (typeof STREAMING_TOOL_NAMES)[number]);
    if (!isStreamingTool) {
      this.logger.warn(
        `Tool "${name}" not in STREAMING_TOOL_NAMES [${STREAMING_TOOL_NAMES.join(', ')}]; delegating to MCP subprocess. ` +
          'If this tool should run in-process and produce server logs, add it to STREAMING_TOOL_NAMES in mcp-assistant.service.ts.',
      );
      this.logger.log(`Tool call: ${name} (args: ${JSON.stringify(this.sanitizeArgsForLog(args))})`);
      return null;
    }
    this.logger.log(`Executing tool in-process: ${name} (args: ${JSON.stringify(this.sanitizeArgsForLog(args))})`);

    // Check cache for duplicate calls
    const cacheKey = this.getToolCallCacheKey(name, args);
    const cachedResult = this.getCachedToolResult(cacheKey);
    if (cachedResult !== null) {
      this.logger.log(`Returning cached result for ${name} (duplicate call detected)`);
      sendEvent?.('status', { message: `Using cached result for ${name}...` });
      return cachedResult;
    }

    const isGenerateSearchParams =
      name === 'generate_search_parameters' || name === 'generate_unresolved_search_parameters';
    if (isGenerateSearchParams) {
      sendEvent?.('status', { message: 'Generating search parameters from LinkedIn query generation...' });
      this.logger.log(`Generating search parameters from LinkedIn query generation...`);
      const prompt = (args.prompt ?? args.query) as string | undefined;
      const searchType = (args.searchType as 'classic' | 'sales_navigator' | 'recruiter') ?? 'classic';
      const searchCategory = (args.searchCategory as 'people' | 'companies' | 'posts' | 'jobs') ?? 'people';
      if (typeof prompt !== 'string' || !prompt.trim()) {
        this.logger.warn(
          `Tool ${name}: missing or empty prompt/query (prompt=${typeof prompt}, value length=${typeof prompt === 'string' ? prompt.length : 0}); delegating to MCP.`,
        );
        return null;
      }
      if (searchCategory !== 'people') {
        this.logger.log(`Tool ${name}: searchCategory=${searchCategory}; only people is supported, returning error to caller.`);
        return JSON.stringify({
          error: 'Only people search is supported for generate_search_parameters with streaming.',
        });
      }
      try {
        const rawQuery = (args.rawQuery as string) ?? prompt;
        const unresolvedSearchParams =
          await this.candidateSearchHandlerService.generateUnresolvedSearchParametersFromLinkedinQueryGeneration(
            rawQuery,
            searchType,
            sendEvent,
          );
        sendEvent?.('status', { message: 'Produced unresolved search parameters...' });
        this.logger.log(`Produced unresolved search parameters...`);
        const result = JSON.stringify(unresolvedSearchParams);
        // Cache the result
        this.cacheToolResult(cacheKey, result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Tool ${name} failed (in-process): ${message}`,
          err instanceof Error ? err.stack : undefined,
        );
        return JSON.stringify({ error: message, searchParameters: null, searchStrategies: null });
      }
    }

    if (name === 'search_linkedin_people' || name === 'search_linkedin_with_query') {
      const query = args.query;
      const assistantThreadId = args.assistantThreadId;
      // Only run in-process when we have a valid assistantThreadId (candidate-search-chat flow).
      this.logger.log('This is the search linkedin people tool being called');
      this.logger.log('query::', query);
      this.logger.log('assistantThreadId::', assistantThreadId);
      if (
        typeof query !== 'string' ||
        !query.trim() ||
        typeof assistantThreadId !== 'string' ||
        !assistantThreadId.trim()
      ) {
        this.logger.log(
          `Tool ${name}: missing query or assistantThreadId; delegating to MCP subprocess instead of in-process candidate-search handler.`,
        );
        return null;
      }
    }
    sendEvent?.('status', { message: 'Running streaming tool in process...' });
    this.logger.log(`Running streaming tool in process...`);

    const body = {
      message: String(args.query ?? args.message ?? ''),
      assistantThreadId: String(args.assistantThreadId ?? ''),
      searchType: (args.searchType as 'classic' | 'sales_navigator' | 'recruiter') ?? 'classic',
      searchCategory: (args.searchCategory as 'people' | 'companies' | 'posts' | 'jobs') ?? 'people',
      parsedJD: args.parsedJD as Record<string, unknown> | undefined,
      includeJd: args.includeJd !== false,
    };

    try {
      const result = await this.candidateSearchHandlerService.handleMessageStream(
        body,
        apiToken,
        (event, data) => sendEvent(event, data),
      );
      const candidates = this.candidateSearchHandlerService.extractCandidatesFromResponse(
        result.response,
      );
      // Only return a summary + reference to the LLM — full candidate data stays in Redis cache.
      // This prevents the tool result (100 candidates × full JSON) from bloating the context window.
      const toolResult = JSON.stringify({
        text: result.response?.chatMessage ?? result.assistantMessage ?? '',
        ...(candidates.length > 0
          ? {
              candidateCount: candidates.length,
              searchRef: String(args.assistantThreadId ?? ''),
            }
          : {}),
        ...(result.response?.error ? { error: result.response.error } : {}),
      });
      // Cache the result
      this.cacheToolResult(cacheKey, toolResult);
      return toolResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ text: '', error: message });
    }
  }

  /** Strip surrounding double quotes from LLM output so the name is shown plainly. */
  private stripThreadNameQuotes(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  }

  async generateThreadName(
    userMessage: string,
    assistantResponse: string,
  ): Promise<string> {
    const prompt = `Based on this conversation, generate a short, descriptive thread name (max 50 characters). 
User: "${userMessage}"
Assistant: "${assistantResponse.substring(0, 200)}"

Return only the thread name, nothing else. Do not wrap it in quotes.`;

    try {
      if (this.provider === 'openai' && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that generates concise, descriptive thread names for conversations.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 50,
          temperature: 0.7,
        });
        const raw =
          response.choices[0]?.message?.content?.trim() ?? 'New thread';
        const name = this.stripThreadNameQuotes(raw);
        return name.length > 50 ? name.substring(0, 47) + '...' : name || 'New thread';
      } else {
        const response = await this.anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 50,
          messages: [
            {
              role: 'user',
              content: `You are a helpful assistant that generates concise, descriptive thread names for conversations.\n\n${prompt}`,
            },
          ],
        });
        const text = response.content[0];
        const raw = text.type === 'text' ? text.text.trim() : 'New thread';
        const name = this.stripThreadNameQuotes(raw);
        return name.length > 50 ? name.substring(0, 47) + '...' : name || 'New thread';
      }
    } catch (err) {
      const fallback =
        userMessage.length > 50
          ? userMessage.substring(0, 47) + '...'
          : userMessage;
      return this.stripThreadNameQuotes(fallback) || 'New thread';
    }
  }

  async listTools(apiToken: string): Promise<Array<{ name: string; description: string; input_schema: unknown }>> {
    const client = new Client({ name: 'arxena-assistant-client', version: '1.0.0' });
    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
        apiToken,
      );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.mcpServerScriptPath],
      env: {
        ...process.env,
        ARXENA_API_TOKEN: apiToken.replace(/[\r\n]+/g, ''),
        ARXENA_BASE_URL: this.serverBaseUrl,
        ARXENA_WORKSPACE_MEMBER_ID: workspaceMemberId ?? '',
      },
    });

    await client.connect(transport);
    try {
      const result = await client.listTools();
      const tools = result.tools.map((t) => ({
        name: t.name,
        description: t.description ?? '',
        input_schema: t.inputSchema,
      }));
      return tools;
    } finally {
      await client.close();
    }
  }

  async processQuery(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    systemPrompt?: string,
  ): Promise<AssistantChatResponse> {
    if (this.provider === 'openai' && this.openai) {
      return this.processQueryWithOpenAI(query, apiToken, conversationHistory, systemPrompt);
    }
    return this.processQueryWithAnthropic(query, apiToken, conversationHistory, systemPrompt);
  }

  private async processQueryWithAnthropic(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    systemPrompt?: string,
  ): Promise<AssistantChatResponse> {
    const client = new Client({ name: 'arxena-assistant-client', version: '1.0.0' });
    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
        apiToken,
      );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.mcpServerScriptPath],
      env: {
        ...process.env,
        ARXENA_API_TOKEN: apiToken.replace(/[\r\n]+/g, ''),
        ARXENA_BASE_URL: this.serverBaseUrl,
      },
    });

    await client.connect(transport);

    try {
      const toolsResult = await client.listTools();
      const availableTools = toolsResult.tools.map((t) => ({
        name: t.name,
        description: t.description ?? '',
        input_schema: {
          type: 'object' as const,
          ...(typeof t.inputSchema === 'object' && t.inputSchema !== null
            ? (t.inputSchema as Record<string, unknown>)
            : {}),
        },
      }))
      .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name)) as Anthropic.Messages.Tool[];

      const messages: MessageParam[] = [
        ...conversationHistory,
        { role: 'user', content: query },
      ];

      let response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages as Anthropic.MessageParam[],
        tools: availableTools,
      });

      const finalText: string[] = [];
      const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const assistantContent = response.content as Array<
          | { type: 'text'; text: string }
          | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
        >;

        let hasToolUse = false;
        const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

        for (const block of assistantContent) {
          if (block.type === 'text') {
            finalText.push(block.text);
          }
          if (block.type === 'tool_use') {
            hasToolUse = true;
            toolCalls.push({ name: block.name, args: block.input ?? {} });
            this.logger.log(
              `[Non-streaming] Calling MCP subprocess for tool: ${block.name} (args: ${JSON.stringify(this.sanitizeArgsForLog(block.input ?? {}))})`,
            );
            const result = await client.callTool({
              name: block.name,
              arguments: block.input ?? {},
            });
            const textContent = result.content
              ?.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
              .join('\n');
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: textContent ?? '',
            });
          }
        }

        if (!hasToolUse) {
          break;
        }

        messages.push({
          role: 'assistant',
          content: assistantContent,
        });
        messages.push({
          role: 'user',
          content: toolResults,
        });

        response = await this.anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: messages as Anthropic.MessageParam[],
          tools: availableTools,
        });
      }

      return {
        text: finalText.join('\n').trim() || 'No response generated.',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } finally {
      await client.close();
    }
  }

  private async processQueryWithOpenAI(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    systemPrompt?: string,
  ): Promise<AssistantChatResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not configured. Set MCP_MODEL_PROVIDER=openai and OPENAI_API_KEY.');
    }
    const client = new Client({ name: 'arxena-assistant-client', version: '1.0.0' });
    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
        apiToken,
      );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.mcpServerScriptPath],
      env: {
        ...process.env,
        ARXENA_API_TOKEN: apiToken.replace(/[\r\n]+/g, ''),
        ARXENA_BASE_URL: this.serverBaseUrl,
      },
    });

    await client.connect(transport);

    try {
      const toolsResult = await client.listTools();
      const openaiTools = this.mcpToolsToOpenAITools(
        toolsResult.tools
          .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name))
          .map((t) => ({
            name: t.name,
            description: t.description ?? '',
            input_schema: t.inputSchema,
          })),
      );

      let openaiMessages = await this.historyToOpenAIMessagesWithExecutedTools(
        conversationHistory,
        query,
        {
          client,
          apiToken,
          systemPrompt,
          sendEvent: () => true,
        },
      );
      const finalText: string[] = [];
      const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const response = await this.openai.chat.completions.create({
          model: process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL,
          max_tokens: MAX_TOKENS,
          messages: openaiMessages,
          tools: openaiTools,
        });

        const choice = response.choices[0];
        if (!choice?.message) {
          break;
        }
        const msg = choice.message;
        if (msg.content) {
          finalText.push(String(msg.content));
        }

        const toolCallsList = msg.tool_calls;
        if (!toolCallsList?.length) {
          break;
        }

        openaiMessages = [...openaiMessages, msg];
        for (const tc of toolCallsList) {
          if (tc.type !== 'function') continue;
          const args = (() => {
            try {
              return (JSON.parse(tc.function.arguments ?? '{}') ?? {}) as Record<string, unknown>;
            } catch {
              return {};
            }
          })();
          toolCalls.push({ name: tc.function.name, args });
          this.logger.log(
            `[Non-streaming] Calling MCP subprocess for tool: ${tc.function.name} (args: ${JSON.stringify(this.sanitizeArgsForLog(args))})`,
          );
          const result = await client.callTool({
            name: tc.function.name,
            arguments: args,
          });
          const textContent = result.content
            ?.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
            .join('\n');
          openaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: textContent ?? '',
          });
        }
      }

      return {
        text: finalText.join('\n').trim() || 'No response generated.',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } finally {
      await client.close();
    }
  }

  /**
   * Helper for non-streaming JSON-style OpenAI calls with MCP tools.
   * Runs the OpenAI tool_call loop until completion and returns parsed JSON.
   */
  async callJsonWithTools(
    apiToken: string,
    systemPrompt: string,
    userPrompt: string,
    options?: {
      allowedToolNames?: string[];
      model?: string;
      maxTokens?: number;
    },
  ): Promise<unknown> {
    if (!this.openai) {
      throw new Error('OpenAI client not configured. Set MCP_MODEL_PROVIDER=openai and OPENAI_API_KEY.');
    }

    const model = options?.model ?? process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL;
    const maxTokens = options?.maxTokens ?? 2000;

    return this.withMcpClient(apiToken, async (client) => {
      const toolsResult = await client.listTools();
      const allTools = this.mcpToolsToOpenAITools(
        toolsResult.tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          input_schema: t.inputSchema,
        })),
      );

      const tools =
        options?.allowedToolNames && options.allowedToolNames.length > 0
          ? allTools.filter(
              (t) => t.type === 'function' && options.allowedToolNames!.includes(t.function.name),
            )
          : allTools.filter((t) => t.type === 'function' && !INTERNAL_TOOL_NAMES.has(t.function.name));

      let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Loop until the model stops returning tool_calls
      for (;;) {
        const completion = await this.openai!.chat.completions.create({
          model,
          messages,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          tools,
        });

        const msg = completion.choices[0]?.message;
        if (!msg) {
          throw new Error('No message from OpenAI');
        }

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          const content = msg.content ?? '';
          const raw = typeof content === 'string' ? content : String(content);
          return JSON.parse(raw);
        }

        messages.push(msg);

        for (const toolCall of msg.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const toolName = toolCall.function.name;
          const toolArgs = (() => {
            try {
              return JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
            } catch {
              return {};
            }
          })();

          this.logger.log(
            `[JobBrief] Calling MCP subprocess for tool: ${toolName} (args: ${JSON.stringify(
              this.sanitizeArgsForLog(toolArgs),
            )})`,
          );

          const result = await client.callTool({
            name: toolName,
            arguments: toolArgs,
          });

          const textContent =
            result.content
              ?.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
              .join('\n') ?? '';

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: textContent,
          });
        }
      }
    });
  }

  async processQueryStream(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
    options?: { assistantThreadId?: string },
  ): Promise<void> {
    const assistantThreadId = options?.assistantThreadId;
    if (this.provider === 'openai' && this.openai) {
      const streamResult = await this.processQueryStreamWithOpenAI(query, apiToken, conversationHistory, sendEvent, systemPrompt, assistantThreadId);
      return streamResult;
    }
    const streamResult = await this.processQueryStreamWithAnthropic(query, apiToken, conversationHistory, sendEvent, systemPrompt, assistantThreadId);
    return streamResult;
  }

  /** Run one Anthropic stream round; returns assistant content blocks (text + tool_use). */
  private async streamAnthropicRound(
    messages: MessageParam[],
    availableTools: Anthropic.Messages.Tool[],
    systemPrompt: string | undefined,
    sendEvent: StreamEventSender,
  ): Promise<
    Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    >
  > {
    const stream = this.anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: messages as Anthropic.MessageParam[],
      tools: availableTools,
    });
    stream.on('text', (delta: string) => {
      sendEvent('text', { delta });
    });
    stream.on('error', (err: Error) => {
      sendEvent('error', { error: err.message });
    });
    const finalMessage = await stream.finalMessage();
    return finalMessage.content as Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    >;
  }

  /**
   * Process assistant content: collect text, run tool_use blocks (with cache/MCP), emit table_data.
   * Returns toolResults for this round and text parts; mutates allToolCalls.
   */
  private async processAnthropicAssistantContent(
    assistantContent: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    >,
    client: Client,
    apiToken: string,
    sendEvent: StreamEventSender,
    allToolCalls: Array<{ name: string; args: Record<string, unknown> }>,
    assistantThreadId?: string,
  ): Promise<{
    toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }>;
    textParts: string[];
  }> {
    const textParts: string[] = [];
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];
    for (const block of assistantContent) {
      if (block.type === 'text') {
        textParts.push(block.text);
      }
      if (block.type === 'tool_use') {
        const toolArgs = block.input ?? {};
        if (!sendEvent('tool_use', { name: block.name })) break;
        const { textContent, fromCache } = await this.executeToolAndGetResult(
          client,
          block.name,
          toolArgs,
          apiToken,
          sendEvent,
          assistantThreadId,
        );
        if (!fromCache) allToolCalls.push({ name: block.name, args: toolArgs });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: textContent,
        });
        this.emitTableDataIfJson(sendEvent, textContent);
      }
    }
    return { toolResults, textParts };
  }

  private async processQueryStreamWithAnthropic(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
    assistantThreadId?: string,
  ): Promise<void> {
    await this.withMcpClient(apiToken, async (client) => {
      const availableTools = await this.fetchAnthropicTools(client);
      const messages: MessageParam[] = [
        ...conversationHistory,
        { role: 'user', content: query },
      ];
      const finalText: string[] = [];
      const allToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const assistantContent = await this.streamAnthropicRound(
          messages,
          availableTools,
          systemPrompt,
          sendEvent,
        );
        const { toolResults, textParts } = await this.processAnthropicAssistantContent(
          assistantContent,
          client,
          apiToken,
          sendEvent,
          allToolCalls,
          assistantThreadId,
        );
        finalText.push(...textParts);
        const hasToolUse = toolResults.length > 0;
        if (!hasToolUse) break;

        messages.push({ role: 'assistant', content: assistantContent });
        messages.push({ role: 'user', content: toolResults });
      }

      const fullText = finalText.join('\n').trim() || 'No response generated.';
      this.emitStreamComplete(sendEvent, fullText, allToolCalls);
    });
  }

  private async processQueryStreamWithOpenAI(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
    assistantThreadId?: string,
  ): Promise<void> {
    if (!this.openai) {
      sendEvent('error', {
        error: 'OpenAI client not configured. Set MCP_MODEL_PROVIDER=openai and OPENAI_API_KEY.',
      });
      sendEvent('done', { text: '', toolCalls: undefined });
      return;
    }

    this.logger.log(`MCP Client System Prompt:, ${systemPrompt}`);
    await this.withMcpClient(apiToken, async (client) => {
      const openaiTools = await this.fetchOpenAITools(client);
      let openaiMessages = await this.historyToOpenAIMessagesWithExecutedTools(
        conversationHistory,
        query,
        {
          client,
          apiToken,
          systemPrompt,
          assistantThreadId,
          sendEvent: () => true,
        },
      );
      this.logger.log(`MCP Client openaiMessages:, ${JSON.stringify(openaiMessages, null, 2)}`);
      const finalText: string[] = [];
      const allToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      let rounds = 0;
      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const stream = await this.openai!.chat.completions.create({
          model: process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL,
          max_tokens: MAX_TOKENS,
          messages: openaiMessages,
          tools: openaiTools,
          stream: true,
        });
        const { content, toolCallsList } = await this.consumeOpenAIStream(
          stream,
          sendEvent,
        );
        if (content) finalText.push(content);
        if (toolCallsList.length === 0) break;

        const assistantMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: content || null,
          tool_calls: toolCallsList.map((t) => ({
            id: t.id,
            type: 'function' as const,
            function: { name: t.name, arguments: t.args },
          })),
        };
        openaiMessages = [...openaiMessages, assistantMessage];

        for (const tc of toolCallsList) {
          const args = (() => {
            try {
              return (JSON.parse(tc.args || '{}') ?? {}) as Record<string, unknown>;
            } catch {
              return {};
            }
          })();
          sendEvent('tool_use', { name: tc.name });
          const { textContent, fromCache } = await this.executeToolAndGetResult(
            client,
            tc.name,
            args,
            apiToken,
            sendEvent,
            assistantThreadId,
          );
          if (!fromCache) allToolCalls.push({ name: tc.name, args });
          openaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: textContent,
          });
          this.emitTableDataIfJson(sendEvent, textContent);
        }
      }

      const fullText = finalText.join('\n').trim() || 'No response generated.';
      this.logger.log(
        `[OpenAI stream] fullText length=${fullText.length}, preview=${fullText.slice(0, 200)}`,
      );
      this.emitStreamComplete(sendEvent, fullText, allToolCalls);
    });
  }
}
