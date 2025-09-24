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

      // Step 3: Check for duplicate messages
      if (replyObject.whatsappMessageId && replyObject.chatReply) {
        const duplicateCheckQuery = `SELECT id FROM ${dataSourceSchema}."_whatsappMessage" WHERE "whatsappMessageId" = $1 AND "message" = $2 LIMIT 1`;
        const duplicateResult = await this.workspaceQueryService.executeRawQuery(
          duplicateCheckQuery,
          [replyObject.whatsappMessageId, replyObject.chatReply],
          workspaceId,
        );
        
        if (duplicateResult.length > 0 && replyObject.whatsappMessageId !== 'NA') {
          console.log('Message already exists in database, skipping creation. Message ID:', replyObject.whatsappMessageId);
          return null;
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
      let phoneNumberFrom: string = candidateProfileDataNodeObj.people.phones.primaryPhoneNumber.length == 10
        ? '91' + candidateProfileDataNodeObj.people.phones.primaryPhoneNumber
        : candidateProfileDataNodeObj.people.phones.primaryPhoneNumber;

      if (candidateProfileDataNodeObj.people?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.messagingChannel == 'linkedin') {
        phoneNumberFrom = candidateProfileDataNodeObj.people?.linkedinLink?.primaryLinkUrl || '';
      }

      let phoneNumberTo: string = recruiterProfile.phoneNumber;

      if (candidateProfileDataNodeObj.people?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.messagingChannel == 'linkedin') {
        phoneNumberTo = recruiterProfile.linkedinUrl || '';
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

      // Check for duplicate messages
      let isDuplicate = false;
      if (candidateProfileData.id) {
        const existingMessages = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).fetchAllWhatsappMessages(candidateProfileData.id, apiToken);
        isDuplicate = existingMessages.some(msg => {
          const messageMatches = msg.message === whatsappIncomingMessage.messages[0].content;
          const participantsMatch = (
            (msg.phoneFrom === whatsappIncomingMessage.phoneNumberFrom.replace("+", "") && 
             msg.phoneTo === whatsappIncomingMessage.phoneNumberTo.replace("+", "")) ||
            (msg.phoneFrom === whatsappIncomingMessage.phoneNumberTo.replace("+", "") && 
             msg.phoneTo === whatsappIncomingMessage.phoneNumberFrom.replace("+", ""))
          );
          return messageMatches && participantsMatch;
        });
      }

      return { candidateProfileData, candidateJob, isDuplicate };
    } catch (error) {
      console.error('Error getting candidate information with duplicate check:', error);
      throw error;
    }
  }
}
