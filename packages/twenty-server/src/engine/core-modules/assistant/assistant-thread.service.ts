import { Injectable } from '@nestjs/common';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type AssistantThreadMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
};

export type AssistantThreadTableData = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type AssistantThreadRecord = {
  id: string;
  name: string;
  workspaceId: string;
  messages: AssistantThreadMessage[];
  lastTableData: AssistantThreadTableData | null;
  createdAt: Date;
  updatedAt: Date;
};

const store = new Map<string, AssistantThreadRecord[]>();

function getKey(workspaceId: string): string {
  return `threads:${workspaceId}`;
}

@Injectable()
export class AssistantThreadService {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async listThreads(apiToken: string): Promise<{ id: string; name: string }[]> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const list = store.get(getKey(workspaceId)) ?? [];
    return list.map((t) => ({ id: t.id, name: t.name }));
  }

  async createThread(
    apiToken: string,
    name = 'New thread',
  ): Promise<{ id: string; name: string }> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const key = getKey(workspaceId);
    const list = store.get(key) ?? [];
    const id = crypto.randomUUID();
    const record: AssistantThreadRecord = {
      id,
      name,
      workspaceId,
      messages: [],
      lastTableData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    list.push(record);
    store.set(key, list);
    return { id, name: record.name };
  }

  async getThread(
    apiToken: string,
    threadId: string,
  ): Promise<AssistantThreadRecord | null> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const list = store.get(getKey(workspaceId)) ?? [];
    return list.find((t) => t.id === threadId) ?? null;
  }

  async appendMessage(
    apiToken: string,
    threadId: string,
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>,
  ): Promise<void> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const key = getKey(workspaceId);
    const list = store.get(key) ?? [];
    const thread = list.find((t) => t.id === threadId);
    if (!thread) return;
    thread.messages.push({ role, content, toolCalls });
    thread.updatedAt = new Date();
  }

  async setThreadTableData(
    apiToken: string,
    threadId: string,
    data: AssistantThreadTableData,
  ): Promise<void> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const key = getKey(workspaceId);
    const list = store.get(key) ?? [];
    const thread = list.find((t) => t.id === threadId);
    if (!thread) return;
    thread.lastTableData = data;
    thread.updatedAt = new Date();
  }
}
