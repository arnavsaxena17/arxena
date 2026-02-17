import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
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

    try {
      await this.mcpAssistantService.processQueryStream(message, apiToken, history, sendEvent);
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
