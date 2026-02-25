import { Injectable } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
  createAssistantThread,
  findManyAssistantThreads,
  findOneAssistantThread,
  updateAssistantThread,
} from 'twenty-shared';
import {
  AssistantThreadRecord,
  AssistantThreadTableData,
} from './assistant.types';

type AssistantThreadMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
};

@Injectable()
export class AssistantThreadService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async listThreads(apiToken: string): Promise<{ id: string; name: string; jobId?: string }[]> {
    const result = await this.staticGraphQLService.executeGraphQL(
      findManyAssistantThreads,
      { orderBy: [{ updatedAt: 'Desc' }], limit: 100 },
      apiToken,
    );
    const edges = result?.assistantThreads?.edges ?? [];
    return edges.map((e: { node: { id: string; name: string; jobId?: string } }) => ({
      id: e.node.id,
      name: e.node.name,
      jobId: e.node.jobId ?? undefined,
    }));
  }

  async createThread(
    apiToken: string,
    name = 'New thread',
    jobId?: string,
  ): Promise<{ id: string; name: string; jobId?: string }> {
    const input: { name: string; jobId?: string } = { name };
    if (jobId) input.jobId = jobId;
    const result = await this.staticGraphQLService.executeGraphQL(
      createAssistantThread,
      { input },
      apiToken,
    );
    const created = result?.createAssistantThread;
    if (!created?.id) {
      throw new Error('Failed to create assistant thread');
    }
    return {
      id: created.id,
      name: created.name ?? name,
      jobId: created.jobId ?? jobId,
    };
  }

  async getThread(
    apiToken: string,
    threadId: string,
  ): Promise<AssistantThreadRecord | null> {
    const result = await this.staticGraphQLService.executeGraphQL(
      findOneAssistantThread,
      { id: threadId },
      apiToken,
    );
    const node = result?.assistantThread;
    if (!node) return null;

    const messages: AssistantThreadMessage[] = Array.isArray(node.messages)
      ? (node.messages as AssistantThreadMessage[])
      : [];

    const agentNotes = Array.isArray(node.agentNotes)
      ? (node.agentNotes as Array<{ summary: string; createdAt?: string; id?: string }>).filter(
          (n) => n && typeof n.summary === 'string',
        )
      : undefined;

    return {
      id: node.id,
      name: node.name ?? 'New thread',
      workspaceId: '', // not stored per-thread; resolved from token when needed
      messages,
      lastTableData:
        node.lastTableData && typeof node.lastTableData === 'object'
          ? (node.lastTableData as AssistantThreadTableData)
          : null,
      createdAt: node.createdAt ? new Date(node.createdAt) : new Date(),
      updatedAt: node.updatedAt ? new Date(node.updatedAt) : new Date(),
      jobId: node.jobId ?? undefined,
      agentNotes: agentNotes?.length ? agentNotes : undefined,
    };
  }

  async appendMessage(
    apiToken: string,
    threadId: string,
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>,
  ): Promise<void> {
    const thread = await this.getThread(apiToken, threadId);
    if (!thread) return;

    const newMessages: AssistantThreadMessage[] = [
      ...thread.messages,
      { role, content, toolCalls },
    ];

    await this.staticGraphQLService.executeGraphQL(
      updateAssistantThread,
      {
        id: threadId,
        input: { messages: newMessages },
      },
      apiToken,
    );
  }

  async updateThreadName(
    apiToken: string,
    threadId: string,
    name: string,
  ): Promise<void> {
    await this.staticGraphQLService.executeGraphQL(
      updateAssistantThread,
      { id: threadId, input: { name } },
      apiToken,
    );
  }

  async updateThreadJobId(
    apiToken: string,
    threadId: string,
    jobId: string | null,
  ): Promise<void> {
    await this.staticGraphQLService.executeGraphQL(
      updateAssistantThread,
      { id: threadId, input: { jobId: jobId ?? undefined } },
      apiToken,
    );
  }

  async setThreadTableData(
    apiToken: string,
    threadId: string,
    data: AssistantThreadTableData,
  ): Promise<void> {
    await this.staticGraphQLService.executeGraphQL(
      updateAssistantThread,
      { id: threadId, input: { lastTableData: data } },
      apiToken,
    );
  }
}
