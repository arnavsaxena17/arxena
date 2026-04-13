import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as path from 'path';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
  AssistantChatResponse,
  McpModelProvider,
  MessageParam,
  StreamEventSender,
} from './assistant.types';
import { McpAnthropicMessageProcessorService } from './mcp-anthropic-message-processor.service';
import { McpAssistantToolExecutorService } from './mcp-assistant-tool-executor.service';
import {
  CLAUDE_MODEL,
  INTERNAL_TOOL_NAMES,
  // MAX_TOKENS,
  MAX_TOOL_ROUNDS,
  OPENAI_MCP_MODEL,
} from './mcp-assistant.constants';
import { throwIfAborted } from './utils/mcp-assistant-abort.util';
import { sanitizeArgsForLog } from './utils/mcp-assistant-args.util';
import {
  extractLinkedInSearchErrorMessage,
  isLinkedInSearchError,
} from './utils/mcp-assistant-linkedin-error.util';
import { mcpToolsToOpenAITools } from './utils/mcp-assistant-openai-mapping.util';
import { getMcpModelProviderFromEnv } from './utils/mcp-assistant-provider.util';
import {
  emitStreamComplete,
  emitTableDataIfJson,
} from './utils/mcp-assistant-stream-events.util';
import { stripThreadNameQuotes } from './utils/mcp-assistant-thread-name.util';
import { withMcpClient } from './utils/mcp-client-session.util';
import {
  fetchAnthropicTools,
  fetchOpenAITools,
} from './utils/mcp-mcp-tools-format.util';
import { consumeOpenAIStream } from './utils/mcp-openai-stream.util';

@Injectable()
export class McpAssistantService {
  private readonly logger: Logger = new Logger(McpAssistantService.name);
  private readonly provider: McpModelProvider;
  private readonly anthropic: Anthropic;
  private readonly openai: OpenAI | null;
  private readonly serverBaseUrl: string;
  private readonly mcpServerScriptPath: string;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly toolExecutor: McpAssistantToolExecutorService,
    private readonly anthropicMessageProcessor: McpAnthropicMessageProcessorService,
  ) {
    this.provider = getMcpModelProviderFromEnv();
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const openaiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;
    this.openai =
      this.provider === 'openai' && openaiKey
        ? new OpenAI({ apiKey: openaiKey })
        : null;
    this.serverBaseUrl =
      process.env.SERVER_BASE_URL ??
      process.env.ARXENA_SITE_BASE_URL ??
      'http://localhost:3000';
    const packagesDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      '..',
    );
    this.mcpServerScriptPath =
      process.env.MCP_SERVER_SCRIPT_PATH ??
      path.join(packagesDir, 'twenty-mcp-server', 'dist', 'index.js');
  }

  private mcpSessionConfig(apiToken: string, workspaceMemberId?: string | null) {
    return {
      serverBaseUrl: this.serverBaseUrl,
      mcpServerScriptPath: this.mcpServerScriptPath,
      apiToken,
      workspaceMemberId,
    };
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
          // max_tokens: 50,
          temperature: 0.7,
        });
        const raw =
          response.choices[0]?.message?.content?.trim() ?? 'New thread';
        const name = stripThreadNameQuotes(raw);
        return name.length > 50
          ? name.substring(0, 47) + '...'
          : name || 'New thread';
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
        const name = stripThreadNameQuotes(raw);
        return name.length > 50
          ? name.substring(0, 47) + '...'
          : name || 'New thread';
      }
    } catch {
      const fallback =
        userMessage.length > 50
          ? userMessage.substring(0, 47) + '...'
          : userMessage;
      return stripThreadNameQuotes(fallback) || 'New thread';
    }
  }

  async listTools(
    apiToken: string,
  ): Promise<
    Array<{ name: string; description: string; input_schema: unknown }>
  > {
    const client = new Client({
      name: 'arxena-assistant-client',
      version: '1.0.0',
    });
    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);
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
      return this.processQueryWithOpenAI(
        query,
        apiToken,
        conversationHistory,
        systemPrompt,
      );
    }
    return this.processQueryWithAnthropic(
      query,
      apiToken,
      conversationHistory,
      systemPrompt,
    );
  }

  private async processQueryWithAnthropic(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    systemPrompt?: string,
  ): Promise<AssistantChatResponse> {
    const client = new Client({
      name: 'arxena-assistant-client',
      version: '1.0.0',
    });
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
      const availableTools = toolsResult.tools
        .map((t) => ({
          name: t.name,
          description: t.description ?? '',
          input_schema: {
            type: 'object' as const,
            ...(typeof t.inputSchema === 'object' && t.inputSchema !== null
              ? (t.inputSchema as Record<string, unknown>)
              : {}),
          },
        }))
        .filter(
          (t) => !INTERNAL_TOOL_NAMES.has(t.name),
        ) as Anthropic.Messages.Tool[];

      const messages: MessageParam[] = [
        ...conversationHistory,
        { role: 'user', content: query },
      ];

      let response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 50,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: messages as Anthropic.MessageParam[],
        tools: availableTools,
      });

      const finalText: string[] = [];
      const toolCalls: Array<{ name: string; args: Record<string, unknown> }> =
        [];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const assistantContent = response.content as Array<
          | { type: 'text'; text: string }
          | {
              type: 'tool_use';
              id: string;
              name: string;
              input: Record<string, unknown>;
            }
        >;

        let hasToolUse = false;
        const toolResults: Array<{
          type: 'tool_result';
          tool_use_id: string;
          content: string;
        }> = [];

        for (const block of assistantContent) {
          if (block.type === 'text') {
            finalText.push(block.text);
          }
          if (block.type === 'tool_use') {
            hasToolUse = true;
            toolCalls.push({ name: block.name, args: block.input ?? {} });
            this.logger.log(
              `[Non-streaming] Calling MCP subprocess for tool: ${block.name} (args: ${JSON.stringify(sanitizeArgsForLog(block.input ?? {}))})`,
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
          max_tokens: 50,
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
      throw new Error(
        'OpenAI client not configured. Set MCP_MODEL_PROVIDER=openai and OPENAI_API_KEY.',
      );
    }
    const client = new Client({
      name: 'arxena-assistant-client',
      version: '1.0.0',
    });
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
      const openaiTools = mcpToolsToOpenAITools(
        toolsResult.tools
          .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name))
          .map((t) => ({
            name: t.name,
            description: t.description ?? '',
            input_schema: t.inputSchema,
          })),
      );

      let openaiMessages =
        await this.toolExecutor.historyToOpenAIMessagesWithExecutedTools(
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
      const toolCalls: Array<{ name: string; args: Record<string, unknown> }> =
        [];
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds += 1;
        const response = await this.openai.chat.completions.create({
          model: process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL,
          // max_tokens: MAX_TOKENS,
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
              return (JSON.parse(tc.function.arguments ?? '{}') ??
                {}) as Record<string, unknown>;
            } catch {
              return {};
            }
          })();
          toolCalls.push({ name: tc.function.name, args });
          this.logger.log(
            `[Non-streaming] Calling MCP subprocess for tool: ${tc.function.name} (args: ${JSON.stringify(sanitizeArgsForLog(args))})`,
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
      throw new Error(
        'OpenAI client not configured. Set MCP_MODEL_PROVIDER=openai and OPENAI_API_KEY.',
      );
    }

    const model =
      options?.model ?? process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL;
    const maxTokens = options?.maxTokens ?? 2000;

    return withMcpClient(
      this.mcpSessionConfig(apiToken),
      undefined,
      async (client) => {
        const toolsResult = await client.listTools();
        const allTools = mcpToolsToOpenAITools(
          toolsResult.tools.map((t) => ({
            name: t.name,
            description: t.description ?? '',
            input_schema: t.inputSchema,
          })),
        );

        const tools =
          options?.allowedToolNames && options.allowedToolNames.length > 0
            ? allTools.filter(
                (t) =>
                  t.type === 'function' &&
                  options.allowedToolNames!.includes(t.function.name),
              )
            : allTools.filter(
                (t) =>
                  t.type === 'function' &&
                  !INTERNAL_TOOL_NAMES.has(t.function.name),
              );

        let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        for (;;) {
          const completion = await this.openai!.chat.completions.create({
            model,
            messages,
            // max_tokens: maxTokens,
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
                return JSON.parse(toolCall.function.arguments || '{}') as Record<
                  string,
                  unknown
                >;
              } catch {
                return {};
              }
            })();

            this.logger.log(
              `[JobBrief] Calling MCP subprocess for tool: ${toolName} (args: ${JSON.stringify(
                sanitizeArgsForLog(toolArgs),
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
      },
    );
  }

  async processQueryStream(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
    options?: {
      assistantThreadId?: string;
      searchType?: 'classic' | 'sales_navigator' | 'recruiter';
      abortSignal?: AbortSignal;
    },
  ): Promise<void> {
    const assistantThreadId = options?.assistantThreadId;
    const threadSearchType = options?.searchType;
    const abortSignal = options?.abortSignal;
    if (this.provider === 'openai' && this.openai) {
      await this.processQueryStreamWithOpenAI(
        query,
        apiToken,
        conversationHistory,
        sendEvent,
        systemPrompt,
        assistantThreadId,
        threadSearchType,
        abortSignal,
      );
      return;
    }
    await this.processQueryStreamWithAnthropic(
      query,
      apiToken,
      conversationHistory,
      sendEvent,
      systemPrompt,
      assistantThreadId,
      threadSearchType,
      abortSignal,
    );
  }

  private async processQueryStreamWithAnthropic(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
    assistantThreadId?: string,
    threadSearchType?: 'classic' | 'sales_navigator' | 'recruiter',
    abortSignal?: AbortSignal,
  ): Promise<void> {
    await withMcpClient(
      this.mcpSessionConfig(apiToken),
      abortSignal,
      async (client) => {
        const availableTools = await fetchAnthropicTools(client);
        const messages: MessageParam[] = [
          ...conversationHistory,
          { role: 'user', content: query },
        ];
        const finalText: string[] = [];
        const allToolCalls: Array<{
          name: string;
          args: Record<string, unknown>;
        }> = [];
        let rounds = 0;

        while (rounds < MAX_TOOL_ROUNDS) {
          throwIfAborted(abortSignal);
          rounds += 1;
          const assistantContent =
            await this.anthropicMessageProcessor.streamAnthropicRound(
              this.anthropic,
              messages,
              availableTools,
              systemPrompt,
              sendEvent,
              abortSignal,
            );
          const { toolResults, textParts, linkedInSearchError } =
            await this.anthropicMessageProcessor.processAnthropicAssistantContent(
              assistantContent,
              client,
              apiToken,
              sendEvent,
              allToolCalls,
              assistantThreadId,
              threadSearchType,
              abortSignal,
            );
          finalText.push(...textParts);
          if (linkedInSearchError) {
            sendEvent('error', { error: linkedInSearchError });
            emitStreamComplete(sendEvent, linkedInSearchError, allToolCalls);
            return;
          }
          const hasToolUse = toolResults.length > 0;
          if (!hasToolUse) break;

          messages.push({ role: 'assistant', content: assistantContent });
          messages.push({ role: 'user', content: toolResults });
        }

        const fullText = finalText.join('\n').trim() || 'No response generated.';
        emitStreamComplete(sendEvent, fullText, allToolCalls);
      },
    );
  }

  private async processQueryStreamWithOpenAI(
    query: string,
    apiToken: string,
    conversationHistory: MessageParam[] = [],
    sendEvent: StreamEventSender,
    systemPrompt?: string,
    assistantThreadId?: string,
    threadSearchType?: 'classic' | 'sales_navigator' | 'recruiter',
    abortSignal?: AbortSignal,
  ): Promise<void> {
    if (!this.openai) {
      sendEvent('error', {
        error:
          'OpenAI client not configured. Set MCP_MODEL_PROVIDER=openai and OPENAI_API_KEY.',
      });
      sendEvent('done', { text: '', toolCalls: undefined });
      return;
    }

    this.logger.log(`MCP Client System Prompt:, ${systemPrompt}`);
    await withMcpClient(
      this.mcpSessionConfig(apiToken),
      abortSignal,
      async (client) => {
        const openaiTools = await fetchOpenAITools(client);
        let openaiMessages =
          await this.toolExecutor.historyToOpenAIMessagesWithExecutedTools(
            conversationHistory,
            query,
            {
              client,
              apiToken,
              systemPrompt,
              assistantThreadId,
              searchType: threadSearchType,
              sendEvent: () => true,
            },
          );
        this.logger.log(
          `MCP Client openaiMessages:, ${JSON.stringify(openaiMessages, null, 2)}`,
        );
        const finalText: string[] = [];
        const allToolCalls: Array<{
          name: string;
          args: Record<string, unknown>;
        }> = [];
        let rounds = 0;
        while (rounds < MAX_TOOL_ROUNDS) {
          throwIfAborted(abortSignal);
          rounds += 1;
          const stream = await this.openai!.chat.completions.create(
            {
              model: process.env.MCP_OPENAI_MODEL ?? OPENAI_MCP_MODEL,
              // max_tokens: MAX_TOKENS,
              messages: openaiMessages,
              tools: openaiTools,
              stream: true,
            },
            abortSignal ? { signal: abortSignal } : undefined,
          );
          const { content, toolCallsList } = await consumeOpenAIStream(
            stream,
            sendEvent,
          );
          if (content) finalText.push(content);
          if (toolCallsList.length === 0) break;

          const assistantMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam =
            {
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
                return (JSON.parse(tc.args || '{}') ?? {}) as Record<
                  string,
                  unknown
                >;
              } catch {
                return {};
              }
            })();
            sendEvent('tool_use', { name: tc.name });
            const { textContent, fromCache } =
              await this.toolExecutor.executeToolAndGetResult(
                client,
                tc.name,
                args,
                apiToken,
                sendEvent,
                assistantThreadId,
                threadSearchType,
                abortSignal,
              );
            if (!fromCache) allToolCalls.push({ name: tc.name, args });
            sendEvent('tool_result', { name: tc.name, content: textContent });
            openaiMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: textContent,
            });
            emitTableDataIfJson(sendEvent, textContent, tc.name);
            if (isLinkedInSearchError(tc.name, textContent)) {
              const linkedInSearchError = extractLinkedInSearchErrorMessage(
                textContent,
              );
              const userMessage = `LinkedIn search failed: ${linkedInSearchError}`;
              this.logger.warn(
                `[McpAssistantService] LinkedIn search tool "${tc.name}" failed; breaking flow.`,
              );
              sendEvent('error', { error: userMessage });
              emitStreamComplete(sendEvent, userMessage, allToolCalls);
              return;
            }
          }
        }

        const fullText = finalText.join('\n').trim() || 'No response generated.';
        this.logger.log(
          `[OpenAI stream] fullText length=${fullText.length}, preview=${fullText.slice(0, 200)}`,
        );
        emitStreamComplete(sendEvent, fullText, allToolCalls);
      },
    );
  }
}
