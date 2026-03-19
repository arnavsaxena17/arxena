import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { findOneAssistantThread, updateOneAssistantThread } from 'twenty-shared';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';

/** Thread context from assistantThread used where searchFilter was previously used. */
export type AssistantThreadContext = {
  id: string;
  jobId?: string;
  messages: Array<{ role: string; content: string; toolCalls?: unknown }>;
  assistantParameters?: {
    generatedSearchParameters?: Record<string, unknown>;
    resolvedSearchParameters?: Record<string, unknown>;
    pendingClarification?: { questions: string[]; timestamp?: string };
    [key: string]: unknown;
  };
  enrichmentConfigs?: Array<{
    id: string;
    selectedModel?: string;
    [key: string]: unknown;
  }>;
};

@Injectable()
export class AssistantThreadService {
  private readonly logger = new Logger(AssistantThreadService.name);

  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async getAssistantThreadContext(
    assistantThreadId: string,
    apiToken: string,
  ): Promise<AssistantThreadContext> {
    const graphQLResponse = await this.staticGraphQLService.executeGraphQL(
      findOneAssistantThread,
      { id: assistantThreadId },
      apiToken,
    );

    const node = graphQLResponse?.data?.data?.assistantThread;
    if (!node) {
      throw new HttpException(
        'Assistant thread not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const messages = Array.isArray(node.messages)
      ? (node.messages as Array<{
          role: string;
          content: string;
          toolCalls?: unknown;
        }>)
      : [];

    const enrichmentConfigs = Array.isArray(node.enrichmentConfigs)
      ? (node.enrichmentConfigs as AssistantThreadContext['enrichmentConfigs'])
      : undefined;

    return {
      id: node.id,
      jobId: node.jobId ?? undefined,
      messages,
      assistantParameters:
        node.assistantParameters && typeof node.assistantParameters === 'object'
          ? (node.assistantParameters as AssistantThreadContext['assistantParameters'])
          : undefined,
      enrichmentConfigs,
    };
  }

  async addChatMessage(
    assistantThreadId: string,
    role: 'user' | 'assistant',
    content: string,
    apiToken: string,
  ): Promise<void> {
    const thread = await this.getAssistantThreadContext(
      assistantThreadId,
      apiToken,
    );
    const newMessage = { role, content };
    const updatedMessages = [...thread.messages, newMessage];
    await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
      { id: assistantThreadId, input: { messages: updatedMessages } },
      apiToken,
    );
  }

  async updateAssistantThreadParameters(
    assistantThreadId: string,
    updatedAssistantParameters: AssistantThreadContext['assistantParameters'],
    messages: AssistantThreadContext['messages'],
    apiToken: string,
  ): Promise<void> {
    await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
      {
        id: assistantThreadId,
        input: {
          assistantParameters: updatedAssistantParameters ?? undefined,
          messages,
        },
      },
      apiToken,
    );
  }

  async storeClarificationContext(
    assistantThreadId: string,
    questions: string[],
    apiToken: string,
  ): Promise<void> {
    try {
      const thread = await this.getAssistantThreadContext(
        assistantThreadId,
        apiToken,
      );
      const assistantParameters = thread.assistantParameters ?? {};

      const updatedAssistantParameters = {
        ...assistantParameters,
        pendingClarification: {
          questions,
          timestamp: new Date().toISOString(),
        },
      };

      await this.updateAssistantThreadParameters(
        assistantThreadId,
        updatedAssistantParameters,
        thread.messages,
        apiToken,
      );
    } catch (error) {
      this.logger.error(`Failed to store clarification context: ${error}`);
    }
  }
}
