import { Injectable } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
    CandidateNode,
    Job,
    chatMessageType,
    whatappUpdateMessageObjType
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';
import { RecruiterProfileService } from '../recruiter-profile';
import { EngagedCandidateJobData } from './engaged-candidate-processor.job';
import { FilterCandidates } from './filter-candidates';
import { UpdateChat } from './update-chat';

@Injectable()
export class EngagedCandidateQueueService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly engagedCandidateMessageQueueService?: MessageQueueService,
  ) {}

  async queueCandidateForEngagement(
    candidateId: string,
    workspaceId: string,
    messageId?: string,
    isIncomingMessage: boolean = true, // Default to true since this is called from incoming messages
  ): Promise<void> {
    if (!this.engagedCandidateMessageQueueService) {
      console.warn(`Message queue service not available, skipping queue for candidate ${candidateId}`);
      return;
    }

    try {
      const jobData: EngagedCandidateJobData = {
        candidateId,
        workspaceId,
        timestamp: Date.now(),
        messageId,
        isIncomingMessage,
      };

      await this.engagedCandidateMessageQueueService.add<EngagedCandidateJobData>(
        'EngagedCandidateProcessor',
        jobData,
        {
          priority: 1,
          id: `engaged-candidate-${candidateId}-${Date.now()}`,
        },
      );

      console.log(`Queued candidate ${candidateId} for engagement processing`);
    } catch (error) {
      console.error(`Failed to queue candidate ${candidateId} for engagement:`, error);
    }
  }

  async queueCandidateForEngagementWithData(
    candidateId: string,
    interimChat: string,
    apiToken: string,
    chatControlType: string = 'startChat',
    isIncomingMessage: boolean = true, // Default to true for interim chat
  ): Promise<void> {
    if (!this.engagedCandidateMessageQueueService) {
      console.warn(`Message queue service not available, skipping queue for candidate ${candidateId}`);
      return;
    }

    try {
      const jobData: EngagedCandidateJobData = {
        candidateId,
        workspaceId: 'TBD', // Will be resolved in the worker
        timestamp: Date.now(),
        messageId: 'NA',
        interimChat,
        apiToken,
        chatControlType,
        isIncomingMessage,
      };

      console.log(`🔄 QUEUEING CANDIDATE FOR ENGAGEMENT: ${candidateId}`);
      console.log(`Job data: ${JSON.stringify(jobData, null, 2)}`);

      await this.engagedCandidateMessageQueueService.add<EngagedCandidateJobData>(
        'EngagedCandidateProcessor',
        jobData,
        {
          priority: 1,
          id: `engaged-candidate-${candidateId}-${Date.now()}`,
        },
      );

      console.log(`✅ Successfully queued candidate ${candidateId} for engagement processing with data`);
    } catch (error) {
      console.error(`❌ Failed to queue candidate ${candidateId} for engagement:`, error);
      throw error;
    }
  }

  /**
   * Process all engagement-related operations in the queue
   * This method consolidates all the heavy operations that were previously scattered
   */
  async processEngagementOperations(
    replyObject: {
      whatsappDeliveryStatus: string;
      chatReply: string;
      phoneNumberFrom: string;
      whatsappMessageId: string;
      databaseFilePath?: string | null;
      type?: string;
      isFromMe?: boolean;
      messageType?: string;
    },
    candidateProfileDataNodeObj: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ): Promise<whatappUpdateMessageObjType | null> {
    console.log("Processing engagement operations in queue for candidate:", candidateProfileDataNodeObj.id);
    
    try {
      // Step 1: Get recruiter profile
      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
        candidateJob,
        apiToken,
      );

      // Step 2: Get workspace ID and data source schema
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      if (!workspaceId) {
        throw new Error('No workspace ID found for processing engagement');
      }

      const dataSourceSchema = this.workspaceQueryService.getDataSourceSchema(workspaceId);

      // Step 3: Check for duplicate messages for this specific candidate and job context
      if (replyObject.whatsappMessageId && replyObject.chatReply) {
        // For messages with actual WhatsApp message IDs (not 'NA'), check by message ID
        if (replyObject.whatsappMessageId !== 'NA') {
          const duplicateCheckQuery = `SELECT id FROM ${dataSourceSchema}."_whatsappMessage" WHERE "whatsappMessageId" = $1 AND "message" = $2 LIMIT 1`;
          const duplicateResult = await this.workspaceQueryService.executeRawQuery(
            duplicateCheckQuery,
            [replyObject.whatsappMessageId, replyObject.chatReply],
            workspaceId,
          );
          
          if (duplicateResult.length > 0) {
            console.log('Message already exists in database, skipping creation. Message ID:', replyObject.whatsappMessageId);
            return null;
          }
        } else {
          // For interim messages (like 'startChat'), check by candidate ID, job ID, and message content
          // This allows the same message content for different jobs or candidates
          const candidateBasedDuplicateQuery = `
            SELECT id 
            FROM ${dataSourceSchema}."_whatsappMessage" 
            WHERE "message" = $1 
            AND "phoneFrom" = $2 
            AND "phoneTo" = $3
            AND "candidateId" = $4
            AND "jobsId" = $5
            LIMIT 1
          `;
          
          const duplicateResult = await this.workspaceQueryService.executeRawQuery(
            candidateBasedDuplicateQuery,
            [
              replyObject.chatReply,
              replyObject.phoneNumberFrom,
              candidateProfileDataNodeObj.people?.phones?.primaryPhoneNumber || '',
              candidateProfileDataNodeObj.id,
              candidateJob.id
            ],
            workspaceId,
          );
          
          if (duplicateResult.length > 0) {
            console.log(`Message '${replyObject.chatReply}' already exists for candidate ${candidateProfileDataNodeObj.id} and job ${candidateJob.id}, skipping creation`);
            return null;
          }
          
          console.log(`Message '${replyObject.chatReply}' is new for candidate ${candidateProfileDataNodeObj.id} and job ${candidateJob.id}, proceeding with creation`);
        }
      }

      // Step 4: Prepare message object
      const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;
      let mostRecentMessageObj;

      if (messagesList) {
        messagesList.sort(
          (a, b) =>
            new Date(b.node.createdAt).getTime() -
            new Date(a.node.createdAt).getTime(),
        );
        mostRecentMessageObj = messagesList[0]?.node.messageObj;
      } else {
        mostRecentMessageObj = candidateProfileDataNodeObj?.whatsappMessages.edges[0]?.node.messageObj;
      }

      // For startChat messages, create proper chat history with system prompt and user message
      if (replyObject.chatReply === 'startChat') {
        // Get the system prompt for startChat
        const { CandidateEngagementArx } = await import('./candidate-engagement');
        const candidateEngagement = CandidateEngagementArx.create(
          this.workspaceQueryService,
          this.staticGraphQLService,
        );
        
        const systemPrompt = await candidateEngagement.getSystemPrompt(
          candidateProfileDataNodeObj,
          candidateJob,
          { chatControlType: 'startChat' },
          apiToken,
        );

        // Create proper chat history for startChat
        mostRecentMessageObj = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'startChat' }
        ];
      } else if (mostRecentMessageObj?.length > 0) {
        mostRecentMessageObj.push({
          role: replyObject.isFromMe ? 'assistant' : 'user',
          content: replyObject.chatReply,
        });
      }

      // Step 5: Determine phone numbers based on messaging channel
      // Add null checks for people and phones properties
      let phoneNumberFrom: string = '';
      
      if (candidateProfileDataNodeObj.people?.phones?.primaryPhoneNumber) {
        phoneNumberFrom = candidateProfileDataNodeObj.people.phones.primaryPhoneNumber.length == 10
          ? '91' + candidateProfileDataNodeObj.people.phones.primaryPhoneNumber
          : candidateProfileDataNodeObj.people.phones.primaryPhoneNumber;
      } else {
        console.warn(`No phone number found for candidate ${candidateProfileDataNodeObj.id}, using empty string`);
      }

      if (candidateProfileDataNodeObj.people?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.messagingChannel == 'linkedin') {
        phoneNumberFrom = candidateProfileDataNodeObj.people?.linkedinLink?.primaryLinkUrl || '';
      }

      let phoneNumberTo: string = recruiterProfile?.phoneNumber || '';

      if (candidateProfileDataNodeObj.people?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.messagingChannel == 'linkedin') {
        phoneNumberTo = recruiterProfile?.linkedinUrl || '';
      }

      // Step 6: Create WhatsApp update message object
      const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
        id: uuidv4(),
        candidateProfile: candidateProfileDataNodeObj,
        whatsappMessageType: candidateProfileDataNodeObj?.whatsappProvider || '',
        candidateFirstName: candidateProfileDataNodeObj.name,
        phoneNumberFrom: phoneNumberFrom,
        phoneNumberTo: phoneNumberTo,
        messages: [{ content: replyObject.chatReply }],
        messageType: 'candidateMessage',
        messageObj: mostRecentMessageObj,
        lastEngagementChatControl: candidateProfileDataNodeObj?.lastEngagementChatControl,
        whatsappDeliveryStatus: replyObject.whatsappDeliveryStatus,
        whatsappMessageId: replyObject.whatsappMessageId,
        type: replyObject.type || 'text',
        databaseFilePath: replyObject?.databaseFilePath || '',
        typeOfMessage: candidateProfileDataNodeObj?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
      };

      // Step 7: Update candidate engagement data in table
      await new UpdateChat(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).updateCandidateEngagementDataInTable(candidateProfileDataNodeObj, whatappUpdateMessageObj, apiToken);

      // Step 8: For incoming messages, we don't set engagementStatus to false
      // because incoming messages should trigger engagement processing, not prevent it
      // Only outgoing messages (isFromMe: true) should set engagementStatus to false
      // to prevent duplicate sends

      console.log("Successfully processed engagement operations for candidate:", candidateProfileDataNodeObj.id);
      return whatappUpdateMessageObj;

    } catch (error) {
      console.error('Error processing engagement operations:', error);
      throw error;
    }
  }

  /**
   * Get candidate information and check for duplicates
   */
  async getCandidateInformationWithDuplicateCheck(
    whatsappIncomingMessage: chatMessageType,
    apiToken: string,
  ): Promise<{ candidateProfileData: CandidateNode; candidateJob: Job; isDuplicate: boolean }> {
    try {
      console.log('This is the whatsappIncomingMessage in getCandidateInformationWithDuplicateCheck::', whatsappIncomingMessage);
      // Get candidate information
      const candidateProfileData = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateInformation(whatsappIncomingMessage, apiToken);

      const candidateJob: Job = candidateProfileData.jobs;

      // Check for duplicate messages - but only for this specific candidate and job combination
      let isDuplicate = false;
      
      // Skip duplicate check for self-messages (messageFromSelf) as they are delivery confirmations
      if (whatsappIncomingMessage.messageType === 'messageFromSelf') {
        console.log('Skipping duplicate check for self-message (delivery confirmation)');
        return { candidateProfileData, candidateJob, isDuplicate: false };
      }
      
      if (candidateProfileData.id && candidateJob.id) {
        console.log(`Checking for duplicates for candidate ${candidateProfileData.id} (job ${candidateJob.id})`);
        console.log(`Incoming message: "${whatsappIncomingMessage.messages[0].content}"`);
        console.log(`Phone from: ${whatsappIncomingMessage.phoneNumberFrom}, Phone to: ${whatsappIncomingMessage.phoneNumberTo}`);
        
        // Since each candidate record is tied to a specific job, and we already have the right candidate
        // for this job, we can check if this exact message already exists for this candidate
        const existingMessages = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).fetchAllWhatsappMessages(candidateProfileData.id, apiToken);
        
        console.log(`Found ${existingMessages.length} existing messages for candidate ${candidateProfileData.id}`);
        
        // Debug: Log existing messages
        existingMessages.forEach((msg, index) => {
          console.log(`Existing message ${index + 1}:`, {
            message: msg.message,
            phoneFrom: msg.phoneFrom,
            phoneTo: msg.phoneTo,
            id: msg.id
          });
        });
        
        // Check if the exact same message content already exists for this candidate
        // Since candidateProfileData is already the correct candidate for the current job,
        // we just need to check for message duplication
        isDuplicate = existingMessages.some(msg => {
          const messageMatches = msg.message === whatsappIncomingMessage.messages[0].content;
          const participantsMatch = (
            (msg.phoneFrom === whatsappIncomingMessage.phoneNumberFrom.replace("+", "") && 
             msg.phoneTo === whatsappIncomingMessage.phoneNumberTo.replace("+", "")) ||
            (msg.phoneFrom === whatsappIncomingMessage.phoneNumberTo.replace("+", "") && 
             msg.phoneTo === whatsappIncomingMessage.phoneNumberFrom.replace("+", ""))
          );
          
          console.log(`Checking message "${msg.message}" against "${whatsappIncomingMessage.messages[0].content}": messageMatches=${messageMatches}, participantsMatch=${participantsMatch}`);
          
          return messageMatches && participantsMatch;
        });
        
        console.log(`Duplicate check for candidate ${candidateProfileData.id} (job ${candidateJob.id}): isDuplicate=${isDuplicate}`);
        console.log(`Message content: "${whatsappIncomingMessage.messages[0].content}", existing messages count: ${existingMessages.length}`);
      } else {
        console.log(`Skipping duplicate check - candidateProfileData.id: ${candidateProfileData.id}, candidateJob.id: ${candidateJob.id}`);
      }

      return { candidateProfileData, candidateJob, isDuplicate };
    } catch (error) {
      console.error('Error getting candidate information with duplicate check:', error);
      throw error;
    }
  }

  /**
   * Check for duplicate messages for a specific candidate without re-fetching candidate info
   * This is used when we already have the correct candidate and just need to check for duplicates
   */
  async checkMessageDuplicateForCandidate(
    candidateProfileData: CandidateNode,
    candidateJob: Job,
    messageContent: string,
    phoneNumberFrom: string,
    phoneNumberTo: string,
    apiToken: string,
  ): Promise<boolean> {
    try {
      if (!candidateProfileData.id || !candidateJob.id) {
        return false;
      }

      // Fetch existing messages for this specific candidate
      const existingMessages = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllWhatsappMessages(candidateProfileData.id, apiToken);
      
      // Check if the exact same message content already exists for this candidate
      const isDuplicate = existingMessages.some(msg => {
        const messageMatches = msg.message === messageContent;
        const participantsMatch = (
          (msg.phoneFrom === phoneNumberFrom.replace("+", "") && 
           msg.phoneTo === phoneNumberTo.replace("+", "")) ||
          (msg.phoneFrom === phoneNumberTo.replace("+", "") && 
           msg.phoneTo === phoneNumberFrom.replace("+", ""))
        );
        
        return messageMatches && participantsMatch;
      });
      
      console.log(`Duplicate check for candidate ${candidateProfileData.id} (job ${candidateJob.id}): isDuplicate=${isDuplicate}`);
      console.log(`Message content: "${messageContent}", existing messages count: ${existingMessages.length}`);
      
      return isDuplicate;
    } catch (error) {
      console.error('Error checking message duplicate for candidate:', error);
      return false; // If error, allow the message to proceed
    }
  }
}
