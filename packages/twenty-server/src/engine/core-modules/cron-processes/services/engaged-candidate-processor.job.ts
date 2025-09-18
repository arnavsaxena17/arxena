import { Injectable, Logger } from '@nestjs/common';
import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { ChatFlowConfigBuilder } from 'src/engine/core-modules/arx-chat/services/chat-flow-config';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  ChatControlsObjType,
  chatControlType,
} from 'twenty-shared';
import { Process } from '../../message-queue/decorators/process.decorator';
import { Processor } from '../../message-queue/decorators/processor.decorator';
import { MessageQueue } from '../../message-queue/message-queue.constants';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

export interface EngagedCandidateJobData {
  candidateId: string;
  workspaceId: string;
  timestamp: number;
  messageId?: string;
  interimChat?: string;
  apiToken?: string;
}

// Sliding window configuration
const SLIDING_WINDOW_DELAY_MS = 2 * 60 * 1000; // 2 minutes delay after last message
const MAX_BATCH_SIZE = 50; // Maximum candidates to process in one batch
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout per candidate

@Injectable()
@Processor(MessageQueue.engagedCandidateProcessingQueue)
export class EngagedCandidateProcessor {
  private readonly logger = new Logger(EngagedCandidateProcessor.name);
  private readonly candidateWindows = new Map<string, {
    lastMessageTime: number;
    candidateId: string;
    workspaceId: string;
    timeoutId?: NodeJS.Timeout;
  }>();
  private readonly chatFlowConfigBuilder: ChatFlowConfigBuilder;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {
    this.logger.log('EngagedCandidateProcessor initialized');
    this.chatFlowConfigBuilder = new ChatFlowConfigBuilder(
      workspaceQueryService,
      staticGraphQLService,
    );
  }

  @Process(EngagedCandidateProcessor.name)
  async handle(jobData: EngagedCandidateJobData): Promise<void> {
    const { candidateId, workspaceId, timestamp, interimChat, apiToken } = jobData;
    
    this.logger.log(`Processing engaged candidate ${candidateId} from workspace ${workspaceId} at ${new Date(timestamp).toISOString()}`);

    try {
      // Validate inputs
      if (!candidateId || !workspaceId) {
        throw new Error(`Invalid job data: candidateId=${candidateId}, workspaceId=${workspaceId}`);
      }

      // If this is an interim chat queue job, handle the heavy operations here
      if (interimChat && apiToken) {
        await this.handleInterimChatQueue(candidateId, workspaceId, interimChat, apiToken);
        return;
      }

      // Update or create sliding window for this candidate
      const windowKey = `${workspaceId}-${candidateId}`;
      const existingWindow = this.candidateWindows.get(windowKey);

      // Clear existing timeout if any
      if (existingWindow?.timeoutId) {
        clearTimeout(existingWindow.timeoutId);
      }

      // Update the window with new timestamp
      const windowData = {
        lastMessageTime: timestamp,
        candidateId,
        workspaceId,
      };

      // Set new timeout for processing
      const timeoutId = setTimeout(async () => {
        try {
          await this.processCandidateEngagement(candidateId, workspaceId);
          this.candidateWindows.delete(windowKey);
        } catch (error) {
          this.logger.error(`Error processing candidate ${candidateId}:`, error);
          this.candidateWindows.delete(windowKey);
        }
      }, SLIDING_WINDOW_DELAY_MS);

      this.candidateWindows.set(windowKey, {
        ...windowData,
        timeoutId,
      });

      this.logger.log(`Updated sliding window for candidate ${candidateId}, will process after ${SLIDING_WINDOW_DELAY_MS}ms delay`);

    } catch (error) {
      this.logger.error(`Error handling engaged candidate job for ${candidateId}:`, error);
      throw error;
    }
  }

  private async handleInterimChatQueue(
    candidateId: string,
    workspaceId: string,
    interimChat: string,
    apiToken: string,
  ): Promise<void> {
    this.logger.log(`Handling interim chat queue for candidate ${candidateId} with message: ${interimChat}`);
    
    try {
      // Import required services
      const { FilterCandidates } = await import('src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates');
      const { RecruiterProfileService } = await import('src/engine/core-modules/arx-chat/services/recruiter-profile');
      const { IncomingWhatsappMessages } = await import('src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages');
      // Import Job type from twenty-shared
      const twentyShared = await import('twenty-shared');

      // Perform all the heavy operations that were moved from the main thread
      const candidate = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateDetailsById(candidateId, apiToken);

      if (!candidate) {
        this.logger.warn(`Candidate ${candidateId} not found`);
        return;
      }

      const candidateJob = candidate?.jobs;
      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, apiToken);
      const chatReply = interimChat;
      
      const whatsappIncomingMessage = {
        phoneNumberFrom: candidate?.phoneNumber.primaryPhoneNumber,
        phoneNumberTo: recruiterProfile?.phoneNumber,
        messages: [{ role: 'user', content: chatReply }],
        messageType: 'string',
      };
      
      const candidateProfileData = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateInformation(whatsappIncomingMessage, apiToken);

      this.logger.log(
        'This is the candidate who has sent us the message, we have to update the database that this message has been received and queue for engagement::',
        chatReply, "candidateProfileData", candidateProfileData
      );
      
      const replyObject = {
        chatReply: chatReply,
        whatsappDeliveryStatus: 'receivedFromCandidate',
        phoneNumberFrom: candidate?.phoneNumber.primaryPhoneNumber,
        whatsappMessageId: 'NA',
      };
      
      // Create the incoming message and queue it for engagement processing
      const responseAfterMessageUpdate = await new IncomingWhatsappMessages(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).createAndUpdateIncomingCandidateChatMessage(
        replyObject,
        candidateProfileData,
        candidateJob,
        apiToken,
        true, // shouldQueue = true to enable engagement processing
      );

      this.logger.log(
        'This is the response after message update::',
        responseAfterMessageUpdate,
        'Created the interim chat message and queued for engagement',
      );

    } catch (error) {
      this.logger.error(`Error handling interim chat queue for candidate ${candidateId}:`, error);
      throw error;
    }
  }

  private async processCandidateEngagement(candidateId: string, workspaceId: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Starting candidate engagement processing for candidate ${candidateId} in workspace ${workspaceId}`);

    try {
      // Set up timeout for processing
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout processing candidate ${candidateId}`));
        }, PROCESSING_TIMEOUT_MS);
      });

      const processingPromise = async () => {
        // Get API keys for the workspace
        const schema = this.workspaceQueryService.workspaceDataSourceService.getSchemaName(workspaceId);
        const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, schema);
        
        if (!apiKeys || !apiKeys.length) {
          this.logger.warn(`No API keys found for workspace ${workspaceId}`);
          return;
        }

        // Generate token for the workspace
        const token = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(workspaceId, apiKeys[0].id);
        if (!token?.token) {
          this.logger.warn(`Could not generate token for workspace ${workspaceId}`);
          return;
        }

        // Get candidate details
        const candidate = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).fetchCandidateByCandidateId(candidateId, token.token);

        if (!candidate || !candidate.jobs) {
          this.logger.warn(`Candidate ${candidateId} not found or has no active job`);
          return;
        }

        // Check if candidate is still eligible for engagement
        if (!candidate.engagementStatus || candidate.stopChat) {
          this.logger.log(`Candidate ${candidateId} is not eligible for engagement anymore`);
          return;
        }

        // Process the candidate using existing engagement logic
        const candidateEngagement = new CandidateEngagementArx(
          this.workspaceQueryService,
          this.staticGraphQLService,
        );

        // Get the candidate's job and determine which chat controls to process
        const job = candidate.jobs;
        const chatFlowOrder = job.chatFlowOrder || this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
        const chatFlowConfigObj = this.chatFlowConfigBuilder.buildChatFlowConfig(chatFlowOrder);

        // Find appropriate chat control based on candidate's current state
        const activeChatControl = this.determineActiveChatControl(candidate, chatFlowOrder);
        
        if (!activeChatControl) {
          this.logger.log(`No active chat control found for candidate ${candidateId}`);
          return;
        }

        this.logger.log(`Processing candidate ${candidateId} with chat control: ${activeChatControl.chatControlType}`);

        // Process the candidate with the determined chat control
        await candidateEngagement.processCandidate(
          candidate,
          job,
          activeChatControl,
          token.token,
        );
      };

      // Race between processing and timeout
      await Promise.race([processingPromise(), timeoutPromise]);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      this.logger.log(`Candidate ${candidateId} processing completed in ${processingTime}ms`);
      
    } catch (error) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      this.logger.error(`Candidate ${candidateId} processing failed after ${processingTime}ms:`, error);
      throw error;
    }
  }

  private determineActiveChatControl(candidate: any, chatFlowOrder: string[]): ChatControlsObjType | null {
    // Determine which chat control should be active based on candidate's current state
    for (const chatControlType of chatFlowOrder) {
      // Check if this stage is active but not completed
      if (candidate[chatControlType] && !candidate[`${chatControlType}Completed`]) {
        return { chatControlType: chatControlType as chatControlType };
      }
    }

    // If no specific stage is active, check for transitions
    for (let i = 0; i < chatFlowOrder.length - 1; i++) {
      const currentStage = chatFlowOrder[i];
      const nextStage = chatFlowOrder[i + 1];

      // Check if current stage is completed but next stage hasn't started
      const isCurrentStageCompleted = candidate[`${currentStage}Completed`] === true;
      const hasNextStageStarted = candidate[nextStage] === true;

      if (isCurrentStageCompleted && !hasNextStageStarted) {
        return { chatControlType: nextStage as chatControlType };
      }
    }

    return null;
  }

  // Cleanup method to clear all timeouts when shutting down
  public cleanup(): void {
    this.logger.log('Cleaning up engaged candidate processor');
    this.candidateWindows.forEach((window) => {
      if (window.timeoutId) {
        clearTimeout(window.timeoutId);
      }
    });
    this.candidateWindows.clear();
  }

  // Method to get current window status (for debugging/monitoring)
  public getWindowStatus(): { candidateId: string; workspaceId: string; lastMessageTime: number }[] {
    return Array.from(this.candidateWindows.values()).map(window => ({
      candidateId: window.candidateId,
      workspaceId: window.workspaceId,
      lastMessageTime: window.lastMessageTime,
    }));
  }
}
