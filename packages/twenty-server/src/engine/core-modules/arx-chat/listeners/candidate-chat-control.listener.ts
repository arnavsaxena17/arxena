import { Injectable, Logger } from '@nestjs/common';

import { type ObjectRecordUpdateEvent } from 'twenty-shared/database-events';
import { isDefined } from 'twenty-shared/utils';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import {
  CANDIDATE_CHAT_START_CONTROL_FIELDS,
  UpdateChat,
} from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';

type CandidateChatControlRecord = {
  id?: string;
  startChat?: boolean | string | null;
  startVideoInterviewChat?: boolean | string | null;
  startMeetingSchedulingChat?: boolean | string | null;
  stopChat?: boolean | string | null;
};

const isChatControlOff = (value: unknown): boolean =>
  value === false ||
  value === null ||
  value === undefined ||
  value === 'false' ||
  value === '';

const isChatControlOn = (value: unknown): boolean =>
  value === true || value === 'true';

@Injectable()
export class CandidateChatControlListener {
  private readonly logger = new Logger(CandidateChatControlListener.name);

  constructor(
    private readonly updateChat: UpdateChat,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  @OnDatabaseBatchEvent('candidate', DatabaseEventAction.UPDATED)
  async handleCandidateUpdated(
    payload: WorkspaceEventBatch<
      ObjectRecordUpdateEvent<CandidateChatControlRecord>
    >,
  ) {
    const chatStartsToQueue: Array<{
      candidateId: string;
      chatControlType: string;
    }> = [];

    for (const event of payload.events) {
      const candidateId = event.recordId;
      if (!isDefined(candidateId)) {
        continue;
      }

      const updatedFields = event.properties?.updatedFields ?? [];
      const diff = event.properties?.diff ?? {};

      for (const chatControlType of CANDIDATE_CHAT_START_CONTROL_FIELDS) {
        if (!updatedFields.includes(chatControlType)) {
          continue;
        }

        const fieldDiff = diff[chatControlType as keyof typeof diff] as
          | { before?: unknown; after?: unknown }
          | undefined;
        const beforeValue =
          fieldDiff?.before ??
          event.properties?.before?.[
            chatControlType as keyof CandidateChatControlRecord
          ];
        const afterValue =
          fieldDiff?.after ??
          event.properties?.after?.[
            chatControlType as keyof CandidateChatControlRecord
          ];

        if (isChatControlOff(beforeValue) && isChatControlOn(afterValue)) {
          chatStartsToQueue.push({ candidateId, chatControlType });
        }
      }
    }

    if (chatStartsToQueue.length === 0) {
      return;
    }

    const apiToken = await this.getWorkspaceApiToken(payload.workspaceId);
    if (!isDefined(apiToken)) {
      this.logger.warn(
        `No API token for workspace ${payload.workspaceId}; skipping chat-control start for ${chatStartsToQueue.length} candidate(s)`,
      );
      return;
    }

    for (const { candidateId, chatControlType } of chatStartsToQueue) {
      try {
        this.logger.log(
          `Candidate ${candidateId} ${chatControlType} flipped on via record edit; queuing interim chat`,
        );
        await this.updateChat.createInterimChatQueue(
          chatControlType,
          candidateId,
          apiToken,
          { chatControlType },
        );
      } catch (error) {
        this.logger.error(
          `Failed to queue ${chatControlType} for candidate ${candidateId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  private async getWorkspaceApiToken(
    workspaceId: string,
  ): Promise<string | null> {
    try {
      const schema =
        this.workspaceQueryService.workspaceDataSourceService.getSchemaName(
          workspaceId,
        );
      const apiKeys = await this.workspaceQueryService.getApiKeys(
        workspaceId,
        schema,
      );
      if (!apiKeys?.length) {
        return null;
      }

      const token =
        await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
          workspaceId,
          apiKeys[0].id,
        );

      return token?.token ?? null;
    } catch (error) {
      this.logger.error(
        `Failed to generate API token for workspace ${workspaceId}`,
        error instanceof Error ? error.stack : error,
      );
      return null;
    }
  }
}
