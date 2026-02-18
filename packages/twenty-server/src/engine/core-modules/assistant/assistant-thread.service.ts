import { Injectable } from '@nestjs/common';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
  AssistantThreadRecord,
  AssistantThreadTableData
} from './assistant.types';

// TODO: Migrate to database-backed storage using metadata objects:
// - assistantThread (with fields: name, jobId, workingDirectoryPath)
// - assistantMessage (with fields: assistantThreadId, role, content, toolCalls, tableDataRef)
// - assistantThreadCandidate (with fields: assistantThreadId, candidateId, jobId, personId)
// These objects are defined in workspace-modifications/object-apis/data/objectsData.ts
// and will be created when workspace metadata is initialized.
// Use @InjectObjectMetadataRepository decorator and workspace entities for database access.

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
      candidateIds: [],
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

  async updateThreadName(
    apiToken: string,
    threadId: string,
    name: string,
  ): Promise<void> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const key = getKey(workspaceId);
    const list = store.get(key) ?? [];
    const thread = list.find((t) => t.id === threadId);
    if (!thread) return;
    thread.name = name;
    thread.updatedAt = new Date();
  }

  async setThreadCandidates(
    apiToken: string,
    threadId: string,
    candidateIds: string[],
  ): Promise<void> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const key = getKey(workspaceId);
    const list = store.get(key) ?? [];
    const thread = list.find((t) => t.id === threadId);
    if (!thread) return;
    // Merge with existing candidate IDs, avoiding duplicates
    const existing = new Set(thread.candidateIds);
    candidateIds.forEach((id) => existing.add(id));
    thread.candidateIds = Array.from(existing);
    thread.updatedAt = new Date();
  }

  async getThreadCandidates(
    apiToken: string,
    threadId: string,
  ): Promise<string[]> {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const list = store.get(getKey(workspaceId)) ?? [];
    const thread = list.find((t) => t.id === threadId);
    return thread?.candidateIds ?? [];
  }
}
