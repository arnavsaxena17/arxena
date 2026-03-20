import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { AssistantThreadService } from './assistant-thread.service';
import {
  AssistantAgentEventRecord,
  AssistantChatRequestBody,
  AssistantContentBlock,
  AssistantThreadMessage,
  AssistantThreadTableReference,
} from './assistant.types';
import { McpAssistantService } from './mcp-assistant.service';
import { AutonomousRecruitmentAgentRulesService } from './recruitment-agent-rules.service';

const TABLE_DATA_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const summarizeObjectEntries = (
  obj: Record<string, unknown>,
  preferredKeys: string[],
) => {
  const parts = preferredKeys
    .map((key) => {
      const value = obj[key];
      if (value == null) return null;
      if (Array.isArray(value)) {
        return value.length > 0 ? `${key}: ${value.join(', ')}` : null;
      }
      if (typeof value === 'string' || typeof value === 'number') {
        return `${key}: ${value}`;
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));

  return parts.slice(0, 3).join(' | ');
};

const summarizeMessageEvent = (
  eventType: string,
  payload: Record<string, unknown>,
): string | null => {
  const chatMessage =
    typeof payload.chatMessage === 'string' ? payload.chatMessage.trim() : '';
  if (chatMessage) return chatMessage;

  const data =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null;

  if (!data) {
    return eventType ? eventType.replace(/_/g, ' ') : null;
  }

  if (eventType === 'parsed_requirement') {
    const details = summarizeObjectEntries(data, [
      'position_title',
      'original_requirement',
      'query_type_description',
    ]);
    return details ? `Parsed requirement: ${details}` : 'Parsed requirement';
  }

  if (eventType === 'primary_query') {
    const query =
      data.query && typeof data.query === 'object'
        ? (data.query as Record<string, unknown>)
        : null;
    const details = query
      ? summarizeObjectEntries(query, ['job_title', 'keywords', 'location'])
      : summarizeObjectEntries(data, ['recommended_strategy', 'splitting_reason']);
    return details ? `Built primary query: ${details}` : 'Built primary query';
  }

  if (eventType === 'query_set' || eventType === 'splitting_strategy') {
    const count =
      typeof data.total_queries === 'number'
        ? data.total_queries
        : typeof data.query_count === 'number'
          ? data.query_count
          : Array.isArray(data.queries)
            ? data.queries.length
            : Array.isArray(data.query_set)
              ? data.query_set.length
              : null;
    return count != null
      ? `Generated ${count} search quer${count === 1 ? 'y' : 'ies'}`
      : 'Generated search queries';
  }

  if (eventType === 'unresolved_search_parameters') {
    return 'Produced unresolved search parameters';
  }

  if (eventType === 'orchestrator_result') {
    return 'Prepared orchestrated search strategy';
  }

  if (eventType === 'master_lists') {
    return 'Generated master lists';
  }

  const count =
    typeof data.count === 'number'
      ? data.count
      : typeof data.totalCount === 'number'
        ? data.totalCount
        : typeof data.total === 'number'
          ? data.total
          : null;
  if (count != null) {
    return `${eventType.replace(/_/g, ' ')}: ${count} item${count === 1 ? '' : 's'}`;
  }

  const genericDetails = summarizeObjectEntries(data, [
    'label',
    'query_type_description',
    'recommended_strategy',
  ]);

  return genericDetails
    ? `${eventType.replace(/_/g, ' ')}: ${genericDetails}`
    : eventType.replace(/_/g, ' ');
};

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly mcpAssistantService: McpAssistantService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly autonomousRecruitmentAgentRulesService: AutonomousRecruitmentAgentRulesService,
    @InjectCacheStorage(CacheStorageNamespace.EngineCandidateSearch)
    private readonly tableDataCache: CacheStorageService,
  ) {}

  @Get('threads')
  @UseGuards(JwtAuthGuard)
  async listThreads(@Req() request: { headers: { authorization?: string } }) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    try {
      const threads = await this.assistantThreadService.listThreads(apiToken);
      return { threads };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message, threads: [] };
    }
  }

  @Post('threads')
  @UseGuards(JwtAuthGuard)
  async createThread(
    @Req()
    request: {
      headers: { authorization?: string };
      body?: {
        name?: string;
        jobId?: string;
        assistantMode?: 'fully_autonomous' | 'permissioned';
        searchType?: 'classic' | 'sales_navigator' | 'recruiter';
      };
    },
  ) {
    const authHeader = request.headers.authorization;
    console.log('createThread', request.body);
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    try {
      const name = request.body?.name ?? 'New thread';
      const jobId = request.body?.jobId;
      const assistantMode = request.body?.assistantMode;
      const searchType = request.body?.searchType;
      const thread = await this.assistantThreadService.createThread(
        apiToken,
        name,
        jobId,
        assistantMode,
        searchType,
      );
      console.log('thread that we got ', thread);
      return thread;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  @Get('threads/:id')
  @UseGuards(JwtAuthGuard)
  async getThread(
    @Param('id') id: string,
    @Req() request: { headers: { authorization?: string } },
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    try {
      const thread = await this.assistantThreadService.getThread(apiToken, id);
      if (!thread) return { error: 'Thread not found' };

      // Resolve lastTableData from whichever storage format is present:
      //   - New: { tables: [{ ref, tableType, ... }] } → resolve the most recent entry from Redis
      //   - Legacy cacheRef: { cacheRef: 'key' } → resolve directly from Redis
      //   - Legacy inline: { columns, rows } → use as-is
      let lastTableData = thread.lastTableData ?? null;
      const raw = lastTableData as any;
      if (raw?.tables && Array.isArray(raw.tables) && raw.tables.length > 0) {
        const lastEntry = raw.tables[raw.tables.length - 1];
        const cached = await this.tableDataCache.get<{
          columns: string[];
          rows: Record<string, unknown>[];
        }>(lastEntry.ref);
        lastTableData = cached
          ? ({
              ...cached,
              tableId: lastEntry.tableId,
              tableType: lastEntry.tableType,
              label: lastEntry.label,
            } as any)
          : null;
      } else if (raw?.cacheRef && typeof raw.cacheRef === 'string') {
        const cached = await this.tableDataCache.get<{
          columns: string[];
          rows: Record<string, unknown>[];
        }>(raw.cacheRef);
        lastTableData = cached ?? null;
      }

      return {
        id: thread.id,
        name: thread.name,
        messages: thread.messages,
        lastTableData,
        jobId: thread.jobId ?? null,
        job: thread.job ?? null,
        agentNotes: thread.agentNotes ?? [],
        agentEvents: thread.agentEvents ?? [],
        assistantMode: thread.assistantMode ?? 'permissioned',
        searchType: thread.searchType ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  @Patch('threads/:id')
  @UseGuards(JwtAuthGuard)
  async updateThread(
    @Param('id') id: string,
    @Req()
    request: {
      headers: { authorization?: string };
      body?: {
        name?: string;
        jobId?: string | null;
        assistantMode?: 'fully_autonomous' | 'permissioned';
        searchType?: 'classic' | 'sales_navigator' | 'recruiter';
      };
    },
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    const body = request.body ?? {};
    const name = body.name;
    const jobId = body.jobId;
    const assistantMode = body.assistantMode;
    const searchType = body.searchType;

    try {
      if (typeof name === 'string') {
        await this.assistantThreadService.updateThreadName(apiToken, id, name);
      }
      if (jobId !== undefined) {
        await this.assistantThreadService.updateThreadJobId(
          apiToken,
          id,
          jobId === null || jobId === '' ? null : jobId,
        );
      }
      if (
        assistantMode === 'fully_autonomous' ||
        assistantMode === 'permissioned'
      ) {
        await this.assistantThreadService.updateThreadAssistantMode(
          apiToken,
          id,
          assistantMode,
        );
      }
      if (
        searchType === 'classic' ||
        searchType === 'sales_navigator' ||
        searchType === 'recruiter'
      ) {
        await this.assistantThreadService.updateThreadSearchType(
          apiToken,
          id,
          searchType,
        );
      }
      const hasValidUpdate =
        typeof name === 'string' ||
        jobId !== undefined ||
        assistantMode === 'fully_autonomous' ||
        assistantMode === 'permissioned' ||
        searchType === 'classic' ||
        searchType === 'sales_navigator' ||
        searchType === 'recruiter';
      if (!hasValidUpdate) {
        return {
          error:
            'Body must include at least one of "name", "jobId", "searchType", or a valid "assistantMode"',
        };
      }
      const thread = await this.assistantThreadService.getThread(apiToken, id);
      return {
        id,
        name: thread?.name ?? name,
        jobId: thread?.jobId ?? (jobId !== undefined ? jobId : undefined),
        assistantMode: thread?.assistantMode ?? assistantMode,
        searchType: thread?.searchType ?? searchType,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  @Get('threads/:id/tables/:tableId')
  @UseGuards(JwtAuthGuard)
  async getThreadTable(
    @Param('id') threadId: string,
    @Param('tableId') tableId: string,
    @Req() request: { headers: { authorization?: string } },
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    try {
      const ref = `thread:${threadId}:table:${tableId}`;
      const cached = await this.tableDataCache.get<{
        columns: string[];
        rows: Record<string, unknown>[];
      }>(ref);
      if (!cached) return { error: 'Table not found or expired' };
      return { columns: cached.columns, rows: cached.rows, tableId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  @Delete('threads/:id')
  @UseGuards(JwtAuthGuard)
  async deleteThread(
    @Param('id') id: string,
    @Req() request: { headers: { authorization?: string } },
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }

    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    try {
      await this.assistantThreadService.deleteThread(apiToken, id);
      return { id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  @Get('tools')
  @UseGuards(JwtAuthGuard)
  async listTools(@Req() request: { headers: { authorization?: string } }) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    const tools = await this.mcpAssistantService.listTools(apiToken);
    return { tools };
  }

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(
    @Req()
    request: {
      headers: { authorization?: string };
      body: AssistantChatRequestBody;
    },
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    const { message, conversationHistory } = request.body ?? {};
    if (!message || typeof message !== 'string') {
      return { error: 'Body must include a string "message"' };
    }
    const history = (conversationHistory ?? []).map(
      (
        m,
      ):
        | { role: 'user'; content: string }
        | { role: 'assistant'; content: AssistantContentBlock[] } => {
        if (m.role === 'user') {
          return {
            role: 'user',
            content:
              typeof m.content === 'string'
                ? m.content
                : JSON.stringify(m.content),
          };
        }
        const content: AssistantContentBlock[] = Array.isArray(m.content)
          ? (m.content as AssistantContentBlock[])
          : [{ type: 'text', text: String(m.content) }];
        return { role: 'assistant', content };
      },
    );

    const systemPrompt =
      await this.autonomousRecruitmentAgentRulesService.getSystemPrompt(
        apiToken,
      );

    const result = await this.mcpAssistantService.processQuery(
      message,
      apiToken,
      history,
      systemPrompt,
    );

    // Persist user + assistant messages (including final toolCalls) when a threadId is provided.
    const threadId = request.body.threadId;
    if (threadId) {
      try {
        await this.assistantThreadService.appendMessage(
          apiToken,
          threadId,
          'user',
          message,
        );
        if (result.text || result.toolCalls) {
          await this.assistantThreadService.appendMessage(
            apiToken,
            threadId,
            'assistant',
            result.text ?? '',
            result.toolCalls,
          );
        }
      } catch (persistErr) {
        // Best-effort persistence; log and continue returning the response.
        // eslint-disable-next-line no-console
        console.error(
          'Failed to persist non-stream chat messages:',
          persistErr,
        );
      }
    }

    return result;
  }

  @Post('chat/stream')
  @UseGuards(JwtAuthGuard)
  async chatStream(
    @Body() body: AssistantChatRequestBody,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    const { message, conversationHistory } = body ?? {};
    console.log('chatStream', body);
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Body must include a string "message"' });
      return;
    }

    const history = (conversationHistory ?? []).map(
      (
        m,
      ):
        | { role: 'user'; content: string }
        | { role: 'assistant'; content: AssistantContentBlock[] } => {
        if (m.role === 'user') {
          return {
            role: 'user',
            content:
              typeof m.content === 'string'
                ? m.content
                : JSON.stringify(m.content),
          };
        }
        const content: AssistantContentBlock[] = Array.isArray(m.content)
          ? (m.content as AssistantContentBlock[])
          : [{ type: 'text', text: String(m.content) }];
        return { role: 'assistant', content };
      },
    );

    let isAborted = false;
    const requestAbortController = new AbortController();
    const abortHandler = () => {
      isAborted = true;
      if (!requestAbortController.signal.aborted) {
        requestAbortController.abort();
      }
    };
    res.on('close', abortHandler);
    req.on('close', abortHandler);
    req.on('aborted', abortHandler);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const threadId = body.threadId;
    let threadSearchType: 'classic' | 'sales_navigator' | 'recruiter' =
      'recruiter';
    if (threadId) {
      try {
        const thread = await this.assistantThreadService.getThread(
          apiToken,
          threadId,
        );
        if (thread?.searchType) {
          threadSearchType = thread.searchType;
        }
      } catch {
        // best-effort; use default
      }
    }

    // Registry of all tables emitted during this stream; each entry holds its full data
    // until the stream ends, then data is flushed to Redis and only metadata kept.
    type TableEntry = {
      tableId: string;
      ref: string;
      tableType: string;
      label: string;
      columns: string[];
      count: number;
      createdAt: number;
      data: { columns: string[]; rows: Record<string, unknown>[] };
    };
    const tableRegistry: TableEntry[] = [];
    const persistedMessages: AssistantThreadMessage[] = [
      { role: 'user', content: message },
    ];
    const persistedAgentEvents: AssistantAgentEventRecord[] = [];

    let finalText = '';
    let finalToolCalls:
      | Array<{ name: string; args: Record<string, unknown> }>
      | undefined = undefined;

    const pushAssistantMessage = (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      persistedMessages.push({
        role: 'assistant',
        content: trimmed,
      });
    };

    const pushAgentEvent = (event: AssistantAgentEventRecord) => {
      persistedAgentEvents.push(event);
    };

    const attachTableReferenceToLatestAssistantMessage = (
      ref: AssistantThreadTableReference,
    ) => {
      for (let i = persistedMessages.length - 1; i >= 0; i -= 1) {
        const message = persistedMessages[i];
        if (message.role !== 'assistant') continue;
        const tableReferences = message.tableReferences ?? [];
        persistedMessages[i] = {
          ...message,
          tableReferences: [...tableReferences, ref],
        };
        return;
      }

      persistedMessages.push({
        role: 'assistant',
        content: ref.label ?? 'Generated results table',
        tableReferences: [ref],
      });
    };

    const sendEvent = (event: string, data: unknown): boolean => {
      if (isAborted || res.closed || res.destroyed) return false;
      const socket = req.socket ?? res.socket;
      if (socket && socket.destroyed) return false;
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        // Collect each table_data emission into the registry
        if (
          event === 'table_data' &&
          typeof data === 'object' &&
          data !== null
        ) {
          const d = data as {
            columns?: unknown;
            rows?: unknown;
            tableId?: unknown;
            tableType?: unknown;
            label?: unknown;
          };
          if (Array.isArray(d.columns) && Array.isArray(d.rows)) {
            const tableId =
              typeof d.tableId === 'string' ? d.tableId : crypto.randomUUID();
            const ref = threadId
              ? `thread:${threadId}:table:${tableId}`
              : `table:${tableId}`;
            tableRegistry.push({
              tableId,
              ref,
              tableType: typeof d.tableType === 'string' ? d.tableType : 'data',
              label:
                typeof d.label === 'string'
                  ? d.label
                  : `${(d.rows as unknown[]).length} results`,
              columns: d.columns as string[],
              count: (d.rows as unknown[]).length,
              createdAt: Date.now(),
              data: {
                columns: d.columns as string[],
                rows: d.rows as Record<string, unknown>[],
              },
            });
            attachTableReferenceToLatestAssistantMessage({
              tableId,
              ref,
              tableType: typeof d.tableType === 'string' ? d.tableType : 'data',
              label:
                typeof d.label === 'string'
                  ? d.label
                  : `${(d.rows as unknown[]).length} results`,
              count: (d.rows as unknown[]).length,
              columns: d.columns as string[],
              createdAt: Date.now(),
            });
          }
        }
        if (event === 'tool_use' && typeof data === 'object' && data !== null) {
          const d = data as { name?: unknown };
          if (typeof d.name === 'string' && d.name.trim()) {
            pushAssistantMessage(`Using: ${d.name}`);
            pushAgentEvent({
              status: 'tool_call',
              threadId,
              toolName: d.name,
              summary: `Calling ${d.name}`,
              timestamp: Date.now(),
            });
          }
        }
        if (event === 'status' && typeof data === 'object' && data !== null) {
          const d = data as { message?: unknown };
          if (typeof d.message === 'string' && d.message.trim()) {
            pushAssistantMessage(d.message);
          }
        }
        if (event === 'message' && typeof data === 'object' && data !== null) {
          const summary = summarizeMessageEvent(
            typeof (data as { type?: unknown }).type === 'string'
              ? ((data as { type: string }).type as string)
              : '',
            data as Record<string, unknown>,
          );
          if (summary) {
            pushAssistantMessage(summary);
          }
        }
        if (
          event === 'error' &&
          typeof data === 'object' &&
          data !== null &&
          typeof (data as { error?: unknown }).error === 'string'
        ) {
          pushAgentEvent({
            status: 'error',
            threadId,
            error: (data as { error: string }).error,
            summary: 'Assistant run failed',
            timestamp: Date.now(),
          });
        }
        if (event === 'done' && typeof data === 'object' && data !== null) {
          const d = data as { text?: unknown; toolCalls?: unknown };
          if (typeof d.text === 'string') finalText = d.text;
          if (Array.isArray(d.toolCalls)) {
            finalToolCalls = d.toolCalls as Array<{
              name: string;
              args: Record<string, unknown>;
            }>;
          }
          if (finalText.trim() || (finalToolCalls && finalToolCalls.length > 0)) {
            pushAssistantMessage(finalText || 'Completed');
            const lastMessage = persistedMessages[persistedMessages.length - 1];
            if (lastMessage?.role === 'assistant') {
              lastMessage.toolCalls = finalToolCalls;
            }
          }
          pushAgentEvent({
            status: 'completed',
            threadId,
            summary:
              finalToolCalls && finalToolCalls.length > 0
                ? `Completed with tools: ${finalToolCalls.map((toolCall) => toolCall.name).join(', ')}`
                : 'Assistant run completed',
            timestamp: Date.now(),
          });
        }
        return true;
      } catch {
        isAborted = true;
        return false;
      }
    };

    try {
      let systemPrompt =
        await this.autonomousRecruitmentAgentRulesService.getSystemPrompt(
          apiToken,
        );
      // if (threadId) {
      //   systemPrompt += `\n\n**Current thread**\nThe system will inject assistantThreadId into tool calls for this conversation. When you call create_job, job_brief_understanding, generate_unresolved_search_parameters, or other tools that accept assistantThreadId, the value will be provided automatically; you may omit it from your arguments.`;
      // }
      await this.mcpAssistantService.processQueryStream(
        message,
        apiToken,
        history,
        sendEvent,
        systemPrompt,
        {
          ...(threadId
            ? { assistantThreadId: threadId, searchType: threadSearchType }
            : {}),
          abortSignal: requestAbortController.signal,
        },
      );

      // Persist messages and table data if threadId is provided
      if (threadId && !isAborted) {
        try {
          // Get thread to check first exchange and message count for naming
          const thread = await this.assistantThreadService.getThread(
            apiToken,
            threadId,
          );
          const messageCountBeforeTurn = thread?.messages.length ?? 0;
          const isFirstExchange = messageCountBeforeTurn === 0;
          const messageCountAfterTurn =
            messageCountBeforeTurn + persistedMessages.length;
          const shouldRegenerateName =
            isFirstExchange ||
            (messageCountAfterTurn >= 4 && messageCountAfterTurn % 4 === 0);

          await this.assistantThreadService.appendMessages(
            apiToken,
            threadId,
            persistedMessages,
          );

          if (persistedAgentEvents.length > 0) {
            await this.assistantThreadService.appendAgentEvents(
              apiToken,
              threadId,
              persistedAgentEvents,
            );
          }

          if (finalText || finalToolCalls) {
            // Generate thread name: after first response and again every ~4 messages (4, 8, 12, ...)
            if (finalText && shouldRegenerateName) {
              try {
                const generatedName =
                  await this.mcpAssistantService.generateThreadName(
                    message,
                    finalText,
                  );
                await this.assistantThreadService.updateThreadName(
                  apiToken,
                  threadId,
                  generatedName,
                );
                sendEvent('thread_name', { name: generatedName });
              } catch (nameErr) {
                console.error('Failed to generate thread name:', nameErr);
              }
            }
          }

          if (tableRegistry.length > 0) {
            // Persist each table's rows to Redis under its own unique key.
            await Promise.all(
              tableRegistry.map((entry) =>
                this.tableDataCache.set(
                  entry.ref,
                  entry.data,
                  TABLE_DATA_CACHE_TTL_SECONDS,
                ),
              ),
            );
            // Merge new tables into any existing metadata registry on the thread,
            // so that multiple searches/sessions accumulate rather than overwrite.
            const newMeta = tableRegistry.map(
              ({ data: _data, ...meta }) => meta,
            );
            let existingTables: typeof newMeta = [];
            try {
              const currentThread = await this.assistantThreadService.getThread(
                apiToken,
                threadId,
              );
              const currentRaw = currentThread?.lastTableData as any;
              if (currentRaw?.tables && Array.isArray(currentRaw.tables)) {
                existingTables = currentRaw.tables;
              }
            } catch {
              // best-effort; proceed with new tables only
            }
            const mergedRegistry = { tables: [...existingTables, ...newMeta] };
            await this.assistantThreadService.setThreadTableData(
              apiToken,
              threadId,
              mergedRegistry as any,
            );
          }
        } catch (persistErr) {
          // Log but don't fail the request - persistence is best effort
          console.error('Failed to persist thread data:', persistErr);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        !requestAbortController.signal.aborted &&
        !isAborted &&
        !res.closed &&
        !res.destroyed
      ) {
        sendEvent('error', { error: message });
      }
    } finally {
      res.end();
    }
  }
}
