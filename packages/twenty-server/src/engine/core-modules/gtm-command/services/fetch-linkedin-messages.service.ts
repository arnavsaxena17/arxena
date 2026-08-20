import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import {
  isValidLinkedInProviderId,
  pickLinkedinAttendeeIdFromUnipileProfile,
} from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-attendee-id.util';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { GtmOutreachMessagePersistService } from 'src/engine/core-modules/gtm-command/services/gtm-outreach-message-persist.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberProfileRecord = ObjectLiteral & {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  linkedinUrl?: { primaryLinkUrl?: string } | null;
  linkedinProfileId?: string | null;
};

type UnipileChatHistorySyncStatus =
  | 'SYNC_STARTED'
  | 'CHAT_DELETED'
  | 'SYNC_RUNNING'
  | 'SYNC_DONE'
  | 'SYNC_ERROR';

type UnipileChatListResponse = {
  items?: Array<{ id: string; attendee_public_identifier?: string }>;
};

type UnipileChatHistorySyncResponse = {
  status?: UnipileChatHistorySyncStatus;
};

type UnipileMessageItem = {
  id?: string;
  text?: string | null;
  timestamp?: string;
  is_sender?: 0 | 1 | boolean;
  sender_id?: string;
  sender_attendee_id?: string;
  sender_public_identifier?: string;
  sender?: { attendee_id?: string; attendee_provider_id?: string };
};

type UnipileMessageListResponse = {
  items?: UnipileMessageItem[];
  cursor?: string | null;
};

export type FetchLinkedinMessagesInput = {
  workspaceMemberId?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  candidateId?: string;
  limit?: number;
};

export type FetchLinkedinMessageItem = {
  id: string;
  text: string;
  timestamp: string;
  senderId: string;
  isSender: boolean;
};

@Injectable()
export class FetchLinkedinMessagesService {
  private readonly logger = new Logger(FetchLinkedinMessagesService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly gtmOutreachMessagePersistService: GtmOutreachMessagePersistService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: FetchLinkedinMessagesInput;
  }): Promise<{
    success: boolean;
    chatId: string;
    attendeeId: string;
    total: number;
    messages: FetchLinkedinMessageItem[];
    error?: string;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);
    const limit = Math.min(Math.max(1, input.limit ?? 50), 250);

    const resolved = await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const profileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberProfileRecord>(
            workspaceId,
            'workspaceMemberProfile',
            { shouldBypassPermissionChecks: true },
          );

        let accountId = '';
        let workspaceMemberId = input.workspaceMemberId?.trim() ?? '';

        if (isNonEmptyString(workspaceMemberId)) {
          const profile = await profileRepository.findOne({
            where: { workspaceMemberId },
          });

          accountId = profile?.linkedinUnipileAccountId?.trim() ?? '';
        }

        if (!isNonEmptyString(accountId)) {
          const anyProfile = await profileRepository.find({
            where: {},
            take: 20,
          });
          const withAccount = anyProfile.find((row) =>
            isNonEmptyString(row.linkedinUnipileAccountId),
          );

          accountId = withAccount?.linkedinUnipileAccountId?.trim() ?? '';
          workspaceMemberId =
            withAccount?.workspaceMemberId ?? workspaceMemberId;
        }

        let identifier =
          extractLinkedinProfileId(input.linkedinProfileId) ||
          extractLinkedinProfileId(input.linkedinUrl);

        if (
          !isNonEmptyString(identifier) &&
          isNonEmptyString(input.candidateId)
        ) {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
              workspaceId,
              'candidate',
              { shouldBypassPermissionChecks: true },
            );
          const candidate = await candidateRepository.findOne({
            where: { id: input.candidateId },
          });

          identifier =
            extractLinkedinProfileId(candidate?.linkedinProfileId) ||
            extractLinkedinProfileId(candidate?.linkedinUrl?.primaryLinkUrl);
        }

        return { accountId, identifier };
      },
      authContext,
    );

    const empty = {
      success: false as const,
      chatId: '',
      attendeeId: '',
      total: 0,
      messages: [] as FetchLinkedinMessageItem[],
    };

    if (!isNonEmptyString(resolved.accountId)) {
      return {
        ...empty,
        error: 'No LinkedIn Unipile account on workspace member profile',
      };
    }

    if (!isNonEmptyString(resolved.identifier)) {
      return {
        ...empty,
        error: 'linkedinUrl or linkedinProfileId is required',
      };
    }

    try {
      const attendeeId = await this.resolveAttendeeId(
        resolved.accountId,
        resolved.identifier,
      );

      if (!isNonEmptyString(attendeeId)) {
        return {
          ...empty,
          error: 'Could not resolve LinkedIn attendee id',
        };
      }

      const chatId = await this.resolveChatId(resolved.accountId, attendeeId);

      if (isNonEmptyString(chatId)) {
        await this.triggerChatHistorySyncBestEffort(chatId);
      }

      const rawMessages = await this.fetchMessagesForAttendee(
        resolved.accountId,
        attendeeId,
        limit,
      );
      const messages = rawMessages.map((item) => this.mapMessage(item));

      try {
        await this.gtmOutreachMessagePersistService.mergeFetchedLinkedinMessages({
          workspaceId,
          candidateId: input.candidateId,
          linkedinProfileId: resolved.identifier,
          chatId,
          messages,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to merge LinkedIn history into messageObj: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      return {
        success: true,
        chatId: chatId ?? '',
        attendeeId,
        total: messages.length,
        messages,
        error: '',
      };
    } catch (error) {
      this.logger.error('fetch-linkedin-messages failed', error);

      return {
        ...empty,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async resolveAttendeeId(
    accountId: string,
    identifier: string,
  ): Promise<string> {
    if (isValidLinkedInProviderId(identifier)) {
      return identifier.trim();
    }

    const profile =
      await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
        accountId,
        identifier,
      );
    const fromProfile = pickLinkedinAttendeeIdFromUnipileProfile(profile);

    if (isNonEmptyString(fromProfile)) {
      return fromProfile;
    }

    return identifier.trim();
  }

  private async resolveChatId(
    accountId: string,
    attendeeId: string,
  ): Promise<string | undefined> {
    const encodedAttendee = encodeURIComponent(attendeeId);
    const response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
      `/api/v1/chat_attendees/${encodedAttendee}/chats?account_id=${encodeURIComponent(accountId)}&limit=10`,
    )) as UnipileChatListResponse;

    const chat =
      response.items?.find(
        (item) => item.attendee_public_identifier === attendeeId,
      ) ?? response.items?.[0];

    return chat?.id;
  }

  private async triggerChatHistorySyncBestEffort(chatId: string): Promise<void> {
    try {
      let response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        `/api/v1/chats/${encodeURIComponent(chatId)}/sync`,
      )) as UnipileChatHistorySyncResponse;

      const terminalStatuses: UnipileChatHistorySyncStatus[] = [
        'SYNC_DONE',
        'SYNC_ERROR',
        'CHAT_DELETED',
      ];

      let attempts = 0;
      while (
        isDefined(response.status) &&
        !terminalStatuses.includes(response.status) &&
        attempts < 5
      ) {
        await this.sleep(1500);
        response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
          `/api/v1/chats/${encodeURIComponent(chatId)}/sync`,
        )) as UnipileChatHistorySyncResponse;
        attempts += 1;
      }
    } catch (error) {
      this.logger.warn(
        `Chat history sync best-effort failed for ${chatId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async fetchMessagesForAttendee(
    accountId: string,
    attendeeId: string,
    limit: number,
  ): Promise<UnipileMessageItem[]> {
    const encodedAttendee = encodeURIComponent(attendeeId);
    const collected: UnipileMessageItem[] = [];
    let cursor: string | undefined;

    while (collected.length < limit) {
      const pageLimit = Math.min(250, limit - collected.length);
      const query = new URLSearchParams({
        account_id: accountId,
        limit: String(pageLimit),
      });
      if (cursor) {
        query.set('cursor', cursor);
      }

      const response = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        `/api/v1/chat_attendees/${encodedAttendee}/messages?${query.toString()}`,
      )) as UnipileMessageListResponse;

      const items = response.items ?? [];
      collected.push(...items);

      if (!response.cursor || items.length === 0) {
        break;
      }
      cursor = response.cursor;
    }

    return collected.slice(0, limit);
  }

  private mapMessage(item: UnipileMessageItem): FetchLinkedinMessageItem {
    const senderId =
      item.sender_id ??
      item.sender_attendee_id ??
      item.sender?.attendee_provider_id ??
      item.sender?.attendee_id ??
      item.sender_public_identifier ??
      '';

    return {
      id: item.id ?? '',
      text: typeof item.text === 'string' ? item.text : '',
      timestamp: item.timestamp ?? '',
      senderId,
      isSender: item.is_sender === 1 || item.is_sender === true,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
