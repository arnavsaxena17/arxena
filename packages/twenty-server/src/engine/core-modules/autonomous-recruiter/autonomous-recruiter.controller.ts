import { Body, Controller, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AssistantThreadService } from 'src/engine/core-modules/assistant/assistant-thread.service';
import type { AssistantThreadRecord } from 'src/engine/core-modules/assistant/assistant.types';
import { McpAssistantService } from 'src/engine/core-modules/assistant/mcp-assistant.service';
import { RecruitmentAgentRulesService } from 'src/engine/core-modules/assistant/recruitment-agent-rules.service';
import { threadMessagesToHistory } from 'src/engine/core-modules/assistant/utils/thread-history.util';
import { RecruiterMessageService } from 'src/engine/core-modules/autonomous-recruiter/recruiter-message.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

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

@Controller('autonomous-recruiter')
export class AutonomousRecruiterController {
  constructor(
    private readonly mcpAssistantService: McpAssistantService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly recruitmentAgentRulesService: RecruitmentAgentRulesService,
    private readonly recruiterMessageService: RecruiterMessageService,
  ) {}

  private readonly logger = new Logger(AutonomousRecruiterController.name);


  @Post('demo-thread/stream')
  @UseGuards(JwtAuthGuard)
  async startDemoConversationStream(
    @Body() body: StartDemoBody,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    if (!body?.requirement || typeof body.requirement !== 'string') {
      res.status(400).json({ error: 'Body must include a string "requirement"' });
      return;
    }

    const { threadId: maybeThreadId, threadName, requirement, maxTurns } = body;

    let thread: AssistantThreadRecord | null;
    if (maybeThreadId) {
      thread = await this.assistantThreadService.getThread(apiToken, maybeThreadId);
      if (!thread) {
        res.status(404).json({ error: `Thread not found for id=${maybeThreadId}` });
        return;
      }
    } else {
      const created = await this.assistantThreadService.createThread(
        apiToken,
        threadName ?? 'Autonomous recruiter demo',
      );
      thread = await this.assistantThreadService.getThread(apiToken, created.id);
      if (!thread) {
        res.status(500).json({ error: 'Failed to create demo thread' });
        return;
      }
    }

    const plannedTurns = Number.isFinite(maxTurns as number)
      ? Math.max(1, Math.min(5, Math.floor(maxTurns as number)))
      : 5;

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

    const steps: Array<{
      step: number;
      recruiterInstruction: string;
      autonomousResponse: string;
      toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
    }> = [];

    try {
      for (let i = 0; i < plannedTurns; i += 1) {
        const isFirstTurn = i === 0;

        // #region agent log
        fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '51e09d',
          },
          body: JSON.stringify({
            sessionId: '51e09d',
            runId: 'pre-mcp-call',
            hypothesisId: 'A',
            location: 'autonomous-recruiter.controller.ts:loop-start',
            message: 'Autonomous recruiter loop iteration start',
            data: { i, plannedTurns, isFirstTurn },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log

        let recruiterMessage:
          | { text: string; metadata?: Record<string, unknown> }
          | null = null;

        const refreshedThreadBeforeTurn = await this.assistantThreadService.getThread(
          apiToken,
          thread.id,
        );
        const historyBeforeTurn = refreshedThreadBeforeTurn
          ? threadMessagesToHistory(refreshedThreadBeforeTurn.messages)
          : [];
        const systemPrompt =
          await this.recruitmentAgentRulesService.getSystemPrompt(apiToken);

        let finalText = '';
        let finalToolCalls:
          | Array<{ name: string; args: Record<string, unknown> }>
          | undefined;

        if (isFirstTurn) {
          // First turn: send the raw requirement directly to the autonomous recruiter,
          // then feed the autonomous response into the recruiter message service.
          // Also append the human requirement to the thread so history is preserved.
          await this.assistantThreadService.appendMessage(
            apiToken,
            thread.id,
            'user',
            requirement,
          );
        }

        await this.mcpAssistantService.processQueryStream(
          isFirstTurn ? requirement : (await this.recruiterMessageService.generateRecruiterMessageFromThread(
            apiToken,
            thread.id,
            {
              includeJobContext: true,
              appendUserMessageToThread: true,
            },
          )).text,
          apiToken,
          historyBeforeTurn,
          (event, data) => {
            if (event === 'final_text') {
              console.log("final_text event received: data::", JSON.stringify(data, null, 2));
              const full = (data as { text?: string }).text;
              if (typeof full === 'string' && full.length > 0) {
                finalText = full;
              }
              // Do NOT forward inner final_text events to the client; the
              // outer controller will emit a single demo-level "done" event
              // once all turns have completed.
              return true;
            }

            if (event === 'text') {
              console.log("text event received: data::", JSON.stringify(data, null, 2));
              const delta = (data as { delta?: string }).delta;
              if (typeof delta === 'string') {
                finalText += delta;
              }
            }

            if (event === 'done') {
              console.log("done event received: data::", JSON.stringify(data, null, 2));
              const donePayload = data as {
                text?: string;
                toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
              };
              // Prefer the text we have accumulated from the streaming deltas.
              // Only fall back to donePayload.text if, for some reason, no text
              // was ever streamed (e.g. edge-case provider behavior).
              if (!finalText && typeof donePayload.text === 'string' && donePayload.text.length > 0) {
                finalText = donePayload.text;
              }
              if (Array.isArray(donePayload.toolCalls)) {
                finalToolCalls = donePayload.toolCalls;
              }
              // Swallow inner "done" events; the autonomous recruiter loop
              // still needs the full assistant message, but the frontend
              // should only react to the outer demo-level "done" event
              // emitted after all turns finish.
              return true;
            }

            // Forward all streaming events (text, status, table_data, etc.) to the client.
            return sendEvent(event, data);
          },
          systemPrompt,
        );

        const autonomousResponse = finalText;
        const toolCalls = finalToolCalls ?? [];

        // #region agent log
        fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '51e09d',
          },
          body: JSON.stringify({
            sessionId: '51e09d',
            runId: 'post-mcp-call',
            hypothesisId: 'B',
            location: 'autonomous-recruiter.controller.ts:after-mcp-call',
            message: 'Autonomous recruiter loop after processQueryStream',
            data: {
              i,
              autonomousResponseLength: autonomousResponse?.length ?? 0,
              hasToolCalls: !!toolCalls.length,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log

        console.log("appendMessage called: autonomousResponse::", autonomousResponse);
        const result = await this.assistantThreadService.appendMessage(
          apiToken,
          thread.id,
          'assistant',
          autonomousResponse ?? '',
          toolCalls,
        );
        console.log("appendMessage called: result::", JSON.stringify(result, null, 2));

        // After the autonomous recruiter has responded on the first turn,
        // generate a recruiter-facing instruction from that response so that
        // subsequent planning can build on it.
        if (isFirstTurn) {
          recruiterMessage =
            await this.recruiterMessageService.generateRecruiterMessageWithToken(
              apiToken,
              thread.id,
              autonomousResponse ?? '',
              {
                includeJobContext: true,
                appendUserMessageToThread: false,
              },
            );
          console.log(
            'recruiterMessage generated after first autonomous response: recruiterMessage::',
            JSON.stringify(recruiterMessage, null, 2),
          );
        } else {
          recruiterMessage =
            await this.recruiterMessageService.generateRecruiterMessageFromThread(
              apiToken,
              thread.id,
              {
                includeJobContext: true,
                appendUserMessageToThread: true,
              },
            );
          console.log(
            'recruiterMessage generated from thread: recruiterMessage::',
            JSON.stringify(recruiterMessage, null, 2),
          );
        }

        const stepPayload = {
          step: i + 1,
          recruiterInstruction: recruiterMessage?.text ?? '',
          autonomousResponse,
          toolCalls,
        };
        steps.push(stepPayload);
        if (!sendEvent('step', { ...stepPayload, threadId: thread.id })) {
          console.log("sendEvent(step) returned false, continuing without breaking loop");
        }


        if (autonomousResponse && /DONE\b/i.test(autonomousResponse)) {
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

      // #region agent log
      fetch('http://127.0.0.1:7288/ingest/a3b608c9-4874-4748-b52c-6d28745b8eff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '51e09d',
        },
        body: JSON.stringify({
          sessionId: '51e09d',
          runId: 'catch-block',
          hypothesisId: 'C',
          location: 'autonomous-recruiter.controller.ts:catch',
          message: 'Error in autonomous recruiter demo loop',
          data: { errorMessage: message },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log

      sendEvent('error', { error: message });
    } finally {
      res.end();
    }
  }
}

