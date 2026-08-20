import * as fs from 'fs';
import { UnipileV2Client } from 'src/engine/core-modules/unipile-client/unipile-v2.client';
import { getUnipileHttpErrorPayload } from 'src/engine/core-modules/unipile-client/get-unipile-http-error.util';
import {
    CandidateNode,
    ChatControlsObjType,
    ChatHistoryItem,
    Project,
    whatappUpdateMessageObjType
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { resolveWhatsappOutboundMessagesPerMinute, toWhatsappOutboundRateLimitJob } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limit.util';
import { getRegisteredWhatsappOutboundRateLimiter } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.registry';
import { WhatsappOutboundRateLimiterService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { normalizeWhatsAppOutboundMessage } from 'src/engine/core-modules/arx-chat/utils/whatsapp-message-format.util';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export class WhatsappUnipileMessagingService {
  private readonly unipileClient: UnipileV2Client;

  private resolveCandidatePrimaryPhone(candidate: CandidateNode): string | undefined {
    const fromPerson = candidate?.people?.phones?.primaryPhoneNumber;
    const fromCandidate = candidate?.phoneNumber?.primaryPhoneNumber;
    const raw = fromPerson || fromCandidate;
    const trimmed = raw?.trim();
    return trimmed || undefined;
  }

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService?: WorkspaceMemberProfileUnipileService,
    private readonly whatsappOutboundRateLimiter?: WhatsappOutboundRateLimiterService,
    baseUrl?: string,
    accessToken?: string,
  ) {
    this.unipileClient = new UnipileV2Client(baseUrl, accessToken);
  }

  private resolveRateLimiter(): WhatsappOutboundRateLimiterService | undefined {
    return (
      this.whatsappOutboundRateLimiter ??
      getRegisteredWhatsappOutboundRateLimiter()
    );
  }

  private async applyOutboundRateLimit(
    accountId: string,
    candidateJob?: Project | null,
  ): Promise<void> {
    const rateLimiter = this.resolveRateLimiter();
    if (!rateLimiter) {
      return;
    }

    const messagesPerMinute = resolveWhatsappOutboundMessagesPerMinute(
      toWhatsappOutboundRateLimitJob(candidateJob),
    );
    await rateLimiter.waitForOutboundSlot(accountId, messagesPerMinute);
  }

  private encodeAttachments(
    attachments?: Array<{ filename?: string; content_type?: string; data?: string; fileBuffer?: Buffer; mimetype?: string; fileName?: string }>,
  ) {
    if (!attachments?.length) {
      return undefined;
    }
    return attachments.map((attachment) => ({
      filename: attachment.filename || attachment.fileName || 'attachment',
      content_type:
        attachment.content_type || attachment.mimetype || 'application/octet-stream',
      data:
        attachment.data ||
        (attachment.fileBuffer
          ? attachment.fileBuffer.toString('base64')
          : ''),
    })).filter((item) => item.data);
  }

  /**
   * Project.recruiterId is the workspace member id of the assigned recruiter (see RecruiterProfileService).
   */
  private jobRecruiterAsWorkspaceMemberId(
    candidateJob: Project | undefined | null,
  ): string | null {
    const id = candidateJob?.recruiterId?.trim();
    return id || null;
  }

  /**
   * Resolve WhatsApp Unipile account id from workspace member profile.
   * Uses the job recruiter's (job creator) linked account first so outbound messages
   * match job ownership. Falls back to JWT workspaceMemberId only when the job has no
   * recruiterId (legacy rows / API-key-only flows).
   */
  private async resolveWhatsappUnipileAccountId(
    apiToken: string,
    candidateJob: Project | undefined | null,
  ): Promise<string | null> {
    if (!this.workspaceMemberProfileUnipileService) {
      return null;
    }
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const jobRecruiterId = this.jobRecruiterAsWorkspaceMemberId(candidateJob);
    const workspaceMemberIdFromToken =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);
    const workspaceMemberId =
      jobRecruiterId ?? workspaceMemberIdFromToken;
    return this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      workspaceId,
      apiToken,
      'whatsapp',
    );
  }

  /**
   * Send a plain text WhatsApp message to a phone number for a job context
   * (org-chart outreach) without loading a full CandidateNode or chat history.
   */
  async sendTextToPhoneForJob(
    apiToken: string,
    candidateJob: Project,
    phone: string,
    message: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    try {
      const whatsappAccountId = await this.resolveWhatsappUnipileAccountId(
        apiToken,
        candidateJob,
      );
      if (!whatsappAccountId) {
        return {
          status: 'failed',
          message: 'WhatsApp Unipile account not configured',
        };
      }
      const trimmed = phone.trim();
      if (!trimmed) {
        return { status: 'failed', message: 'Phone number required' };
      }
      const normalizedPhoneNumber = trimmed.replace(/[^\d+]/g, '');
      const attendeeId = `${normalizedPhoneNumber}@s.whatsapp.net`;
      await this.sendMessage(
        whatsappAccountId,
        [attendeeId],
        normalizeWhatsAppOutboundMessage(message),
        undefined,
        candidateJob,
      );
      return { status: 'success' };
    } catch (error) {
      console.error('sendTextToPhoneForJob failed:', error);
      return {
        status: 'failed',
        message:
          error instanceof Error ? error.message : 'Error sending WhatsApp message',
      };
    }
  }

  /**
   * Send a plain text WhatsApp message to a phone number without a job
   * context (e.g. ICP outreach). Resolves the Unipile account from the JWT's
   * workspace member.
   */
  async sendTextToPhoneForMember(
    apiToken: string,
    phone: string,
    message: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    try {
      const whatsappAccountId = await this.resolveWhatsappUnipileAccountId(
        apiToken,
        null,
      );
      if (!whatsappAccountId) {
        return {
          status: 'failed',
          message: 'WhatsApp Unipile account not configured',
        };
      }
      const trimmed = phone.trim();
      if (!trimmed) {
        return { status: 'failed', message: 'Phone number required' };
      }
      const normalizedPhoneNumber = trimmed.replace(/[^\d+]/g, '');
      const attendeeId = `${normalizedPhoneNumber}@s.whatsapp.net`;
      await this.sendMessage(
        whatsappAccountId,
        [attendeeId],
        normalizeWhatsAppOutboundMessage(message),
        undefined,
        null,
      );
      return { status: 'success' };
    } catch (error) {
      console.error('sendTextToPhoneForMember failed:', error);
      return {
        status: 'failed',
        message:
          error instanceof Error ? error.message : 'Error sending WhatsApp message',
      };
    }
  }

  /**
   * Send a WhatsApp message via Unipile
   */
  async sendMessage(
    accountId: string,
    attendeesIds: string[],
    message: string,
    attachments?: any[],
    candidateJob?: Project | null,
  ): Promise<any> {
    await this.applyOutboundRateLimit(accountId, candidateJob);

    return this.unipileClient.sendChat({
      accountId,
      usersIds: attendeesIds,
      text: message,
      attachments: this.encodeAttachments(attachments),
    });
  }

  async sendWhatsappMessageVIAUnipileAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    candidate: CandidateNode,
    candidateJob: Project,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {

    try {
      if (!candidate) {
        console.log('Candidate node not found, cannot proceed with sending the message');
        return { status: 'failed', message: 'Candidate node not found' };
      }

      const whatsappAccountId = await this.resolveWhatsappUnipileAccountId(
        apiToken,
        candidateJob,
      );

      if (!whatsappAccountId) {
        console.log(
          'WhatsApp Unipile account ID not found on workspace member profile (auth token or job recruiter)',
        );
        return { status: 'failed', message: 'WhatsApp Unipile account not configured' };
      }

      const phoneNumber = this.resolveCandidatePrimaryPhone(candidate);

      if (!phoneNumber) {
        console.log('Phone number not found for candidate');
        return { status: 'failed', message: 'Phone number not found for candidate' };
      }

      // Normalize phone number (remove any non-digit characters except +)
      const normalizedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
      // Append @s.whatsapp.net suffix required by Unipile API
      const attendeeId = `${normalizedPhoneNumber}@s.whatsapp.net`;
      
      const messageText = normalizeWhatsAppOutboundMessage(
        whatappUpdateMessageObj.messages[0].content ?? '',
      );

      console.log('Sending WhatsApp message via Unipile API in sendWhatsappMessageVIAUnipileAPI:', {
        accountId: whatsappAccountId,
        attendeeId,
        message: messageText,
      });

      // Send message
      const result = await this.sendMessage(
        whatsappAccountId,
        [attendeeId],
        messageText,
        undefined,
        candidateJob,
      );

      if (result) {
        // Update chat history
        const whatappUpdateMessageObjAfterUpdate = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateChatHistoryObjCreateChatMessageObj(
          `whatsapp_unipile_${Date.now()}`,
          candidate,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );

        await new UpdateChat(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateCandidateEngagementDataInTable(
          candidate,
          whatappUpdateMessageObjAfterUpdate,
          apiToken,
        );

        const updateCandidateStatusObj = await new UpdateChat(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateCandidateEngagementStatus(
          candidate,
          whatappUpdateMessageObj,
          apiToken,
        );
      }

      return { status: 'success' };
    } catch (error) {
      console.error('Error sending WhatsApp message via Unipile API:', error);
      return { status: 'failed', message: 'Error sending WhatsApp message' };
    }
  }

  /**
   * Send WhatsApp attachment message
   */
  async sendWhatsappAttachmentMessage(
    attachmentMessage: {
      phoneNumberTo: string;
      phoneNumberFrom: string;
      fileData: {
        fileName: string;
        filePath: string;
        mimetype: string;
        fileBuffer?: any;
      };
      message?: string;
    },
    candidate: CandidateNode,
    candidateJob: Project,
    apiToken: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    try {
      console.log('Sending WhatsApp attachment message via Unipile:', attachmentMessage);

      const whatsappAccountId = await this.resolveWhatsappUnipileAccountId(
        apiToken,
        candidateJob,
      );

      if (!whatsappAccountId) {
        console.log(
          'WhatsApp Unipile account ID not found on workspace member profile (auth token or job recruiter)',
        );
        return { status: 'failed', message: 'WhatsApp Unipile account not configured' };
      }

      const phoneNumber = this.resolveCandidatePrimaryPhone(candidate);

      if (!phoneNumber) {
        console.log('Phone number not found for candidate');
        return { status: 'failed', message: 'Phone number not found for candidate' };
      }

      // Normalize phone number
      const normalizedPhoneNumber = phoneNumber.replace(/[^\d+]/g, '');
      // Append @s.whatsapp.net suffix required by Unipile API
      const attendeeId = `${normalizedPhoneNumber}@s.whatsapp.net`;

      const messageText = attachmentMessage.message || 
        `Sharing JD with you`;

      let fileBuffer = attachmentMessage.fileData.fileBuffer;
      if (!fileBuffer && attachmentMessage.fileData.filePath) {
        try {
          fileBuffer = await fs.promises.readFile(attachmentMessage.fileData.filePath);
        } catch (error) {
          console.error('Error reading file from path:', error);
          return { status: 'failed', message: 'Failed to read file from path' };
        }
      }

      await this.applyOutboundRateLimit(whatsappAccountId, candidateJob);

      const response = await this.unipileClient.sendChat({
        accountId: whatsappAccountId,
        usersIds: [attendeeId],
        text: messageText,
        attachments: this.encodeAttachments(
          fileBuffer
            ? [
                {
                  fileName: attachmentMessage.fileData.fileName,
                  mimetype: attachmentMessage.fileData.mimetype,
                  fileBuffer,
                },
              ]
            : undefined,
        ),
      });

      console.log('WhatsApp attachment message sent successfully via Unipile:', response);
      return { status: 'success' };
    } catch (error: unknown) {
      const payload = getUnipileHttpErrorPayload(error);
      console.error('WhatsApp attachment message failed via Unipile:', payload);
      return { 
        status: 'failed', 
        message: payload.detail || payload.message 
      };
    }
  }
}

