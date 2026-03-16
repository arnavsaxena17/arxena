import { Injectable, Logger } from '@nestjs/common';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { AssistantThreadService } from '../assistant/assistant-thread.service';
import { MessageParam } from '../assistant/assistant.types';
import { McpAssistantService } from '../assistant/mcp-assistant.service';
import { RecruitmentAgentRulesService } from '../assistant/recruitment-agent-rules.service';
import { buildHeartbeatPrompt } from './prompts/heartbeat-prompt.template';

const AUTONOMOUS_THREAD_NAME = 'Autonomous';

export type AutonomousRecruiterJobData = {
  workspaceId: string;
  schema: string;
  runId: string;
  timestamp: number;
};

function threadMessagesToHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> }>,
): MessageParam[] {
  const out: MessageParam[] = [];
  const lastK = 20;
  const slice = messages.slice(-lastK);
  for (const m of slice) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else {
      const content = [
        ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
        ...(m.toolCalls ?? []).map((tc) => ({
          type: 'tool_use' as const,
          id: `tc-${Math.random().toString(36).slice(2)}`,
          name: tc.name,
          input: tc.args ?? {},
        })),
      ];
      if (content.length) {
        out.push({ role: 'assistant', content });
      }
    }
  }
  return out;
}

@Processor(MessageQueue.autonomousRecruiterQueue)
@Injectable()
export class AutonomousRecruiterProcessor {
  private readonly logger = new Logger(AutonomousRecruiterProcessor.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly mcpAssistantService: McpAssistantService,
    private readonly recruitmentAgentRulesService: RecruitmentAgentRulesService,
    private readonly webSocketService: WebSocketService,
  ) {}

  @Process(AutonomousRecruiterProcessor.name)
  async handle(jobData: AutonomousRecruiterJobData): Promise<void> {
    const { workspaceId, schema, runId } = jobData;
    const startTime = Date.now();
    this.logger.log(`Heartbeat job started workspaceId=${workspaceId} runId=${runId}`);

    if (!workspaceId || !schema) {
      this.logger.warn(`Invalid job data: workspaceId=${workspaceId}, schema=${schema}`);
      return;
    }

    let apiToken: string;
    try {
      const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
      if (!apiKeys?.length) {
        this.logger.log(`No API keys for workspace ${workspaceId}, skipping heartbeat`);
        return;
      }
      const tokenResult = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
      );
      if (!tokenResult?.token) {
        this.logger.log(`Could not generate token for workspace ${workspaceId}`);
        return;
      }
      apiToken = tokenResult.token;
    } catch (err) {
      this.logger.error(`Failed to get token for workspace ${workspaceId}: ${(err as Error).message}`);
      return;
    }

    let threadId: string;
    try {
      const threads = await this.assistantThreadService.listThreads(apiToken);
      const autonomous = threads.find((t) => t.name === AUTONOMOUS_THREAD_NAME);
      if (autonomous) {
        threadId = autonomous.id;
      } else {
        const created = await this.assistantThreadService.createThread(apiToken, AUTONOMOUS_THREAD_NAME);
        threadId = created.id;
      }
    } catch (err) {
      this.logger.error(`Failed to get/create autonomous thread: ${(err as Error).message}`);
      return;
    }

    const room = `workspace-${workspaceId}`;
    try {
      this.webSocketService.sendToRoom(room, 'assistant.agent_event', {
        status: 'started',
        threadId,
        runId,
        timestamp: Date.now(),
      });
    } catch {
      // ignore if WebSocket not ready
    }

    const heartbeatPrompt = buildHeartbeatPrompt(threadId);

    try {
      const thread = await this.assistantThreadService.getThread(apiToken, threadId);
      const history = thread ? threadMessagesToHistory(thread.messages) : [];
      const systemPrompt = await this.recruitmentAgentRulesService.getSystemPrompt(apiToken);

      const response = await this.mcpAssistantService.processQuery(
        heartbeatPrompt,
        apiToken,
        history,
        systemPrompt,
      );

      await this.assistantThreadService.appendMessage(
        apiToken,
        threadId,
        'user',
        heartbeatPrompt,
      );
      await this.assistantThreadService.appendMessage(
        apiToken,
        threadId,
        'assistant',
        response.text,
        response.toolCalls,
      );

      this.webSocketService.sendToRoom(room, 'assistant.agent_event', {
        status: 'completed',
        threadId,
        runId,
        summary: response.text?.slice(0, 500) ?? '',
        timestamp: Date.now(),
      });
      const durationMs = Date.now() - startTime;
      this.logger.log(
        `Heartbeat completed for workspace ${workspaceId}, thread ${threadId}, durationMs=${durationMs}`,
      );
    } catch (err) {
      this.logger.error(`Heartbeat failed for workspace ${workspaceId}: ${(err as Error).message}`);
      this.webSocketService.sendToRoom(room, 'assistant.agent_event', {
        status: 'error',
        threadId,
        runId,
        error: (err as Error).message,
        timestamp: Date.now(),
      });
      throw err;
    }
  }
}
