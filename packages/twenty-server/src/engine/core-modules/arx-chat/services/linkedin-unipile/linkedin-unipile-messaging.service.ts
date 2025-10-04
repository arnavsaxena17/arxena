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

/**
 * Truncates LinkedIn invitation message to under 300 characters
 * Creates a simplified version that maintains the core message
 */
function truncateLinkedInInvitationMessage(message: string): string {
  const maxLength = 300;
  
  if (message.length <= maxLength) {
    return message;
  }

  // Check if it contains "Global Recruitment" pattern - create a standardized short message
  if (message.includes('Global Recruitment') || message.includes('recruitment firm')) {
    return "Hi, I'm from Arxena Inc. We have a role that might interest you. Can we connect?";
  }

  // For other messages, try to preserve the key elements
  // Extract candidate name if present
  const nameMatch = message.match(/Hey (\w+),/);
  const candidateName = nameMatch ? nameMatch[1] : 'there';

  // Create a simplified message
  const simplifiedMessage = `Hi ${candidateName}, I'm from Arxena Inc. We have a role that might interest you. Can we connect?`;
  
  // If still too long, use the most basic version
  if (simplifiedMessage.length > maxLength) {
    return "Hi, I'm from Arxena Inc. We have a role that might interest you. Can we connect?";
  }

  return simplifiedMessage;
}

export class LinkedinUnipileMessagingService {
  private baseUrl: string;
  private accessToken: string;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
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
    isInMail?: boolean,
  ): Promise<any> {
    const formData = new FormData();
    
    formData.append('account_id', accountId);
    formData.append('attendees_ids', attendeesIds.join(','));
    formData.append('text', message);
    
    if (attachments && attachments.length > 0) {
      formData.append('attachments', JSON.stringify(attachments));
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

    // Add LinkedIn InMail specific parameters
    if (isInMail) {
      formData.append('linkedin[api]', 'classic');
      formData.append('linkedin[inmail]', 'true');
    }

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
    isInMail?: boolean,
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
        isInMail,
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
          // Truncate message for LinkedIn invitation (max 300 characters)
          const truncatedMessage = truncateLinkedInInvitationMessage(message);
          
          // Send invitation to each attendee
          for (const attendeeId of attendeesIds) {
            await this.sendInvitation(accountId, attendeeId, truncatedMessage);
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
        'linkedin_unipile_account_id',
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
   * Send LinkedIn InMail via API
   */
  async sendLinkedinInMailVIAUnipileAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    candidate: CandidateNode,
    candidateJob: Job,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    console.log('Sending LinkedIn InMail via Unipile API');

    try {
      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
        candidateJob,
        apiToken,
      );

      if (!candidate) {
        console.log('Candidate node not found, cannot proceed with sending the InMail');
        return { status: 'failed', message: 'Candidate node not found' };
      }

      // Get LinkedIn account ID from workspace settings
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'linkedin_unipile_account_id',
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
      
      console.log('Sending LinkedIn InMail:', {
        accountId: linkedinAccountId,
        attendeeId: linkedinProfileId,
        message: messageText,
      });

      // Send InMail (with isInMail = true)
      const result = await this.sendMessageOrInvitation(
        linkedinAccountId,
        [linkedinProfileId],
        messageText,
        undefined, // attachments
        undefined, // voiceMessage
        undefined, // videoMessage
        undefined, // subject
        true, // isInMail = true
      );

      if (result.status === 'success') {
        // Update chat history
        const whatappUpdateMessageObjAfterUpdate = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateChatHistoryObjCreateWhatsappMessageObj(
          `linkedin_inmail_${Date.now()}`,
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
      console.error('Error sending LinkedIn InMail via Unipile API:', error);
      return { status: 'failed', message: 'Error sending LinkedIn InMail' };
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
        'linkedin_unipile_account_id',
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

      const messageText = attachmentMessage.message || 
        `Sharing ${attachmentMessage.fileData.fileName} with you`;

      // Create FormData for attachment
      const formData = new FormData();
      
      formData.append('account_id', linkedinAccountId);
      formData.append('attendees_ids', linkedinProfileId);
      formData.append('text', messageText);
      
      // Add the file attachment
      if (attachmentMessage.fileData.fileBuffer) {
        formData.append('attachments', attachmentMessage.fileData.fileBuffer, {
          filename: attachmentMessage.fileData.fileName,
          contentType: attachmentMessage.fileData.mimetype,
        });
      }

      console.log('Sending LinkedIn message with attachment:', {
        accountId: linkedinAccountId,
        attendeeId: linkedinProfileId,
        message: messageText,
        fileName: attachmentMessage.fileData.fileName,
      });

      // Send message with attachment
      const response = await this.makeRequest('/api/v1/chats', 'POST', formData, true);

      console.log('LinkedIn attachment message sent successfully:', response);
      return { status: 'success' };
    } catch (error: any) {
      console.log('LinkedIn attachment message failed, checking for subscription error:', error.response?.data);
      
      // Check if it's a subscription required error (403)
      if (error.response?.status === 403 && 
          error.response?.data?.type === 'errors/subscription_required') {
        
        console.log('Subscription required, sending invitation instead');
        
        try {
          // Re-get the account and profile IDs for invitation fallback
          const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
          const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(
            workspaceId,
            'linkedin_unipile_account_id',
          );
          const linkedinProfileId = candidate.people?.linkedinLink?.primaryLinkUrl?.split('/').pop();
          
          if (!linkedinAccountId || !linkedinProfileId) {
            return { status: 'failed', message: 'Required LinkedIn account or profile not found' };
          }
          
          // Send invitation as fallback
          const messageText = attachmentMessage.message || 
            `Sharing ${attachmentMessage.fileData.fileName} with you`;
          
          await this.sendInvitation(linkedinAccountId, linkedinProfileId, messageText);
          
          console.log('LinkedIn invitation sent successfully');
          return { status: 'success' };
        } catch (inviteError: any) {
          console.error('LinkedIn invitation failed:', inviteError.response?.data || inviteError.message);
          return { 
            status: 'failed', 
            message: 'Failed to send both message and invitation' 
          };
        }
      } else {
        console.error('LinkedIn attachment message failed with non-subscription error:', error.response?.data || error.message);
        return { 
          status: 'failed', 
          message: error.response?.data?.detail || error.message 
        };
      }
    }
  }

  /**
   * Send LinkedIn InMail attachment message
   */
  async sendLinkedinInMailAttachmentMessage(
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
      console.log('Sending LinkedIn InMail attachment message:', attachmentMessage);

      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'linkedin_unipile_account_id',
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

      const messageText = attachmentMessage.message || 
        `Sharing ${attachmentMessage.fileData.fileName} with you`;

      let apiType = "classic";
        if (linkedinProfileId.includes("sales")){
          apiType = "sales_navigator";
        } else if (linkedinProfileId.includes("talent")){
          apiType = "recruiter";
        } else {
          apiType = "classic";
        }
      // Create FormData for InMail attachment
      const formData = new FormData();
      
      formData.append('account_id', linkedinAccountId);
      formData.append('attendees_ids', linkedinProfileId);
      formData.append('text', messageText);
      
      // Add LinkedIn InMail specific parameters
      formData.append('linkedin[api]', apiType);
      formData.append('linkedin[inmail]', 'true');
      
      // Add the file attachment
      if (attachmentMessage.fileData.fileBuffer) {
        formData.append('attachments', attachmentMessage.fileData.fileBuffer, {
          filename: attachmentMessage.fileData.fileName,
          contentType: attachmentMessage.fileData.mimetype,
        });
      }

      console.log('Sending LinkedIn InMail with attachment:', {
        accountId: linkedinAccountId,
        attendeeId: linkedinProfileId,
        message: messageText,
        fileName: attachmentMessage.fileData.fileName,
      });

      // Send InMail with attachment
      const response = await this.makeRequest('/api/v1/chats', 'POST', formData, true);

      console.log('LinkedIn InMail attachment message sent successfully:', response);
      return { status: 'success' };
    } catch (error: any) {
      console.log('LinkedIn InMail attachment message failed, checking for subscription error:', error.response?.data);
      
      // Check if it's a subscription required error (403)
      if (error.response?.status === 403 && 
          error.response?.data?.type === 'errors/subscription_required') {
        
        console.log('Subscription required, sending invitation instead');
        
        try {
          // Re-get the account and profile IDs for invitation fallback
          const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
          const linkedinAccountId = await this.workspaceQueryService.getWorkspaceApiKey(
            workspaceId,
            'linkedin_unipile_account_id',
          );
          const linkedinProfileId = candidate.people?.linkedinLink?.primaryLinkUrl?.split('/').pop();
          
          if (!linkedinAccountId || !linkedinProfileId) {
            return { status: 'failed', message: 'Required LinkedIn account or profile not found' };
          }
          
          // Send invitation as fallback
          const messageText = attachmentMessage.message || 
            `Sharing ${attachmentMessage.fileData.fileName} with you`;
          
          await this.sendInvitation(linkedinAccountId, linkedinProfileId, messageText);
          
          console.log('LinkedIn invitation sent successfully');
          return { status: 'success' };
        } catch (inviteError: any) {
          console.error('LinkedIn invitation failed:', inviteError.response?.data || inviteError.message);
          return { 
            status: 'failed', 
            message: 'Failed to send both InMail and invitation' 
          };
        }
      } else {
        console.error('LinkedIn InMail attachment message failed with non-subscription error:', error.response?.data || error.message);
        return { 
          status: 'failed', 
          message: error.response?.data?.detail || error.message 
        };
      }
    }
  }
}
