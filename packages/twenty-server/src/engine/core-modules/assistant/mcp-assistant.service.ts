import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as path from 'path';
import { CandidateSearchHandlerService } from 'src/engine/core-modules/candidate-search/services/candidate-search-handler.service';
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
        const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];
        for (const block of content) {
          if (block.type === 'text') textParts.push(block.text);
          if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
            });
          }
        }
        out.push({
          role: 'assistant',
          content: textParts.join('\n').trim() || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
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

    if (name === 'search_linkedin_people') {
      const query = args.query;
      const searchFilterId = args.searchFilterId;
      if (typeof query !== 'string' || !query || typeof searchFilterId !== 'string' || !searchFilterId) {
        return null;
      }
    }
    if (name === 'search_linkedin_with_query') {
      const query = args.query;
      const searchFilterId = args.searchFilterId;
      if (typeof query !== 'string' || !query || typeof searchFilterId !== 'string' || !searchFilterId) {
        return null;
      }
    }
    sendEvent?.('status', { message: 'Running streaming tool in process...' });
    this.logger.log(`Running streaming tool in process...`);

    const body = {
      message: String(args.query ?? args.message ?? ''),
      searchFilterId: String(args.searchFilterId ?? ''),
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
      const toolResult = JSON.stringify({
        text: result.response?.chatMessage ?? result.assistantMessage ?? '',
        ...(candidates.length > 0 ? { candidates } : {}),
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
      })) as Anthropic.Messages.Tool[];

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
        toolsResult.tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          input_schema: t.inputSchema,
        })),
      );

      let openaiMessages = this.historyToOpenAIMessages(conversationHistory, query, systemPrompt);
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

  async processQueryStream(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
  ): Promise<void> {
    if (this.provider === 'openai' && this.openai) {
      return this.processQueryStreamWithOpenAI(query, apiToken, conversationHistory, sendEvent, systemPrompt);
    }
    return this.processQueryStreamWithAnthropic(query, apiToken, conversationHistory, sendEvent, systemPrompt);
  }

  private async processQueryStreamWithAnthropic(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
  ): Promise<void> {
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
      })) as Anthropic.Messages.Tool[];

      const messages: MessageParam[] = [
        ...conversationHistory,
        { role: 'user', content: query },
      ];

      const finalText: string[] = [];
      const allToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
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
        const assistantContent = finalMessage.content as Array<
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
            const toolArgs = block.input ?? {};
            
            // Check for duplicate tool calls in the same round
            const cacheKey = this.getToolCallCacheKey(block.name, toolArgs);
            const cachedResult = this.getCachedToolResult(cacheKey);
            
            let textContent: string;
            if (cachedResult !== null) {
              this.logger.log(`Skipping duplicate ${block.name} call (already executed in this session)`);
              sendEvent?.('status', { message: `Skipping duplicate ${block.name} call...` });
              textContent = cachedResult;
            } else {
              allToolCalls.push({ name: block.name, args: toolArgs });
              if (!sendEvent('tool_use', { name: block.name })) break;
              const inProcessResult = await this.runStreamingToolInProcess(
                block.name,
                toolArgs,
                apiToken,
                sendEvent,
              );
              if (inProcessResult !== null) {
                this.logger.log(`Tool "${block.name}" completed in-process.`);
                textContent = inProcessResult;
              } else {
                this.logger.log(
                  `Calling MCP subprocess for tool: ${block.name} (args: ${JSON.stringify(this.sanitizeArgsForLog(toolArgs))})`,
                );
                const result = await client.callTool({
                  name: block.name,
                  arguments: toolArgs,
                });
                textContent =
                  result.content
                    ?.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                    .join('\n') ?? '';
                // Cache non-streaming tool results too
                this.cacheToolResult(cacheKey, textContent);
              }
            }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: textContent,
            });
            // If tool result is JSON with a list of objects, send as table_data for table display
            if (textContent) {
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
          }
        }

        if (!hasToolUse) break;

        messages.push({
          role: 'assistant',
          content: assistantContent,
        });
        messages.push({
          role: 'user',
          content: toolResults,
        });
      }

      sendEvent('done', {
        text: finalText.join('\n').trim() || 'No response generated.',
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      });
    } finally {
      await client.close();
    }
  }

  private async processQueryStreamWithOpenAI(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
  ): Promise<void> {
    if (!this.openai) {
      sendEvent('error', {
        error: 'OpenAI client not configured. Set MCP_MODEL_PROVIDER=openai and OPENAI_API_KEY.',
      });
      sendEvent('done', { text: '', toolCalls: undefined });
      return;
    }
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
      const toolsResult = await client.listTools();
      const openaiTools = this.mcpToolsToOpenAITools(
        toolsResult.tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          input_schema: t.inputSchema,
        })),
      );

      let openaiMessages = this.historyToOpenAIMessages(conversationHistory, query, systemPrompt);
      const finalText: string[] = [];
      const allToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const stream = await this.openai.chat.completions.create({
          model: process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL,
          max_tokens: MAX_TOKENS,
          messages: openaiMessages,
          tools: openaiTools,
          stream: true,
        });

        let content = '';
        const toolCallsAccum: Map<
          number,
          { id: string; name: string; args: string; index: number }
        > = new Map();

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            content += delta.content;
            if (!sendEvent('text', { delta: delta.content })) return;
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
          
          // Check for duplicate tool calls in the same round
          const cacheKey = this.getToolCallCacheKey(tc.name, args);
          const cachedResult = this.getCachedToolResult(cacheKey);
          
          let textContent: string;
          if (cachedResult !== null) {
            this.logger.log(`Skipping duplicate ${tc.name} call (already executed in this session)`);
            sendEvent?.('status', { message: `Skipping duplicate ${tc.name} call...` });
            textContent = cachedResult;
          } else {
            allToolCalls.push({ name: tc.name, args });
            if (!sendEvent('tool_use', { name: tc.name })) return;
            const inProcessResult = await this.runStreamingToolInProcess(
              tc.name,
              args,
              apiToken,
              sendEvent,
            );
            if (inProcessResult !== null) {
              this.logger.log(`Tool "${tc.name}" completed in-process.`);
              textContent = inProcessResult;
            } else {
              this.logger.log(
                `Calling MCP subprocess for tool: ${tc.name} (args: ${JSON.stringify(this.sanitizeArgsForLog(args))})`,
              );
              const result = await client.callTool({
                name: tc.name,
                arguments: args,
              });
              textContent =
                result.content
                  ?.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
                  .join('\n') ?? '';
              // Cache non-streaming tool results too
              this.cacheToolResult(cacheKey, textContent);
            }
          }
          openaiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: textContent,
          });
          if (textContent) {
            try {
              const parsed = JSON.parse(textContent) as unknown;
              const rows = this.extractTableRowsFromToolResult(parsed);
              if (rows.length > 0) {
                const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
                sendEvent('table_data', { columns, rows });
              }
            } catch {
              // ignore
            }
          }
        }
      }

      sendEvent('done', {
        text: finalText.join('\n').trim() || 'No response generated.',
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      });
    } finally {
      await client.close();
    }
  }
}
