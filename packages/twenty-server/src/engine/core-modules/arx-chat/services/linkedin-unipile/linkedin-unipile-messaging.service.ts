import axios from 'axios';
import FormData from 'form-data';
import {
    CandidateNode,
    ChatControlsObjType,
    ChatHistoryItem,
    Job,
    whatappUpdateMessageObjType
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export class LinkedinUnipileMessagingService {
  private baseUrl: string;
  private accessToken: string;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    baseUrl?: string,
    accessToken?: string,
  ) {
    this.baseUrl = baseUrl || process.env.UNIPILE_API_URL || 'https://api18.unipile.com:14823';
    this.accessToken = accessToken || process.env.UNIPILE_ACCESS_TOKEN || 'jzS7Uh0w.rfsm3/s0r5zinYIGCmQ0bOSo2PS4UWtXBKMCY5xG4Lw=';
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
      console.log('LinkedIn Unipile API request:', { url, method, headers: Object.keys(headers) });
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('LinkedIn Unipile API request failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a LinkedIn message
   */
  async sendMessage(
    accountId: string,
    attendeesIds: string[],
    message: string,
    attachments?: any[],
    voiceMessage?: any,
    videoMessage?: any,
    subject?: string,
  ): Promise<any> {
    const formData = new FormData();
    
    formData.append('account_id', accountId);
    formData.append('attendees_ids', attendeesIds.join(','));
    formData.append('text', message);
    
    if (attachments && attachments.length > 0) {
      formData.append('attachments', JSON.stringify(attachments));
    } else {
      formData.append('attachments', '');
    }
    
    if (voiceMessage) {
      formData.append('voice_message', voiceMessage);
    }
    
    if (videoMessage) {
      formData.append('video_message', videoMessage);
    }
    
    if (subject) {
      formData.append('subject', subject);
    }
    
    formData.append('linkedin', '{}');

    return this.makeRequest('/api/v1/chats', 'POST', formData, true);
  }

  /**
   * Send a LinkedIn invitation
   */
  async sendInvitation(
    accountId: string,
    providerId: string,
    message: string,
  ): Promise<any> {
    const data = {
      provider_id: providerId,
      account_id: accountId,
      message: message,
    };

    return this.makeRequest('/api/v1/users/invite', 'POST', data);
  }

  /**
   * Send message or invitation based on response
   */
  async sendMessageOrInvitation(
    accountId: string,
    attendeesIds: string[],
    message: string,
    attachments?: any[],
    voiceMessage?: any,
    videoMessage?: any,
    subject?: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string; method?: 'message' | 'invitation' }> {
    try {
      // First try to send a message
      const response = await this.sendMessage(
        accountId,
        attendeesIds,
        message,
        attachments,
        voiceMessage,
        videoMessage,
        subject,
      );

      console.log('LinkedIn message sent successfully:', response);
      return { status: 'success', method: 'message' };
    } catch (error: any) {
      console.log('LinkedIn message failed, checking for subscription error:', error.response?.data);
      
      // Check if it's a subscription required error (403)
      if (error.response?.status === 403 && 
          error.response?.data?.type === 'errors/subscription_required') {
        
        console.log('Subscription required, sending invitation instead');
        
        try {
          // Send invitation to each attendee
          for (const attendeeId of attendeesIds) {
            await this.sendInvitation(accountId, attendeeId, message);
          }
          
          console.log('LinkedIn invitations sent successfully');
          return { status: 'success', method: 'invitation' };
        } catch (inviteError: any) {
          console.error('LinkedIn invitation failed:', inviteError.response?.data || inviteError.message);
          return { 
            status: 'failed', 
            message: 'Failed to send both message and invitation' 
          };
        }
      } else {
        console.error('LinkedIn message failed with non-subscription error:', error.response?.data || error.message);
        return { 
          status: 'failed', 
          message: error.response?.data?.detail || error.message 
        };
      }
    }
  }

  /**
   * Send LinkedIn message via API (similar to Facebook WhatsApp API)
   */
  async sendLinkedinMessageVIAUnipileAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    candidate: CandidateNode,
    candidateJob: Job,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    console.log('Sending LinkedIn message via Unipile API');

    try {
      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
        candidateJob,
        apiToken,
      );

      if (!candidate) {
        console.log('Candidate node not found, cannot proceed with sending the message');
        return { status: 'failed', message: 'Candidate node not found' };
      }

      // Get LinkedIn account ID from workspace settings
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'linkedin_account_id',
      );

      if (!linkedinAccountId) {
        console.log('LinkedIn account ID not found in workspace settings');
        return { status: 'failed', message: 'LinkedIn account not configured' };
      }

      // Get the LinkedIn profile ID for the candidate
      const linkedinProfileId = candidate.people?.linkedinLink?.primaryLinkUrl?.split('/').pop();
      
      if (!linkedinProfileId) {
        console.log('LinkedIn profile ID not found for candidate');
        return { status: 'failed', message: 'LinkedIn profile not found for candidate' };
      }

      const messageText = whatappUpdateMessageObj.messages[0].content;
      
      console.log('Sending LinkedIn message:', {
        accountId: linkedinAccountId,
        attendeeId: linkedinProfileId,
        message: messageText,
      });

      // Send message or invitation
      const result = await this.sendMessageOrInvitation(
        linkedinAccountId,
        [linkedinProfileId],
        messageText,
      );

      if (result.status === 'success') {
        // Update chat history
        const whatappUpdateMessageObjAfterUpdate = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateChatHistoryObjCreateWhatsappMessageObj(
          `linkedin_${Date.now()}`,
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

      return result;
    } catch (error) {
      console.error('Error sending LinkedIn message via Unipile API:', error);
      return { status: 'failed', message: 'Error sending LinkedIn message' };
    }
  }

  /**
   * Send LinkedIn attachment message
   */
  async sendLinkedinAttachmentMessage(
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
      console.log('Sending LinkedIn attachment message:', attachmentMessage);

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'linkedin_account_id',
      );

      if (!linkedinAccountId) {
        console.log('LinkedIn account ID not found in workspace settings');
        return { status: 'failed', message: 'LinkedIn account not configured' };
      }

      const linkedinProfileId = candidate.people?.linkedinLink?.primaryLinkUrl?.split('/').pop();
      
      if (!linkedinProfileId) {
        console.log('LinkedIn profile ID not found for candidate');
        return { status: 'failed', message: 'LinkedIn profile not found for candidate' };
      }

      // For now, LinkedIn Unipile API doesn't support file attachments directly
      // We'll send a text message with file information
      const messageText = attachmentMessage.message || 
        `Sharing ${attachmentMessage.fileData.fileName} with you`;

      const result = await this.sendMessageOrInvitation(
        linkedinAccountId,
        [linkedinProfileId],
        messageText,
      );

      return result;
    } catch (error) {
      console.error('Error sending LinkedIn attachment message:', error);
      return { status: 'failed', message: 'Error sending LinkedIn attachment message' };
    }
  }
}
