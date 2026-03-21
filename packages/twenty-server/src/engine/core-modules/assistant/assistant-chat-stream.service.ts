import { Injectable } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Request, Response } from 'express';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import { AssistantThreadService } from './assistant-thread.service';
import {
    AssistantAgentEventRecord,
    AssistantChatRequestBody,
    AssistantStatusMessagePolicy,
    AssistantThreadMessage,
    AssistantThreadTableData,
    AssistantThreadTableReference,
    MessageParam,
} from './assistant.types';
import { McpAssistantService } from './mcp-assistant.service';
import { AutonomousRecruitmentAgentRulesService } from './recruitment-agent-rules.service';

import { normalizeAssistantConversationHistory } from './utils/assistant-conversation-history.utils';
import { summarizeMessageEvent } from './utils/assistant-message-event-summary.utils';

const TABLE_DATA_CACHE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const DEFAULT_STATUS_MESSAGE_POLICY: AssistantStatusMessagePolicy = {
  persistToThread: true,
  showInUi: true,
  includeInConversationHistory: true,
};

type TableRegistryEntry = {
  tableId: string;
  ref: string;
  tableType: string;
  label: string;
  columns: string[];
  count: number;
  createdAt: number;
  data: { columns: string[]; rows: Record<string, unknown>[] };
};

const mergeTableColumns = (
  currentColumns: string[],
  incomingColumns: string[],
): string[] => {
  const mergedColumns = [...currentColumns];

  for (const column of incomingColumns) {
    if (!mergedColumns.includes(column)) {
      mergedColumns.push(column);
    }
  }

  return mergedColumns;
};

@Injectable()
export class AssistantChatStreamService {
  constructor(
    private readonly mcpAssistantService: McpAssistantService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly autonomousRecruitmentAgentRulesService: AutonomousRecruitmentAgentRulesService,
    @InjectCacheStorage(CacheStorageNamespace.EngineCandidateSearch)
    private readonly tableDataCache: CacheStorageService,
  ) {}

  async executeChatStream(
    apiToken: string,
    body: AssistantChatRequestBody,
    req: Request,
    res: Response,
  ): Promise<void> {
    const { message, conversationHistory } = body ?? {};

    // eslint-disable-next-line no-console
    console.log('chatStream', body);
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Body must include a string "message"' });

      return;
    }

    const history = normalizeAssistantConversationHistory(
      conversationHistory,
    ) as MessageParam[];

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
    let statusMessagePolicy: AssistantStatusMessagePolicy =
      DEFAULT_STATUS_MESSAGE_POLICY;

    if (threadId) {
      try {
        const thread = await this.assistantThreadService.getThread(
          apiToken,
          threadId,
        );

        if (thread?.searchType) {
          threadSearchType = thread.searchType;
        }
        const rawStatusMessagePolicy =
          thread?.assistantParameters &&
          typeof thread.assistantParameters === 'object'
            ? (
                thread.assistantParameters as {
                  statusMessagePolicy?: Partial<AssistantStatusMessagePolicy>;
                }
              ).statusMessagePolicy
            : undefined;

        if (rawStatusMessagePolicy && typeof rawStatusMessagePolicy === 'object') {
          statusMessagePolicy = {
            persistToThread:
              rawStatusMessagePolicy.persistToThread ??
              DEFAULT_STATUS_MESSAGE_POLICY.persistToThread,
            showInUi:
              rawStatusMessagePolicy.showInUi ??
              DEFAULT_STATUS_MESSAGE_POLICY.showInUi,
            includeInConversationHistory:
              rawStatusMessagePolicy.includeInConversationHistory ??
              DEFAULT_STATUS_MESSAGE_POLICY.includeInConversationHistory,
          };
        }
      } catch {
        // best-effort; use default
      }
    }

    const tableRegistry: TableRegistryEntry[] = [];
    const persistedMessages: AssistantThreadMessage[] = [
      { role: 'user', content: message },
    ];
    const persistedAgentEvents: AssistantAgentEventRecord[] = [];

    let finalText = '';
    let finalToolCalls:
      | Array<{ name: string; args: Record<string, unknown> }>
      | undefined = undefined;
    let finalToolResults:
      | Array<{ content: string }>
      | undefined = undefined;

    const pushAssistantMessage = (
      content: string,
      options?: { isStatus?: boolean },
    ) => {
      const trimmed = content.trim();

      if (!trimmed) return;
      persistedMessages.push({
        role: 'assistant',
        content: trimmed,
        ...(options?.isStatus ? { isStatus: true } : {}),
      });
    };

    const pushAgentEvent = (event: AssistantAgentEventRecord) => {
      persistedAgentEvents.push(event);
    };

    const attachTableReferenceToLatestAssistantMessage = (
      ref: AssistantThreadTableReference,
    ) => {
      for (let i = persistedMessages.length - 1; i >= 0; i -= 1) {
        const msg = persistedMessages[i];

        if (msg.role !== 'assistant') continue;
        const tableReferences = msg.tableReferences ?? [];

        persistedMessages[i] = {
          ...msg,
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

    const upsertTableReferenceOnLatestAssistantMessage = (
      ref: AssistantThreadTableReference,
    ) => {
      for (let i = persistedMessages.length - 1; i >= 0; i -= 1) {
        const msg = persistedMessages[i];

        if (msg.role !== 'assistant') continue;

        const tableReferences = msg.tableReferences ?? [];
        const existingRefIndex = tableReferences.findIndex(
          (tableRef) => tableRef.tableId === ref.tableId,
        );

        if (existingRefIndex >= 0) {
          const nextRefs = [...tableReferences];

          nextRefs[existingRefIndex] = {
            ...nextRefs[existingRefIndex],
            ...ref,
          };

          persistedMessages[i] = {
            ...msg,
            tableReferences: nextRefs,
          };

          return;
        }

        persistedMessages[i] = {
          ...msg,
          tableReferences: [...tableReferences, ref],
        };

        return;
      }

      attachTableReferenceToLatestAssistantMessage(ref);
    };

    const sendEvent = (event: string, data: unknown): boolean => {
      if (isAborted || res.closed || res.destroyed) return false;
      const socket = req.socket ?? res.socket;

      if (socket && socket.destroyed) return false;
      try {
        let payload = data;

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
            const incomingColumns = d.columns as string[];
            const incomingRows = d.rows as Record<string, unknown>[];
            const tableType =
              typeof d.tableType === 'string' ? d.tableType : 'data';

            if (tableType === 'candidates') {
              const existingEntry = tableRegistry.find(
                (entry) => entry.tableType === 'candidates',
              );

              if (existingEntry) {
                existingEntry.data = {
                  columns: mergeTableColumns(
                    existingEntry.data.columns,
                    incomingColumns,
                  ),
                  rows: [...existingEntry.data.rows, ...incomingRows],
                };
                existingEntry.columns = existingEntry.data.columns;
                existingEntry.count = existingEntry.data.rows.length;
                existingEntry.label = `${existingEntry.count} candidate${
                  existingEntry.count !== 1 ? 's' : ''
                }`;
                existingEntry.createdAt = Date.now();

                upsertTableReferenceOnLatestAssistantMessage({
                  tableId: existingEntry.tableId,
                  ref: existingEntry.ref,
                  tableType: existingEntry.tableType,
                  label: existingEntry.label,
                  count: existingEntry.count,
                  columns: existingEntry.columns,
                  createdAt: existingEntry.createdAt,
                });

                payload = {
                  ...d,
                  tableId: existingEntry.tableId,
                  tableType: existingEntry.tableType,
                  label: existingEntry.label,
                  columns: existingEntry.columns,
                  rows: existingEntry.data.rows,
                };
              } else {
                const tableId =
                  typeof d.tableId === 'string' ? d.tableId : randomUUID();
                const ref = threadId
                  ? `thread:${threadId}:table:${tableId}`
                  : `table:${tableId}`;
                const label = `${incomingRows.length} candidate${
                  incomingRows.length !== 1 ? 's' : ''
                }`;
                const createdAt = Date.now();

                tableRegistry.push({
                  tableId,
                  ref,
                  tableType,
                  label,
                  columns: incomingColumns,
                  count: incomingRows.length,
                  createdAt,
                  data: {
                    columns: incomingColumns,
                    rows: incomingRows,
                  },
                });

                attachTableReferenceToLatestAssistantMessage({
                  tableId,
                  ref,
                  tableType,
                  label,
                  count: incomingRows.length,
                  columns: incomingColumns,
                  createdAt,
                });

                payload = {
                  ...d,
                  tableId,
                  tableType,
                  label,
                  columns: incomingColumns,
                  rows: incomingRows,
                };
              }
            }
          }
        }
        if (event === 'done' && typeof data === 'object' && data !== null) {
          payload = {
            ...(data as Record<string, unknown>),
            ...(finalToolResults?.length ? { toolResults: finalToolResults } : {}),
          };
        }

        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        if (
          event === 'table_data' &&
          typeof payload === 'object' &&
          payload !== null
        ) {
          const d = payload as {
            columns?: unknown;
            rows?: unknown;
            tableId?: unknown;
            tableType?: unknown;
            label?: unknown;
          };

          if (Array.isArray(d.columns) && Array.isArray(d.rows)) {
            const tableType =
              typeof d.tableType === 'string' ? d.tableType : 'data';

            if (
              tableType === 'candidates' &&
              tableRegistry.some(
                (entry) =>
                  entry.tableId === d.tableId &&
                  entry.tableType === tableType,
              )
            ) {
              return true;
            }

            const tableId =
              typeof d.tableId === 'string' ? d.tableId : randomUUID();
            const ref = threadId
              ? `thread:${threadId}:table:${tableId}`
              : `table:${tableId}`;

            tableRegistry.push({
              tableId,
              ref,
              tableType,
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
              tableType,
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

          if (
            statusMessagePolicy.persistToThread &&
            typeof d.message === 'string' &&
            d.message.trim()
          ) {
            pushAssistantMessage(d.message, { isStatus: true });
          }
        }
        if (event === 'tool_result' && typeof data === 'object' && data !== null) {
          const d = data as { content?: unknown };

          if (typeof d.content === 'string' && d.content.trim()) {
            finalToolResults = [...(finalToolResults ?? []), { content: d.content }];
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
          const d = data as {
            text?: unknown;
            toolCalls?: unknown;
            toolResults?: unknown;
          };

          if (typeof d.text === 'string') finalText = d.text;
          if (Array.isArray(d.toolCalls)) {
            finalToolCalls = d.toolCalls as Array<{
              name: string;
              args: Record<string, unknown>;
            }>;
          }
          if (Array.isArray(d.toolResults)) {
            finalToolResults = (d.toolResults as Array<{ content?: unknown }>)
              .filter(
                (toolResult): toolResult is { content: string } =>
                  typeof toolResult.content === 'string' &&
                  toolResult.content.trim().length > 0,
              )
              .map((toolResult) => ({ content: toolResult.content }));
          }
          if (
            finalText.trim() ||
            (finalToolCalls && finalToolCalls.length > 0)
          ) {
            pushAssistantMessage(finalText || 'Completed');
            const lastMessage = persistedMessages[persistedMessages.length - 1];

            if (lastMessage?.role === 'assistant') {
              lastMessage.toolCalls = finalToolCalls;
              lastMessage.toolResults = finalToolResults;
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
      const systemPrompt =
        await this.autonomousRecruitmentAgentRulesService.getSystemPrompt(
          apiToken,
        );

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

      if (threadId && !isAborted) {
        try {
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
                // eslint-disable-next-line no-console
                console.error('Failed to generate thread name:', nameErr);
              }
            }
          }

          if (tableRegistry.length > 0) {
            await Promise.all(
              tableRegistry.map((entry) =>
                this.tableDataCache.set(
                  entry.ref,
                  entry.data,
                  TABLE_DATA_CACHE_TTL_SECONDS,
                ),
              ),
            );
            const newMeta = tableRegistry.map(
              ({ data: _data, ...meta }) => meta,
            );
            let existingTables: typeof newMeta = [];

            try {
              const currentThread = await this.assistantThreadService.getThread(
                apiToken,
                threadId,
              );
              const currentRaw = currentThread?.lastTableData as
                | { tables?: typeof newMeta }
                | null
                | undefined;

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
              mergedRegistry as unknown as AssistantThreadTableData,
            );
          }
        } catch (persistErr) {
          // eslint-disable-next-line no-console
          console.error('Failed to persist thread data:', persistErr);
        }
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);

      if (
        !requestAbortController.signal.aborted &&
        !isAborted &&
        !res.closed &&
        !res.destroyed
      ) {
        sendEvent('error', { error: messageText });
      }
    } finally {
      res.end();
    }
  }
}
