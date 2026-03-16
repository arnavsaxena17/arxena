import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
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

  @Post('demo-thread')
  @UseGuards(JwtAuthGuard)
  async startDemoConversation(
    @Req() request: { headers: { authorization?: string }; body: StartDemoBody },
    @Body() body: StartDemoBody,
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Missing or invalid Authorization header' };
    }
    console.log("startDemoConversation called: authHeader::", authHeader);
    const apiToken = authHeader.slice(7).replace(/[\r\n]+/g, '');
    console.log("startDemoConversation called: apiToken::", apiToken);
    if (!body?.requirement || typeof body.requirement !== 'string') {
      return { error: 'Body must include a string "requirement"' };
    }
    console.log("startDemoConversation called: body::", body);
    const { threadId: maybeThreadId, threadName, requirement, maxTurns } = body;
console.log("startDemoConversation called: maybeThreadId::", maybeThreadId);
console.log("startDemoConversation called: threadName::", threadName);
console.log("startDemoConversation called: requirement::", requirement);
console.log("startDemoConversation called: maxTurns::", maxTurns);
    let thread: AssistantThreadRecord | null;
    if (maybeThreadId) {
      thread = await this.assistantThreadService.getThread(apiToken, maybeThreadId);
      console.log("startDemoConversation called: thread::", thread);
      if (!thread) {
        return { error: `Thread not found for id=${maybeThreadId}` };
      }
    } else {
      const created = await this.assistantThreadService.createThread(
        apiToken,
        threadName ?? 'Autonomous recruiter demo',
      );
      thread = await this.assistantThreadService.getThread(apiToken, created.id);
      if (!thread) {
        return { error: 'Failed to create demo thread' };
      }
    }

    const plannedTurns = Number.isFinite(maxTurns as number)
      ? Math.max(1, Math.min(5, Math.floor(maxTurns as number)))
      : 5;

    const steps: Array<{
      step: number;
      recruiterInstruction: string;
      autonomousResponse: string;
      toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
    }> = [];

    let lastResponseText = '';
    let lastToolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    let lastRecruiterInstruction = '';
    let lastRecruiterMetadata: unknown = null;

    for (let i = 0; i < plannedTurns; i += 1) {
      const recruiterUserMessage =
        i === 0
          ? requirement
          : 'Continue the recruiter workflow for this job. Take the next one or two high-value actions (filter candidates, fetch contacts, fetch org charts, send chats) based on the current thread state. If you are done for now, respond with "DONE" and a brief summary.';

      const recruiterMessage =
        await this.recruiterMessageService.generateRecruiterMessageWithToken(
          apiToken,
          thread.id,
          recruiterUserMessage,
          { includeJobContext: true },
        );

      this.logger.log(`Recruiter message generated: ${recruiterMessage.text.slice(0, 200)}`);
      const refreshedThread = await this.assistantThreadService.getThread(apiToken, thread.id);
      const history = refreshedThread ? threadMessagesToHistory(refreshedThread.messages) : [];
      const systemPrompt = await this.recruitmentAgentRulesService.getSystemPrompt(apiToken);
        console.log('systemPrompt', systemPrompt);
      const response = await this.mcpAssistantService.processQuery(
        recruiterMessage.text,
        apiToken,
        history,
        systemPrompt,
      );

      console.log('response', response);
      console.log('response.text', response.text);
      console.log('response.toolCalls', response.toolCalls);
      await this.assistantThreadService.appendMessage(
        apiToken,
        thread.id,
        'assistant',
        response.text ?? '',
        response.toolCalls,
      );



      lastRecruiterInstruction = recruiterMessage.text;
      lastRecruiterMetadata = recruiterMessage.metadata ?? null;
      lastResponseText = response.text ?? '';
      lastToolCalls = response.toolCalls ?? [];

      steps.push({
        step: i + 1,
        recruiterInstruction: recruiterMessage.text,
        autonomousResponse: response.text ?? '',
        toolCalls: response.toolCalls ?? [],
      });

      this.logger.log(
        `Demo turn ${i + 1} completed: recruiterInstruction="${recruiterMessage.text.slice(
          0,
          200,
        )}", autonomousResponse="${(response.text ?? '').slice(0, 200)}"`,
      );

      if (response.text && /DONE\b/i.test(response.text)) {
        break;
      }
    }
    console.log('steps', steps);
    console.log('lastRecruiterInstruction', lastRecruiterInstruction);
    console.log('lastRecruiterMetadata', lastRecruiterMetadata);
    console.log('lastResponseText', lastResponseText);
    console.log('lastToolCalls', lastToolCalls);
    return {
      threadId: thread.id,
      requirement,
      recruiterInstruction: lastRecruiterInstruction,
      recruiterMetadata: lastRecruiterMetadata,
      autonomousResponse: lastResponseText,
      toolCalls: lastToolCalls,
      steps,
    };
  }
}

