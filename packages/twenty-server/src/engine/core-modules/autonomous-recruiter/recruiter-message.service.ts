import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AssistantThreadService } from '../assistant/assistant-thread.service';
import {
  RecruiterMessageOptions,
  RecruiterMessageResponse,
} from '../assistant/assistant.types';
import { StreamProcessingService } from '../candidate-search/services/stream-processing.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { JobContextService } from './job-context.service';
import { buildRecruiterMessagePrompt } from './prompts/recruiter-message-prompt.template';

@Injectable()
export class RecruiterMessageService {
  private readonly logger = new Logger(RecruiterMessageService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly assistantThreadService: AssistantThreadService,
    private readonly jobContextService: JobContextService,
    private readonly streamProcessingService: StreamProcessingService,
  ) {}

  async generateRecruiterMessageWithWorkspace(
    workspaceId: string,
    schema: string,
    threadId: string,
    userMessage: string,
    options?: RecruiterMessageOptions,
  ): Promise<RecruiterMessageResponse> {
    const apiToken = await this.getApiTokenFromWorkspace(workspaceId, schema);
    const recruiterMessageOptions = await this.generateRecruiterMessageWithToken(apiToken, threadId, userMessage, options)
    console.log("recruiterMessageOptions::", JSON.stringify(recruiterMessageOptions, null, 2));
    return recruiterMessageOptions;
  }

  async generateRecruiterMessageWithToken(
    apiToken: string,
    threadId: string,
    userMessage: string,
    options?: RecruiterMessageOptions,
  ): Promise<RecruiterMessageResponse> {
    const thread = await this.assistantThreadService.getThread(apiToken, threadId);
    if (!thread) {
      throw new Error(`Assistant thread not found for id=${threadId}`);
    }

    console.log("generateRecruiterMessageWithToken called: thread::", JSON.stringify(thread, null, 2));
    const jobContext =
      options?.includeJobContext === false || !thread.jobId
        ? null
        : await this.jobContextService.fetchJobContext(apiToken, thread.jobId);

    const recruiterInstruction = buildRecruiterMessagePrompt({
      userMessage,
      jobContext,
      agentNotes: thread.agentNotes,
    });

    console.log("recruiterInstruction::", JSON.stringify(recruiterInstruction, null, 2));
    const shouldAppendUserMessage = options?.appendUserMessageToThread !== false;
    console.log("shouldAppendUserMessage::", JSON.stringify(shouldAppendUserMessage, null, 2));
    if (shouldAppendUserMessage) {
      // Persist the original, simple recruiter text to the thread so that
      // conversation history remains human-readable. The richer
      // recruiterInstruction is used only as the prompt sent to the
      // autonomous recruiter model.
      await this.assistantThreadService.appendMessage(
        apiToken,
        threadId,
        'user',
        userMessage,
      );
    }

    this.logger.log(`Appended recruiter instruction for autonomous recruiter on threadId=${threadId}`);

    return {
      text: recruiterInstruction,
      metadata: jobContext
        ? {
            jobContextSummary: [
              jobContext.jobTitle ?? jobContext.searchName,
              jobContext.companyName,
            ]
              .filter(Boolean)
              .join(' @ '),
          }
        : undefined,
    };
  }

  /**
   * Generate the *next* human-readable recruiter message based on the
   * current assistant thread state and optional job context, using a
   * lightweight LLM call. This message is then fed into the standard
   * recruiter-instruction prompt builder.
   */
  async generateRecruiterMessageFromThread(
    apiToken: string,
    threadId: string,
    options?: RecruiterMessageOptions,
  ): Promise<RecruiterMessageResponse> {
    const thread = await this.assistantThreadService.getThread(apiToken, threadId);
    if (!thread) {
      throw new Error(`Assistant thread not found for id=${threadId}`);
    }

    const jobContext =
      options?.includeJobContext === false || !thread.jobId
        ? null
        : await this.jobContextService.fetchJobContext(apiToken, thread.jobId);

    const conversationSummaryParts: string[] = [];
    const recentMessages = thread.messages.slice(-6);
    recentMessages.forEach((m) => {
      const roleLabel = m.role === 'assistant' ? 'Assistant' : 'Recruiter';
      conversationSummaryParts.push(`${roleLabel}: ${m.content}`);
    });

    const jobLine = jobContext
      ? [
          jobContext.jobTitle ?? jobContext.searchName,
          jobContext.companyName,
          jobContext.jobLocation,
        ]
          .filter(Boolean)
          .join(' @ ')
      : null;

    const plannerPromptLines: string[] = [];
    plannerPromptLines.push(
      'You are a senior recruiter planning the next short message to an autonomous recruiter assistant inside Arxena.',
    );
    plannerPromptLines.push(
      'Your job is to tell the assistant what to do next in one or two high‑value steps (e.g. filter candidates, fetch contacts, fetch org charts, send chats).',
    );
    plannerPromptLines.push('');
    if (jobLine) {
      plannerPromptLines.push(`Job: ${jobLine}`);
      plannerPromptLines.push('');
    }
    plannerPromptLines.push('Recent conversation between recruiter and assistant:');
    plannerPromptLines.push('');
    plannerPromptLines.push(conversationSummaryParts.join('\n'));
    plannerPromptLines.push('');
    plannerPromptLines.push(
      'Now write the next recruiter message as a single, concise instruction to the assistant about what to do next.',
    );
    plannerPromptLines.push(
      'Do not explain your reasoning. Respond with only the raw message text you would send to the assistant.',
    );

    const prompt = plannerPromptLines.join('\n');

    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const { openAIclient: openai } = await this.workspaceQueryService.initializeLLMClients(
      workspaceId,
    );

    const plannerSchema = z.object({
      message: z.string().min(1, 'Message must not be empty'),
    });

    console.log("plannerPromptLines::", JSON.stringify(plannerPromptLines, null, 2));

    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openai as OpenAI,
          [
            {
              role: 'system' as const,
              content:
                'You are a senior recruiter planning the next short instruction to an autonomous recruiter assistant. Respond ONLY with a JSON object matching the expected schema.',
            },
            { role: 'user' as const, content: prompt },
          ],
          zodResponseFormat(plannerSchema, 'recruiterPlanner'),
          'gpt-4o',
        ),
      {
        // If we ever want to surface planner streaming to a client, wire sendEvent here.
        chunkEventName: 'text',
        chunkPayloadKey: 'delta',
      },
    );

    const rawContent = typeof result === 'string' ? result : result.content;
    if (!rawContent) {
      console.log("generateRecruiterMessageFromThread: empty content from streaming planner, falling back to default message.");
      this.logger.warn(
        'generateRecruiterMessageFromThread: empty content from streaming planner, falling back to default message.',
      );
    }

    let generatedUserMessage =
      'Continue progressing this search with the next one or two high-value actions.';
    try {
      if (rawContent) {
        const parsed = JSON.parse(rawContent);
        const validated = plannerSchema.parse(parsed);
        generatedUserMessage = validated.message.trim() || generatedUserMessage;
      }
    } catch (error) {
      this.logger.warn(
        `generateRecruiterMessageFromThread: failed to parse planner JSON, using fallback message. Error: ${
          (error as Error).message
        }`,
      );
    }

    console.log("generatedUserMessage::", JSON.stringify(generatedUserMessage, null, 2));
    const recruiterMessageResponse = await this.generateRecruiterMessageWithToken(
      apiToken,
      threadId,
      generatedUserMessage,
      options,
    );

    console.log("recruiterMessageResponse generated: recruiterMessageResponse::", JSON.stringify(recruiterMessageResponse, null, 2)); 
    if (!recruiterMessageResponse) {
      throw new Error('Failed to generate recruiter message');
    }
    console.log("recruiterMessageResponse::", JSON.stringify(recruiterMessageResponse, null, 2));
    return recruiterMessageResponse;
  }

  private async getApiTokenFromWorkspace(workspaceId: string, schema: string): Promise<string> {
    const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
    if (!apiKeys?.length) {
      throw new Error(`No API keys for workspace ${workspaceId}`);
    }
    const tokenResult = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
      workspaceId,
      apiKeys[0].id,
    );
    if (!tokenResult?.token) {
      throw new Error(`Could not generate token for workspace ${workspaceId}`);
    }
    return tokenResult.token;
  }
}

