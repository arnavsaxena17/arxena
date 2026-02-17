import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { AssistantThreadService } from './assistant-thread.service';
import { McpAssistantService } from './mcp-assistant.service';

type AssistantContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

type AssistantChatRequestBody = {
  message: string;
  threadId?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string | Array<unknown>;
  }>;
};

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly mcpAssistantService: McpAssistantService,
    private readonly assistantThreadService: AssistantThreadService,
  ) {}

  @Get('threads')
  @UseGuards(JwtAuthGuard)
  async listThreads(@Req() request: { headers: { authorization?: string } }) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
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
    @Req() request: { headers: { authorization?: string }; body?: { name?: string } },
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    try {
      const name = request.body?.name ?? 'New thread';
      const thread = await this.assistantThreadService.createThread(apiToken, name);
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
        lastTableData: thread.lastTableData,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  @Get('threads/:id/stream')
  @UseGuards(JwtAuthGuard)
  async streamThreadUpdates(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let isAborted = false;
    const abortHandler = () => {
      isAborted = true;
    };
    res.on('close', abortHandler);
    req.on('close', abortHandler);
    req.on('aborted', abortHandler);

    const sendEvent = (event: string, data: unknown): boolean => {
      if (isAborted || res.closed || res.destroyed) return false;
      const socket = req.socket ?? res.socket;
      if (socket && socket.destroyed) return false;
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch {
        isAborted = true;
        return false;
      }
    };

    // Send initial thread data
    try {
      const thread = await this.assistantThreadService.getThread(apiToken, id);
      if (!thread) {
        sendEvent('error', { error: 'Thread not found' });
        res.end();
        return;
      }
      sendEvent('thread_update', {
        id: thread.id,
        name: thread.name,
        messages: thread.messages,
        lastTableData: thread.lastTableData,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendEvent('error', { error: message });
      res.end();
      return;
    }

    // Send periodic updates (in a real implementation, you'd use a pub/sub system)
    // Poll less frequently to reduce server load
    let lastUpdateTime = Date.now();
    const checkInterval = setInterval(async () => {
      if (isAborted) {
        clearInterval(checkInterval);
        return;
      }
      try {
        const thread = await this.assistantThreadService.getThread(apiToken, id);
        if (thread && thread.updatedAt.getTime() > lastUpdateTime) {
          lastUpdateTime = thread.updatedAt.getTime();
          sendEvent('thread_update', {
            id: thread.id,
            name: thread.name,
            messages: thread.messages,
            lastTableData: thread.lastTableData,
          });
        }
      } catch {
        // ignore errors during polling
      }
    }, 5000); // Poll every 5 seconds, but only send if thread actually changed

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(checkInterval);
      if (!res.closed && !res.destroyed) {
        res.end();
      }
    };
    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);
  }

  @Patch('threads/:id')
  @UseGuards(JwtAuthGuard)
  async updateThread(
    @Param('id') id: string,
    @Req() request: { headers: { authorization?: string }; body?: { name?: string } },
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    const name = request.body?.name;
    if (!name || typeof name !== 'string') {
      return { error: 'Body must include a string "name"' };
    }
    try {
      await this.assistantThreadService.updateThreadName(apiToken, id, name);
      return { id, name };
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

    const history = (conversationHistory ?? []).map((m): { role: 'user'; content: string } | { role: 'assistant'; content: AssistantContentBlock[] } => {
      if (m.role === 'user') {
        return { role: 'user', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
      }
      const content: AssistantContentBlock[] = Array.isArray(m.content)
        ? (m.content as AssistantContentBlock[])
        : [{ type: 'text', text: String(m.content) }];
      return { role: 'assistant', content };
    });

    const result = await this.mcpAssistantService.processQuery(message, apiToken, history);
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

    const history = (conversationHistory ?? []).map((m): { role: 'user'; content: string } | { role: 'assistant'; content: AssistantContentBlock[] } => {
      if (m.role === 'user') {
        return { role: 'user', content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
      }
      const content: AssistantContentBlock[] = Array.isArray(m.content)
        ? (m.content as AssistantContentBlock[])
        : [{ type: 'text', text: String(m.content) }];
      return { role: 'assistant', content };
    });

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
      await this.mcpAssistantService.processQueryStream(message, apiToken, history, sendEvent);
      
      // Persist messages and table data if threadId is provided
      if (threadId && !isAborted) {
        try {
          // Get thread to check if this is the first exchange
          const thread = await this.assistantThreadService.getThread(apiToken, threadId);
          const isFirstExchange = thread && thread.messages.length === 0;
          
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
            
            // Generate thread name after first assistant response
            if (isFirstExchange && finalText) {
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
                // Send name update event to frontend
                sendEvent('thread_name', { name: generatedName });
              } catch (nameErr) {
                // Log but don't fail - name generation is best effort
                console.error('Failed to generate thread name:', nameErr);
              }
            }
          }
          
          // Persist table data if available
          if (lastTableData) {
            const tableData = lastTableData as { columns: string[]; rows: Record<string, unknown>[] };
            await this.assistantThreadService.setThreadTableData(
              apiToken,
              threadId,
              tableData,
            );
            
            // Extract candidate IDs from table data and store them
            // When migrating to database-backed storage, create assistantThreadCandidate records
            const candidateIds: string[] = [];
            for (const row of tableData.rows) {
              const id = row.id ?? row.candidateId ?? row.candidate_id;
              if (typeof id === 'string' && id) {
                candidateIds.push(id);
              }
            }
            if (candidateIds.length > 0) {
              await this.assistantThreadService.setThreadCandidates(
                apiToken,
                threadId,
                candidateIds,
              );
            }
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
