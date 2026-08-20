import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Project } from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { WhatsappUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

type UnipileChatHistorySyncStatus =
  | 'SYNC_STARTED'
  | 'CHAT_DELETED'
  | 'SYNC_RUNNING'
  | 'SYNC_DONE'
  | 'SYNC_ERROR';

type UnipileChatHistorySyncResponse = {
  object: 'ChatHistorySync';
  chat_id: string;
  status: UnipileChatHistorySyncStatus;
};

type UnipileChatListResponse = {
  object: 'ChatList';
  items: Array<{ id: string; attendee_public_identifier?: string }>;
  cursor?: string | null;
};

export type UnipileSyncMessageItem = {
  id: string;
  provider_id?: string;
  text?: string | null;
  is_sender?: 0 | 1;
  timestamp?: string;
  chat_id?: string;
  chat_provider_id?: string;
  account_id?: string;
  attachments?: Array<{ type?: string; unavailable?: boolean }>;
  is_event?: 0 | 1;
  deleted?: 0 | 1;
  sender_public_identifier?: string;
};

type UnipileMessageListResponse = {
  object: 'MessageList';
  items: UnipileSyncMessageItem[];
  cursor?: string | null;
};

export type WhatsappUnipileSyncResult = {
  phoneNumber: string;
  candidateId: string;
  accountId: string;
  chatId?: string;
  totalMessages: number;
  synced: number;
  skipped: number;
  errors: number;
  message: string;
};

@Injectable()
export class WhatsappUnipileSyncService {
  private readonly logger = new Logger(WhatsappUnipileSyncService.name);

  constructor(
    private readonly unipileRequestService: WhatsappUnipileRequestService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
  ) {}

  normalizePhoneDigits(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  toWhatsappAttendeeId(phone: string): string {
    const digits = this.normalizePhoneDigits(phone);
    if (!digits) {
      return '';
    }
    return `${digits}@s.whatsapp.net`;
  }

  async syncMessagesForCandidate(input: {
    phoneNumber: string;
    candidateId: string;
    apiToken: string;
    limit?: number;
  }): Promise<WhatsappUnipileSyncResult> {
    const { phoneNumber, candidateId, apiToken } = input;
    const limit = input.limit ?? 250;

    const candidate = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateDetailsById(candidateId, apiToken);

    if (!candidate) {
      throw new HttpException('Candidate not found', HttpStatus.NOT_FOUND);
    }

    const candidateJob = candidate.projects as Project | undefined;
    if (!candidateJob?.id) {
      throw new HttpException(
        'Candidate job not found for sync',
        HttpStatus.BAD_REQUEST,
      );
    }

    const whatsappAccountId = await this.resolveWhatsappUnipileAccountId(
      apiToken,
      candidateJob,
    );

    if (!whatsappAccountId) {
      throw new HttpException(
        'WhatsApp Unipile account not configured for this job recruiter',
        HttpStatus.BAD_REQUEST,
      );
    }

    const recruiterProfile = await new RecruiterProfileService(
      this.staticGraphQLService,
    ).getRecruiterProfileByJob(candidateJob, apiToken);

    let recruiterPhone = recruiterProfile?.phoneNumber?.trim() || '';
    if (!recruiterPhone) {
      const account = (await this.unipileRequestService.makeUnipileRequest(
        `/v2/accounts/${encodeURIComponent(whatsappAccountId)}`,
      )) as {
        connection_params?: { im?: { phone_number?: string } };
        phone_number?: string;
      };
      recruiterPhone =
        account.connection_params?.im?.phone_number?.trim() ||
        account.phone_number?.trim() ||
        '';
    }

    const attendeeId = this.toWhatsappAttendeeId(phoneNumber);
    if (!attendeeId) {
      throw new HttpException('Invalid phone number', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(
      `Syncing Unipile WhatsApp messages for candidate ${candidateId}, attendee ${attendeeId}, account ${whatsappAccountId}`,
    );

    const chatId = await this.resolveChatId(whatsappAccountId, attendeeId);
    if (chatId) {
      await this.triggerChatHistorySyncBestEffort(chatId);
    }

    const unipileMessages = await this.fetchMessagesForAttendee(
      whatsappAccountId,
      attendeeId,
      limit,
    );

    const updateChat = new UpdateChat(
      this.workspaceQueryService,
      this.staticGraphQLService,
    );

    const syncResult = await updateChat.syncUnipileMessagesWithDatabase(
      unipileMessages,
      candidateId,
      apiToken,
      {
        candidatePhone: phoneNumber,
        recruiterPhone,
      },
    );

    return {
      phoneNumber,
      candidateId,
      accountId: whatsappAccountId,
      chatId,
      totalMessages: unipileMessages.length,
      synced: syncResult.synced,
      skipped: syncResult.skipped,
      errors: syncResult.errors,
      message: `Synced ${syncResult.synced} messages, skipped ${syncResult.skipped} duplicates, ${syncResult.errors} errors`,
    };
  }

  private async resolveWhatsappUnipileAccountId(
    apiToken: string,
    candidateJob: Project,
  ): Promise<string | null> {
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const recruiterId = candidateJob.recruiterId?.trim();
    const workspaceMemberIdFromToken =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);
    const workspaceMemberId = recruiterId ?? workspaceMemberIdFromToken;

    return this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      workspaceId,
      apiToken,
      'whatsapp',
    );
  }

  private async resolveChatId(
    accountId: string,
    attendeeId: string,
  ): Promise<string | undefined> {
    const encodedAttendee = encodeURIComponent(attendeeId);
    const chatLookup = (await this.unipileRequestService.makeUnipileRequest(
      `/v2/${encodeURIComponent(accountId)}/users/${encodedAttendee}/chats?limit=10`,
    )) as {
      id?: string;
      items?: Array<{ id: string }>;
      data?: Array<{ id: string }>;
    };
    return (
      chatLookup.id ??
      chatLookup.items?.[0]?.id ??
      chatLookup.data?.[0]?.id
    );
  }

  private async triggerChatHistorySyncBestEffort(_chatId: string): Promise<void> {
    return;
  }

  async fetchMessagesForAttendee(
    accountId: string,
    attendeeId: string,
    limit: number,
  ): Promise<UnipileSyncMessageItem[]> {
    const chatId = await this.resolveChatId(accountId, attendeeId);
    if (!chatId) {
      return [];
    }
    const collected: UnipileSyncMessageItem[] = [];
    let cursor: string | undefined;

    while (collected.length < limit) {
      const pageLimit = Math.min(250, limit - collected.length);
      const query = new URLSearchParams({
        user_id: attendeeId,
        limit: String(pageLimit),
      });
      if (cursor) {
        query.set('cursor', cursor);
      }
      const response = (await this.unipileRequestService.makeUnipileRequest(
        `/v2/${encodeURIComponent(accountId)}/chats/${encodeURIComponent(chatId)}/messages?${query.toString()}`,
      )) as UnipileMessageListResponse & { data?: UnipileSyncMessageItem[]; next_cursor?: string };

      const items = response.items ?? response.data ?? [];
      collected.push(...items);
      const nextCursor = response.cursor ?? response.next_cursor;
      if (!nextCursor || items.length === 0) {
        break;
      }
      cursor = nextCursor;
    }

    return collected.slice(0, limit);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
