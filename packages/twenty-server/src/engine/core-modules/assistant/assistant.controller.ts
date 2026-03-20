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

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

import { AssistantChatStreamService } from './assistant-chat-stream.service';
import { AssistantIterativeQueryService } from './assistant-iterative-query.service';
import { AssistantThreadTableDataService } from './assistant-thread-table-data.service';
import { AssistantThreadService } from './assistant-thread.service';
import {
  AssistantChatRequestBody,
  AssistantIterativeQueryRequestBody,
  MessageParam,
} from './assistant.types';
import { McpAssistantService } from './mcp-assistant.service';
import { AutonomousRecruitmentAgentRulesService } from './recruitment-agent-rules.service';

import { extractBearerApiToken } from './utils/assistant-auth.utils';
import { normalizeAssistantConversationHistory } from './utils/assistant-conversation-history.utils';

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly mcpAssistantService: McpAssistantService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly autonomousRecruitmentAgentRulesService: AutonomousRecruitmentAgentRulesService,
    private readonly assistantThreadTableDataService: AssistantThreadTableDataService,
    private readonly assistantIterativeQueryService: AssistantIterativeQueryService,
    private readonly assistantChatStreamService: AssistantChatStreamService,
  ) {}

  @Get('threads')
  @UseGuards(JwtAuthGuard)
  async listThreads(@Req() request: { headers: { authorization?: string } }) {
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      console.log('Missing or invalid Authorization header');

      return { error: 'Missing or invalid Authorization header' };
    }
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
    const apiToken = extractBearerApiToken(request.headers.authorization);

    console.log('createThread', request.body);
    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }
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
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }
    try {
      const thread = await this.assistantThreadService.getThread(apiToken, id);

      if (!thread) return { error: 'Thread not found' };

      const lastTableData =
        await this.assistantThreadTableDataService.resolveLastTableData(
          thread.lastTableData,
        );

      return {
        id: thread.id,
        name: thread.name,
        messages: thread.messages,
        assistantParameters: thread.assistantParameters ?? null,
        assistantSearchStrategy: thread.assistantSearchStrategy ?? null,
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
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }
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
        assistantParameters: thread?.assistantParameters ?? null,
        assistantSearchStrategy: thread?.assistantSearchStrategy ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      return { error: message };
    }
  }

  @Post('threads/:id/iterative-query')
  @UseGuards(JwtAuthGuard)
  async generateIterativeQueryForThread(
    @Param('id') id: string,
    @Req()
    request: {
      headers: { authorization?: string };
      body?: AssistantIterativeQueryRequestBody;
    },
  ) {
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }

    try {
      return await this.assistantIterativeQueryService.steerIterativeQueryForThread(
        apiToken,
        id,
        request.body ?? {},
      );
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
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }
    try {
      return await this.assistantThreadTableDataService.getThreadTable(
        threadId,
        tableId,
      );
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
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }

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
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }
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
    const apiToken = extractBearerApiToken(request.headers.authorization);

    if (!apiToken) {
      return { error: 'Missing or invalid Authorization header' };
    }
    const { message, conversationHistory } = request.body ?? {};

    if (!message || typeof message !== 'string') {
      return { error: 'Body must include a string "message"' };
    }
    const history = normalizeAssistantConversationHistory(
      conversationHistory,
    ) as MessageParam[];

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
    const apiToken = extractBearerApiToken(req.headers.authorization);

    if (!apiToken) {
      res
        .status(401)
        .json({ error: 'Missing or invalid Authorization header' });

      return;
    }
    await this.assistantChatStreamService.executeChatStream(
      apiToken,
      body,
      req,
      res,
    );
  }
}
