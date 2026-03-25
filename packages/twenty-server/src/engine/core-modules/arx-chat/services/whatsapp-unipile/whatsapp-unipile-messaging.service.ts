import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import {
  CandidateNode,
  ChatControlsObjType,
  ChatHistoryItem,
  Job,
  whatappUpdateMessageObjType
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export class WhatsappUnipileMessagingService {
  private baseUrl: string;
  private accessToken: string;

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
    baseUrl?: string,
    accessToken?: string,
  ) {
    this.baseUrl = baseUrl || process.env.UNIPILE_API_URL || '';
    this.accessToken = accessToken || process.env.UNIPILE_ACCESS_TOKEN || '';
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    isFormData: boolean = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-API-KEY': this.accessToken,
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const config: any = {
      method,
      url,
      headers,
    };

    if (data) {
      if (isFormData) {
        config.data = data;
      } else {
        config.data = JSON.stringify(data);
      }
    }

    try {
      console.log('WhatsApp Unipile API request:', { url, method, headers: Object.keys(headers) });
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('WhatsApp Unipile API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Job.recruiterId is the workspace member id of the assigned recruiter (see RecruiterProfileService).
   */
  private jobRecruiterAsWorkspaceMemberId(
    candidateJob: Job | undefined | null,
  ): string | null {
    const id = candidateJob?.recruiterId?.trim();
    return id || null;
  }

  /**
   * Resolve WhatsApp Unipile account id from workspace member profile.
   * Uses JWT workspaceMemberId when present; otherwise falls back to the job's recruiter
   * workspace member id (needed for API-key tokens from workers/cron).
   */
  private async resolveWhatsappUnipileAccountId(
    apiToken: string,
    candidateJob: Job | undefined | null,
  ): Promise<string | null> {
    if (!this.workspaceMemberProfileUnipileService) {
      return null;
    }
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const workspaceMemberIdFromToken =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);
    const workspaceMemberId =
      workspaceMemberIdFromToken ??
      this.jobRecruiterAsWorkspaceMemberId(candidateJob);
    return this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      workspaceId,
      apiToken,
      'whatsapp',
    );
  }

  /**
   * Send a WhatsApp message via Unipile
   */
  async sendMessage(
    accountId: string,
    attendeesIds: string[],
    message: string,
    attachments?: any[],
  ): Promise<any> {
    const formData = new FormData();
    
    formData.append('account_id', accountId);
    formData.append('attendees_ids', attendeesIds.join(','));
    formData.append('text', message);
    
    if (attachments && attachments.length > 0) {
      formData.append('attachments', JSON.stringify(attachments));
    }

    console.log('Sending WhatsApp message via Unipile API in sendMessage:', {
      accountId,
      attendeesIds,
      message,
      messageLength: message.length,
    });

    return this.makeRequest('/api/v1/chats', 'POST', formData, true);
  }

  async sendWhatsappMessageVIAUnipileAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    candidate: CandidateNode,
    candidateJob: Job,
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
      
      const messageText = whatappUpdateMessageObj.messages[0].content;
      
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
      );

      if (result) {
        // Update chat history
        const whatappUpdateMessageObjAfterUpdate = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateChatHistoryObjCreateWhatsappMessageObj(
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
    candidateJob: Job,
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

      // Create FormData for attachment
      const formData = new FormData();
      
      formData.append('account_id', whatsappAccountId);
      formData.append('attendees_ids', attendeeId);
      formData.append('text', messageText);
      
      // Add the file attachment
      let fileBuffer = attachmentMessage.fileData.fileBuffer;
      if (!fileBuffer && attachmentMessage.fileData.filePath) {
        // Read file from path if buffer not provided
        try {
          fileBuffer = await fs.promises.readFile(attachmentMessage.fileData.filePath);
        } catch (error) {
          console.error('Error reading file from path:', error);
          return { status: 'failed', message: 'Failed to read file from path' };
        }
      }
      
      if (fileBuffer) {
        formData.append('attachments', fileBuffer, {
          filename: attachmentMessage.fileData.fileName,
          contentType: attachmentMessage.fileData.mimetype,
        });
      }

      console.log('Sending WhatsApp message with attachment via Unipile:', {
        accountId: whatsappAccountId,
        attendeeId,
        message: messageText,
        fileName: attachmentMessage.fileData.fileName,
      });

      // Send message with attachment
      const response = await this.makeRequest('/api/v1/chats', 'POST', formData, true);

      console.log('WhatsApp attachment message sent successfully via Unipile:', response);
      return { status: 'success' };
    } catch (error: any) {
      console.error('WhatsApp attachment message failed via Unipile:', error.response?.data || error.message);
      return { 
        status: 'failed', 
        message: error.response?.data?.detail || error.message 
      };
    }
  }
}

