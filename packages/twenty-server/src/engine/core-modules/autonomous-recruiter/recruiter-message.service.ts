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

    /**
     * Heuristic safeguard:
     * If the "userMessage" looks like a scripted, multi-turn transcript
     * (contains both "Recruiter:" and "Assistant:" labels), treat it as
     * prompt-only context and do NOT append it into the live thread as a
     * single 'user' message. This keeps the stored conversation as
     * clean, role-separated turns and avoids UI bubbles that mix roles.
     */
    const looksLikeTranscript =
      /Recruiter:/i.test(userMessage) && /Assistant:/i.test(userMessage);

    const shouldAppendUserMessage =
      options?.appendUserMessageToThread !== false && !looksLikeTranscript;

    console.log("shouldAppendUserMessage::", JSON.stringify(shouldAppendUserMessage, null, 2));
    if (shouldAppendUserMessage) {
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
   * When sendEvent is provided (e.g. from demo stream), planner streaming
   * is emitted as 'planner_text' events with { delta } for the client.
   */
  async generateRecruiterMessageFromThread(
    apiToken: string,
    threadId: string,
    options?: RecruiterMessageOptions,
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<RecruiterMessageResponse> {
    const thread = await this.assistantThreadService.getThread(apiToken, threadId);
    if (!thread) {
      throw new Error(`Assistant thread not found for id=${threadId}`);
    }

    const lastAssistantMessage = this.getLastAssistantMessageContent(thread.messages);
    const conversationSummaryParts = this.buildConversationSummary(thread.messages);

    const openai = await this.getOpenAIClientForPlanner(apiToken);
    const rawContent = await this.executePlannerLlmCall(
      openai,
      lastAssistantMessage,
      conversationSummaryParts,
      sendEvent,
    );
    const generatedUserMessage = this.parsePlannerResponse(rawContent);

    const recruiterMessageResponse = await this.generateRecruiterMessageWithToken(
      apiToken,
      threadId,
      generatedUserMessage,
      options,
    );

    if (!recruiterMessageResponse) {
      throw new Error('Failed to generate recruiter message');
    }
    return { ...recruiterMessageResponse, text: generatedUserMessage };
  }

  private async fetchJobContextForThread(
    apiToken: string,
    thread: { jobId?: string | null },
    options?: RecruiterMessageOptions,
  ) {
    if (options?.includeJobContext === false || !thread.jobId) {
      return null;
    }
    return this.jobContextService.fetchJobContext(apiToken, thread.jobId);
  }

  private getLastAssistantMessageContent(messages: Array<{ role: string; content: string }>): string {
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    const last = assistantMessages[assistantMessages.length - 1];
    return last?.content ?? '';
  }

  private buildConversationSummary(messages: Array<{ role: string; content: string }>): string[] {
    const recentMessages = messages.slice(-6);
    return recentMessages.map((m) => {
      const roleLabel = m.role === 'assistant' ? 'Assistant' : 'Recruiter';
      return `${roleLabel}: ${m.content}`;
    });
  }

  private buildPlannerSystemPrompt(): string {
    const job = `Salesforce Developer`;
    const jobDescription = `Salesforce Developer is a software engineer who is responsible for developing and maintaining Salesforce applications.`;
    const jobLocation = `San Francisco, CA`;
    const jobSalary = `100,000 - 120,000 USD`;
    const jobExperience = `5+ years`;
    const jobSkills = `Salesforce, Salesforce CRM, Salesforce Development, Salesforce Integration, Salesforce Customization`;
    const jobRequirements = `Salesforce Developer is a software engineer who is responsible for developing and maintaining Salesforce applications.`;
    const jobResponsibilities = `Salesforce Developer is a software engineer who is responsible for developing and maintaining Salesforce applications.`;
    const lines: string[] = [
      'You are a senior recruiter required to deliver a candidate shortlist to the client for a job they have mandated you.',
      `Job Description: ${jobDescription}`,
      `Job Location: ${jobLocation}`,
      `Job Salary: ${jobSalary}`,
      `Job Experience: ${jobExperience}`,
      `Job Skills: ${jobSkills}`,
      `Job Requirements: ${jobRequirements}`,
      `Job Responsibilities: ${jobResponsibilities}`,
      'Your job is to tell the assistant your requirements. You have to tell the recruiter the details of the job in terms of client details, salaries, location, years of experience, etc.',
       'You will tell the details of the ideal cancdidate that you are looking for. ',
       'When you receive a list of candidates you will work with the agent to shortlist the agent\'s shortlist and reach out to the candidates to get their CVs and other details. ',
       'You will then send the shortlist to the client for their approval. '
    ];
    return lines.join('\n');
  }

  private buildUserPrompt(userMessage: string, conversationSummaryParts: string[]): string {
    const lines: string[] = [
      'The recruiting assistant just responded to the assistant with the following message:',
      '',
      userMessage,
    ];
  lines.push(
    'Recent conversation between recruiter and assistant:',
    '',
    conversationSummaryParts.join('\n'),
    '',
  );
  return lines.join('\n');
}

  private async getOpenAIClientForPlanner(apiToken: string): Promise<OpenAI> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const { openAIclient } = await this.workspaceQueryService.initializeLLMClients(workspaceId);
    return openAIclient as OpenAI;
  }

  private readonly plannerSchema = z.object({
    message: z.string().min(1, 'Message must not be empty'),
  });

  private async executePlannerLlmCall(
    openai: OpenAI,
    userMessage: string,
    conversationSummaryParts: string[],
    sendEvent?: (event: string, data: unknown) => boolean | void,
  ): Promise<string | undefined> {
    const result = await this.streamProcessingService.executeStreamingLlmCall(
      () =>
        this.streamProcessingService.createStreamingCompletion(
          openai,
          [
            {
              role: 'system' as const,
              content:this.buildPlannerSystemPrompt()
            },
            { role: 'user' as const, content: this.buildUserPrompt(userMessage, conversationSummaryParts) },
          ],
          zodResponseFormat(this.plannerSchema, 'recruiterPlanner'),
          'gpt-4o',
        ),
      {
        chunkEventName: 'text',
        chunkPayloadKey: 'delta',
        sendEvent: sendEvent
          ? (_event, data) => sendEvent('planner_text', data)
          : undefined,
      },
    );
    const rawContent = typeof result === 'string' ? result : result.content;
    if (!rawContent) {
      this.logger.warn(
        'generateRecruiter MessageFromThread: empty content from streaming planner, falling back to default message.',
      );
    }
    return rawContent;
  }

  private parsePlannerResponse(rawContent: string | undefined): string {
    const fallback =
      'Continue progressing this search with the next one or two high-value actions.';
    if (!rawContent) return fallback;
    try {
      const parsed = JSON.parse(rawContent);
      const validated = this.plannerSchema.parse(parsed);
      return validated.message.trim() || fallback;
    } catch (error) {
      this.logger.warn(
        `generateRecruitervMessageFromThread: failed to parse planner JSON, using fallback message. Error: ${(error as Error).message}`,
      );
      return fallback;
    }
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

