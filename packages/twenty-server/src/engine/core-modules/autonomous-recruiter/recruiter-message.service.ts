import { Injectable, Logger } from '@nestjs/common';
import { AssistantThreadService } from '../assistant/assistant-thread.service';
import { RecruiterMessageOptions, RecruiterMessageResponse } from '../assistant/assistant.types';
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
  ) {}

  async generateRecruiterMessageWithWorkspace(
    workspaceId: string,
    schema: string,
    threadId: string,
    userMessage: string,
    options?: RecruiterMessageOptions,
  ): Promise<RecruiterMessageResponse> {
    const apiToken = await this.getApiTokenFromWorkspace(workspaceId, schema);
    return this.generateRecruiterMessageWithToken(apiToken, threadId, userMessage, options);
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

    const jobContext =
      options?.includeJobContext === false || !thread.jobId
        ? null
        : await this.jobContextService.fetchJobContext(apiToken, thread.jobId);

    const recruiterInstruction = buildRecruiterMessagePrompt({
      userMessage,
      jobContext,
      agentNotes: thread.agentNotes,
    });

    await this.assistantThreadService.appendMessage(
      apiToken,
      threadId,
      'user',
      recruiterInstruction,
    );

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

