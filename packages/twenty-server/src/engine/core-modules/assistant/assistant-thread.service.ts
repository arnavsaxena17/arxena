import { Injectable } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
    createOneAssistantThread,
    findManyAssistantThreads,
    findOneAssistantThread,
    updateOneAssistantThread
} from 'twenty-shared';
import {
    AssistantAgentEventRecord,
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

  async listThreads(
    apiToken: string,
  ): Promise<
    {
      id: string;
      name: string;
      jobId?: string;
      job?: { id: string; name?: string; jobLocation?: string; company?: { id: string; name?: string } };
      assistantMode?: 'fully_autonomous' | 'permissioned';
    }[]
  > {
    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
        apiToken,
      );
    if (!workspaceMemberId) {
      throw new Error('Failed to get workspace member ID');
    }
    const result = await this.staticGraphQLService.executeGraphQL(
      findManyAssistantThreads,
      {
        filter: { recruiterId: { eq: workspaceMemberId } },
        orderBy: [{ updatedAt: 'DescNullsFirst' }],
        limit: 100,
      },
      apiToken,
    );
    const edges = result?.data?.data?.assistantThreads?.edges ?? [];
    return edges.map(
      (e: {
        node: {
          id: string;
          name: string;
          jobId?: string;
          job?: { id: string; name?: string; jobLocation?: string; company?: { id: string; name?: string } };
          assistantMode?: 'fully_autonomous' | 'permissioned';
        };
      }) => ({
        id: e.node.id,
        name: e.node.name,
        jobId: e.node.jobId ?? undefined,
        job: e.node.job ?? undefined,
        assistantMode: e.node.assistantMode ?? 'permissioned',
      }),
    );
  }

  async createThread(
    apiToken: string,
    name = 'New thread',
    jobId?: string,
    assistantMode?: 'fully_autonomous' | 'permissioned',
  ): Promise<{
    id: string;
    name: string;
    jobId?: string;
    assistantMode?: 'fully_autonomous' | 'permissioned';
  }> {

    const workspaceMemberId =
    await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
      apiToken,
    );
    if (!workspaceMemberId) {
      throw new Error('Failed to get workspace member ID');
    }
    const input: {
      name: string;
      jobId?: string;
      recruiterId: string;
      assistantMode?: 'fully_autonomous' | 'permissioned';
    } = {
      name,
      jobId: jobId ?? undefined,
      recruiterId: workspaceMemberId,
    };
    if (jobId) input.jobId = jobId;
    if (assistantMode) input.assistantMode = assistantMode;
    const result = await this.staticGraphQLService.executeGraphQL(
      createOneAssistantThread,
      { input },
      apiToken,
    );
    const created = result.data.data.createAssistantThread;
    if (!created?.id) {
      throw new Error('Failed to create assistant thread');
    }
    return {
      id: created.id,
      name: created.name ?? name,
      jobId: created.jobId ?? jobId,
      assistantMode: created.assistantMode ?? assistantMode ?? 'permissioned',
    };
  }

  async getThread(
    apiToken: string,
    threadId: string,
  ): Promise<AssistantThreadRecord | null> {
    let result: any;
    try {
      result = await this.staticGraphQLService.executeGraphQL(
        findOneAssistantThread,
        { id: threadId },
        apiToken,
      );
      } catch (error: unknown) {
      console.log("getThread called: error::", error);
      const maybeError = error as { extensions?: { code?: string }; message?: string } | null;
      const code = maybeError?.extensions?.code;
      const message = maybeError?.message ?? '';
      if (code === 'NOT_FOUND' || /Record not found/i.test(message)) {
        return null;
      }

      throw error;
    }
    const node = result?.data.data.assistantThread;
    if (!node) return null;

    const messages: AssistantThreadMessage[] = Array.isArray(node.messages)
      ? (node.messages as AssistantThreadMessage[])
      : [];

    const agentNotes = Array.isArray(node.agentNotes)
      ? (node.agentNotes as Array<{ summary: string; createdAt?: string; id?: string }>).filter(
          (n) => n && typeof n.summary === 'string',
        )
      : undefined;

    const agentEventsRaw = Array.isArray(node.agentEvents)
      ? (node.agentEvents as Array<Partial<AssistantAgentEventRecord>>)
      : [];

    const agentEvents: AssistantAgentEventRecord[] | undefined = agentEventsRaw.length
      ? agentEventsRaw
          .filter((e) => typeof e?.status === 'string' && typeof e?.timestamp !== 'undefined')
          .map((e) => ({
            status: e.status as AssistantAgentEventRecord['status'],
            threadId: e.threadId,
            runId: e.runId,
            summary: e.summary,
            error: e.error,
            toolName: e.toolName,
            timestamp:
              typeof e.timestamp === 'number'
                ? e.timestamp
                : Number(e.timestamp) || Date.now(),
          }))
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
      job: node.job ?? undefined,
      agentNotes: agentNotes?.length ? agentNotes : undefined,
      agentEvents,
      assistantMode: node.assistantMode ?? 'permissioned',
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
      updateOneAssistantThread,
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
    const result = await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
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
      updateOneAssistantThread,
      { id: threadId, input: { jobId: jobId ?? undefined } },
      apiToken,
    );
  }

  async updateThreadAssistantMode(
    apiToken: string,
    threadId: string,
    assistantMode: 'fully_autonomous' | 'permissioned',
  ): Promise<void> {
    await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
      { id: threadId, input: { assistantMode } },
      apiToken,
    );
  }

  async setThreadTableData(
    apiToken: string,
    threadId: string,
    data: AssistantThreadTableData,
  ): Promise<void> {
    await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
      { id: threadId, input: { lastTableData: data } },
      apiToken,
    );
  }

  async deleteThread(
    apiToken: string,
    threadId: string,
  ): Promise<void> {
    const deleteAssistantThreadMutation = `
      mutation DeleteOneAssistantThread($idToDelete: ID!) {
        deleteAssistantThread(id: $idToDelete) {
          id
        }
      }
    `;

    await this.staticGraphQLService.executeGraphQL(
      deleteAssistantThreadMutation,
      { idToDelete: threadId },
      apiToken,
    );
  }

  async appendAgentEvent(
    apiToken: string,
    threadId: string,
    event: AssistantAgentEventRecord,
  ): Promise<void> {
    const thread = await this.getThread(apiToken, threadId);
    if (!thread) return;

    const existing = Array.isArray(thread.agentEvents)
      ? thread.agentEvents
      : [];
    const next = [...existing, event].slice(-100);

    await this.staticGraphQLService.executeGraphQL(
      updateOneAssistantThread,
      {
        id: threadId,
        input: { agentEvents: next },
      },
      apiToken,
    );
  }
}
