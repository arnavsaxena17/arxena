import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AssistantThreadService } from 'src/engine/core-modules/assistant/assistant-thread.service';
import type { AssistantThreadRecord } from 'src/engine/core-modules/assistant/assistant.types';
import { McpAssistantService } from 'src/engine/core-modules/assistant/mcp-assistant.service';
import { DEFAULT_AUTONOMOUS_RECRUITER_SYSTEM_PROMPT } from 'src/engine/core-modules/assistant/recruitment-agent-rules.service';
import { threadMessagesToHistory } from 'src/engine/core-modules/assistant/utils/thread-history.util';
import { RecruiterMessageService } from 'src/engine/core-modules/autonomous-recruiter/recruiter-message.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import type { AutonomousRecruiterJobData } from './autonomous-recruiter.processor';

type StartDemoBody = {
  threadId?: string;
  threadName?: string;
  requirement: string;
  /**
   * Maximum number of recruiter ↔ autonomous recruiter turns to run in this demo.
   * Defaults to 3, capped to a small upper bound to avoid runaway loops.
   */
  maxTurns?: number;
};

type DemoStepPayload = {
  step: number;
  recruiterInstruction: string;
  autonomousResponse: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
};

type ValidatedDemoRequest = {
  apiToken: string;
  requirement: string;
  maybeThreadId: string | undefined;
  threadName: string | undefined;
  maxTurns: number | undefined;
};

@Controller('autonomous-recruiter')
export class AutonomousRecruiterController {
  constructor(
    private readonly mcpAssistantService: McpAssistantService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly recruiterMessageService: RecruiterMessageService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    @InjectMessageQueue(MessageQueue.autonomousRecruiterQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  private readonly logger = new Logger(AutonomousRecruiterController.name);

  private extractApiToken(req: Request): string {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    return authHeader.slice(7).replace(/[\r\n]+/g, '');
  }

  private validateDemoRequest(
    req: Request,
    body: unknown,
  ): ValidatedDemoRequest | { sendError: (res: Response) => void } {
    let apiToken: string;
    try {
      apiToken = this.extractApiToken(req);
    } catch {
      return {
        sendError: (res) =>
          res.status(401).json({ error: 'Missing or invalid Authorization header' }),
      };
    }
    if (!body || typeof body !== 'object' || !('requirement' in body)) {
      return {
        sendError: (res) =>
          res.status(400).json({ error: 'Body must include a string "requirement"' }),
      };
    }
    const b = body as StartDemoBody;
    if (typeof b.requirement !== 'string') {
      return {
        sendError: (res) =>
          res.status(400).json({ error: 'Body must include a string "requirement"' }),
      };
    }
    return {
      apiToken,
      requirement: b.requirement,
      maybeThreadId: b.threadId,
      threadName: b.threadName,
      maxTurns: b.maxTurns,
    };
  }

  private async resolveDemoThread(
    apiToken: string,
    maybeThreadId: string | undefined,
    threadName: string | undefined,
  ): Promise<AssistantThreadRecord | { sendError: (res: Response) => void }> {
    if (maybeThreadId) {
      const thread = await this.assistantThreadService.getThread(apiToken, maybeThreadId);
      if (!thread) {
        return {
          sendError: (res) =>
            res.status(404).json({ error: `Thread not found for id=${maybeThreadId}` }),
        };
      }
      return thread;
    }
    const created = await this.assistantThreadService.createThread(
      apiToken,
      threadName ?? 'Autonomous recruiter demo',
    );
    const thread = await this.assistantThreadService.getThread(apiToken, created.id);
    if (!thread) {
      return {
        sendError: (res) =>
          res.status(500).json({ error: 'Failed to create demo thread' }),
      };
    }
    return thread;
  }

  private getPlannedTurns(maxTurns: number | undefined): number {
    return Number.isFinite(maxTurns as number)
      ? Math.max(1, Math.min(5, Math.floor(maxTurns as number)))
      : 5;
  }

  private setupDemoStream(
    req: Request,
    res: Response,
  ): {
    sendEvent: (event: string, data: unknown) => boolean;
    isAborted: () => boolean;
  } {
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

    return {
      sendEvent,
      isAborted: () => isAborted,
    };
  }

  private createProcessQueryStreamCallback(sendEvent: (event: string, data: unknown) => boolean): {
    callback: (
      event: string,
      data: unknown,
    ) => boolean;
    getResult: () => {
      finalText: string;
      finalToolCalls: Array<{ name: string; args: Record<string, unknown> }>;
    };
  } {
    let finalText = '';
    let finalToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    const callback = (event: string, data: unknown): boolean => {
      if (event === 'final_text') {
        const full = (data as { text?: string }).text;
        if (typeof full === 'string' && full.length > 0) {
          finalText = full;
        }
        return true;
      }
      if (event === 'text') {
        const delta = (data as { delta?: string }).delta;
        if (typeof delta === 'string') {
          finalText += delta;
        }
      }
      if (event === 'done') {
        const donePayload = data as {
          text?: string;
          toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
        };
        if (
          !finalText &&
          typeof donePayload.text === 'string' &&
          donePayload.text.length > 0
        ) {
          finalText = donePayload.text;
        }
        if (Array.isArray(donePayload.toolCalls)) {
          finalToolCalls = donePayload.toolCalls;
        }
        return true;
      }
      return sendEvent(event, data);
    };

    return {
      callback,
      getResult: () => ({ finalText, finalToolCalls }),
    };
  }

  private async runOneDemoTurn(
    turnIndex: number,
    plannedTurns: number,
    apiToken: string,
    thread: AssistantThreadRecord,
    requirement: string,
    sendEvent: (event: string, data: unknown) => boolean,
  ): Promise<DemoStepPayload> {
    const isFirstTurn = turnIndex === 0;

    const refreshedThreadBeforeTurn = await this.assistantThreadService.getThread(
      apiToken,
      thread.id,
    );
    const includeStatusMessages =
      refreshedThreadBeforeTurn?.assistantParameters &&
      typeof refreshedThreadBeforeTurn.assistantParameters === 'object'
        ? (
            refreshedThreadBeforeTurn.assistantParameters as {
              statusMessagePolicy?: { includeInConversationHistory?: boolean };
            }
          ).statusMessagePolicy?.includeInConversationHistory ?? true
        : true;
    const historyBeforeTurn = refreshedThreadBeforeTurn
      ? threadMessagesToHistory(refreshedThreadBeforeTurn.messages, {
          includeStatusMessages,
        })
      : [];

    if (isFirstTurn) {
      await this.assistantThreadService.appendMessage(
        apiToken,
        thread.id,
        'user',
        requirement,
      );
    }

    const recruiterInputText = isFirstTurn
      ? requirement
      : (
          await this.recruiterMessageService.generateRecruiterMessageFromThread(
            apiToken,
            thread.id,
            {
              includeJobContext: true,
              appendUserMessageToThread: true,
            },
            sendEvent,
          )
        ).text;

    const { callback, getResult } = this.createProcessQueryStreamCallback(sendEvent);
    await this.mcpAssistantService.processQueryStream(
      recruiterInputText,
      apiToken,
      historyBeforeTurn,
      callback,
      DEFAULT_AUTONOMOUS_RECRUITER_SYSTEM_PROMPT,
    );

    const { finalText: autonomousResponse, finalToolCalls: toolCalls } = getResult();

    await this.assistantThreadService.appendMessage(
      apiToken,
      thread.id,
      'assistant',
      autonomousResponse ?? '',
      toolCalls,
    );

    const recruiterMessage = isFirstTurn
      ? await this.recruiterMessageService.generateRecruiterMessageWithToken(
          apiToken,
          thread.id,
          autonomousResponse ?? '',
          {
            includeJobContext: true,
            // Do not re-append the autonomous assistant response as a 'user'
            // message to the thread on the first turn. Otherwise, the same
            // assistant text is stored twice (once as 'assistant', once as
            // 'user'), which makes the UI show the same bubble for both
            // assistant and "you".
            appendUserMessageToThread: false,
          },
        )
      : await this.recruiterMessageService.generateRecruiterMessageFromThread(
          apiToken,
          thread.id,
          {
            includeJobContext: true,
            appendUserMessageToThread: true,
          },
          sendEvent,
        );

    return {
      step: turnIndex + 1,
      recruiterInstruction: recruiterMessage?.text ?? '',
      autonomousResponse: autonomousResponse ?? '',
      toolCalls,
    };
  }

  @Post('demo-thread/stream')
  @UseGuards(JwtAuthGuard)
  async startDemoConversationStream(
    @Body() body: StartDemoBody,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const validated = this.validateDemoRequest(req, body);
    if ('sendError' in validated) {
      validated.sendError(res);
      return;
    }
    const { apiToken, requirement, maybeThreadId, threadName, maxTurns } = validated;
    console.log("requirement::", requirement);
    console.log("maybeThreadId::", maybeThreadId);
    console.log("threadName::", threadName);
    console.log("maxTurns::", maxTurns);
    const threadResult = await this.resolveDemoThread(
      apiToken,
      maybeThreadId,
      threadName,
    );
    if ('sendError' in threadResult) {
      threadResult.sendError(res);
      return;
    }
    const thread = threadResult;

    const plannedTurns = this.getPlannedTurns(maxTurns);
    const { sendEvent } = this.setupDemoStream(req, res);

    const steps: DemoStepPayload[] = [];

    try {
      for (let i = 0; i < plannedTurns; i += 1) {
        const stepPayload = await this.runOneDemoTurn(
          i,
          plannedTurns,
          apiToken,
          thread,
          requirement,
          sendEvent,
        );
        steps.push(stepPayload);
        sendEvent('step', { ...stepPayload, threadId: thread.id });

        if (/DONE\b/i.test(stepPayload.autonomousResponse)) {
          break;
        }
      }

      sendEvent('done', {
        threadId: thread.id,
        requirement,
        steps,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendEvent('error', { error: message });
    } finally {
      res.end();
    }
  }

  @Post('heartbeat')
  @UseGuards(JwtAuthGuard)
  async enqueueHeartbeat(@Req() req: Request): Promise<{ status: 'queued'; runId: string }> {
    const apiToken = this.extractApiToken(req);
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
    const runId = `manual-${Date.now()}`;

    const jobData: AutonomousRecruiterJobData = {
      workspaceId,
      schema,
      runId,
      timestamp: Date.now(),
    };

    await this.messageQueueService.add<AutonomousRecruiterJobData>(
      MessageQueue.autonomousRecruiterQueue,
      jobData,
      { id: `autonomous-recruiter-${workspaceId}-${runId}` },
    );

    this.logger.log(
      `Enqueued manual autonomous recruiter heartbeat for workspace ${workspaceId}, runId=${runId}`,
    );

    return { status: 'queued', runId };
  }
}
