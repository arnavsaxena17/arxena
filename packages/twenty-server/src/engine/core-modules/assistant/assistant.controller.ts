import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { AssistantThreadService } from './assistant-thread.service';
import {
  AssistantChatRequestBody,
  AssistantContentBlock,
} from './assistant.types';
import { McpAssistantService } from './mcp-assistant.service';
import { AutonomousRecruitmentAgentRulesService } from './recruitment-agent-rules.service';

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly mcpAssistantService: McpAssistantService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly autonomousRecruitmentAgentRulesService: AutonomousRecruitmentAgentRulesService,
  ) {}

  @Get('threads')
  @UseGuards(JwtAuthGuard)
  async listThreads(@Req() request: { headers: { authorization?: string } }) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return { error: 'Missing or invalid Authorization header' };
    }
    console.log('listThreads');
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    try {
      const threads = await this.assistantThreadService.listThreads(apiToken);
      console.log('threads', threads);
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
      body?: { name?: string; jobId?: string; assistantMode?: 'fully_autonomous' | 'permissioned' };
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
      const thread = await this.assistantThreadService.createThread(
        apiToken,
        name,
        jobId,
        assistantMode,
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
      return {
        id: thread.id,
        name: thread.name,
        messages: thread.messages,
        lastTableData: thread.lastTableData ?? null,
        jobId: thread.jobId ?? null,
        job: thread.job ?? null,
        assistantMode: thread.assistantMode ?? 'permissioned',
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
      if (assistantMode === 'fully_autonomous' || assistantMode === 'permissioned') {
        await this.assistantThreadService.updateThreadAssistantMode(
          apiToken,
          id,
          assistantMode,
        );
      }
      if (
        typeof name !== 'string' &&
        jobId === undefined &&
        assistantMode !== 'fully_autonomous' &&
        assistantMode !== 'permissioned'
      ) {
        return {
          error:
            'Body must include at least one of "name", "jobId", or a valid "assistantMode"',
        };
      }
      const thread = await this.assistantThreadService.getThread(apiToken, id);
      return {
        id,
        name: thread?.name ?? name,
        jobId: thread?.jobId ?? (jobId !== undefined ? jobId : undefined),
        assistantMode: thread?.assistantMode ?? assistantMode,
      };
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
    @Req() request: { headers: { authorization?: string }; body: AssistantChatRequestBody },
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
        console.error('Failed to persist non-stream chat messages:', persistErr);
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
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
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
    const abortHandler = () => {
      isAborted = true;
    };
    res.on('close', abortHandler);
    req.on('close', abortHandler);
    req.on('aborted', abortHandler);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const threadId = body.threadId;
    let lastTableData: { columns: string[]; rows: Record<string, unknown>[] } | null = null;
    let finalText = '';
    let finalToolCalls: Array<{ name: string; args: Record<string, unknown> }> | undefined = undefined;

    const sendEvent = (event: string, data: unknown): boolean => {
      if (isAborted || res.closed || res.destroyed) return false;
      const socket = req.socket ?? res.socket;
      if (socket && socket.destroyed) return false;
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        // Track table data and final response for persistence
        if (event === 'table_data' && typeof data === 'object' && data !== null) {
          const d = data as { columns?: unknown; rows?: unknown };
          if (Array.isArray(d.columns) && Array.isArray(d.rows)) {
            lastTableData = {
              columns: d.columns as string[],
              rows: d.rows as Record<string, unknown>[],
            };
          }
        }
        if (event === 'done' && typeof data === 'object' && data !== null) {
          const d = data as { text?: unknown; toolCalls?: unknown };
          if (typeof d.text === 'string') finalText = d.text;
          if (Array.isArray(d.toolCalls)) {
            finalToolCalls = d.toolCalls as Array<{ name: string; args: Record<string, unknown> }>;
          }
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
        threadId ? { assistantThreadId: threadId } : undefined,
      );

      // Persist messages and table data if threadId is provided
      if (threadId && !isAborted) {
        try {
          // Get thread to check first exchange and message count for naming
          const thread = await this.assistantThreadService.getThread(apiToken, threadId);
          const messageCountBeforeTurn = thread?.messages.length ?? 0;
          const isFirstExchange = messageCountBeforeTurn === 0;
          // After this turn we will have messageCountBeforeTurn + 2 messages (user + assistant)
          const messageCountAfterTurn = messageCountBeforeTurn + 2;
          const shouldRegenerateName =
            isFirstExchange || (messageCountAfterTurn >= 4 && messageCountAfterTurn % 4 === 0);

          // Persist user message
          await this.assistantThreadService.appendMessage(
            apiToken,
            threadId,
            'user',
            message,
          );

          // Persist assistant message if we have final text
          if (finalText || finalToolCalls) {
            await this.assistantThreadService.appendMessage(
              apiToken,
              threadId,
              'assistant',
              finalText || '',
              finalToolCalls,
            );

            // Generate thread name: after first response and again every ~4 messages (4, 8, 12, ...)
            if (finalText && shouldRegenerateName) {
              try {
                const generatedName = await this.mcpAssistantService.generateThreadName(
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

          if (lastTableData) {
            await this.assistantThreadService.setThreadTableData(
              apiToken,
              threadId,
              lastTableData,
            );
          }
        } catch (persistErr) {
          // Log but don't fail the request - persistence is best effort
          console.error('Failed to persist thread data:', persistErr);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isAborted && !res.closed && !res.destroyed) {
        sendEvent('error', { error: message });
      }
    } finally {
      res.end();
    }
  }
}
