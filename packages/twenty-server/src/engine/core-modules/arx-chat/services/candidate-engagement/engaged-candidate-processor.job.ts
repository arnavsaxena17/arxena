import { Injectable, Logger } from '@nestjs/common';
import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { ChatFlowConfigBuilder } from 'src/engine/core-modules/arx-chat/services/chat-flow-config';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import {
  MessagingChannel,
  messagingChannelEquals,
} from 'src/engine/core-modules/arx-chat/utils/messaging-channel.util';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
    ChatControlsObjType,
    chatControlType,
    getCandidateChatControlValue,
    isCandidateFlagTrue,
    isChatControlCompleted,
} from 'twenty-shared';
import { Process } from '../../../message-queue/decorators/process.decorator';
import { Processor } from '../../../message-queue/decorators/processor.decorator';
import { MessageQueue } from '../../../message-queue/message-queue.constants';
import { WorkspaceQueryService } from '../../../workspace-modifications/workspace-modifications.service';

export interface EngagedCandidateJobData {
  candidateId: string;
  workspaceId: string;
  timestamp: number;
  messageId?: string;
  interimChat?: string;
  apiToken?: string;
  chatControlType?: string;
  isIncomingMessage?: boolean; // Flag to distinguish incoming vs outgoing messages
  /** Delay in minutes after last message before processing. From job.engagementProcessingDelayMinutes; default 2. */
  slidingWindowDelayMinutes?: number;
  /** Skip debounce; inbound grouping already flushed via Redis delayed job. */
  processImmediately?: boolean;
}

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout per candidate

@Injectable()
@Processor(MessageQueue.engagedCandidateProcessingQueue)
export class EngagedCandidateProcessor {
  private readonly logger = new Logger(EngagedCandidateProcessor.name);
  private readonly chatFlowConfigBuilder: ChatFlowConfigBuilder;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
  ) {
    this.logger.log('EngagedCandidateProcessor initialized');
    this.chatFlowConfigBuilder = new ChatFlowConfigBuilder(
      workspaceQueryService,
      staticGraphQLService,
    );
  }

  @Process(EngagedCandidateProcessor.name)
  async handle(jobData: EngagedCandidateJobData): Promise<void> {
    const { candidateId, workspaceId, timestamp, interimChat, apiToken, chatControlType, isIncomingMessage } = jobData;

    this.logger.log(`🚀 PROCESSING ENGAGED CANDIDATE QUEUE JOB: ${candidateId} from workspace ${workspaceId} at ${new Date(timestamp).toISOString()}`);
    this.logger.log(`Job data: ${JSON.stringify(jobData, null, 2)}`);

    try {
      // Validate inputs
      if (!candidateId || !workspaceId) {
        throw new Error(`Invalid job data: candidateId=${candidateId}, workspaceId=${workspaceId}`);
      }

      // If this is an interim chat queue job, handle the heavy operations here
      if (interimChat && apiToken) {
        this.logger.log(`📝 Handling interim chat queue for candidate ${candidateId} with message: ${interimChat}`);
        await this.handleInterimChatQueue(candidateId, workspaceId, interimChat, apiToken, chatControlType);
        return;
      }

      this.logger.log(
        `Processing engaged candidate ${candidateId} immediately (inbound grouping uses Redis delayed flush)`,
      );
      await this.processCandidateEngagement(
        candidateId,
        workspaceId,
        isIncomingMessage,
      );

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
    chatControlType: string = 'startChat',
  ): Promise<void> {
    this.logger.log(`Handling interim chat queue for candidate ${candidateId} with message: ${interimChat} and chat control: ${chatControlType}`);

    try {
      // Step 0: Get workspace ID from token (moved from main thread)
      let actualWorkspaceId = workspaceId;
      if (workspaceId === 'TBD') {
        actualWorkspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        if (!actualWorkspaceId) {
          this.logger.error('No workspace ID found for queuing candidate');
          return;
        }
        this.logger.log(`Resolved workspace ID: ${actualWorkspaceId} for candidate ${candidateId}`);
      }

      // Import required services
      const { FilterCandidates } = await import('src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates');
      const { RecruiterProfileService } = await import('src/engine/core-modules/arx-chat/services/recruiter-profile');
      const { EngagedCandidateQueueService } = await import('src/engine/core-modules/arx-chat/services/candidate-engagement/engaged-candidate-queue.service');
      const { CandidateEngagementArx } = await import('src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement');

      // Step 1: Create chat control (moved from main thread)
      const candidateEngagement = CandidateEngagementArx.create(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.workspaceMemberProfileUnipileService,
      );

      const chatControl = {
        chatControlType: chatControlType as any,
      };

      this.logger.log(`Creating chat control for candidate ${candidateId} with type: ${chatControlType}`);
      const chatControlResponse = await candidateEngagement.createChatControl(
        candidateId,
        chatControl,
        apiToken
      );

      this.logger.log('Response from create chat control:', chatControlResponse);

      // Step 2: Get candidate details
      const candidate = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateDetailsById(candidateId, apiToken);

      if (!candidate) {
        this.logger.warn(`Candidate ${candidateId} not found`);
        return;
      }

      const candidateJob = candidate?.projects;
      if (!candidateJob?.id) {
        this.logger.warn(
          `Candidate ${candidateId} has no linked project, cannot process interim chat`,
        );
        return;
      }

      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, apiToken);
      const chatReply = interimChat;

      // Set the appropriate message identifier based on messaging channel
      let messageFrom = candidate?.phoneNumber?.primaryPhoneNumber || '';
      let messageTo = recruiterProfile?.phoneNumber || '';
      let messageType = 'string';

      if (
        messagingChannelEquals(
          candidate?.messagingChannel,
          MessagingChannel.LINKEDIN_CONNECT,
          MessagingChannel.LINKEDIN_SOCK,
        )
      ) {
        messageFrom = candidate?.linkedinUrl?.primaryLinkUrl || '';
        messageTo = recruiterProfile?.linkedinUrl || '';
        messageType = 'linkedin';
      }

      const whatsappIncomingMessage = {
        phoneNumberFrom: messageFrom,
        phoneNumberTo: messageTo,
        messages: [{ role: 'user', content: chatReply }],
        messageType: messageType,
      };

      // Step 3: Check for duplicates using the correct candidate we already have
      const queueService = new EngagedCandidateQueueService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        undefined,
        undefined,
        undefined,
        this.workspaceMemberProfileUnipileService,
      );

      // Use the candidate we already fetched by ID (not by phone number search)
      const candidateProfileData = candidate;
      const isDuplicate = await queueService.checkMessageDuplicateForCandidate(
        candidateProfileData,
        candidateJob,
        chatReply,
        messageFrom,
        messageTo,
        apiToken
      );

      if (isDuplicate) {
        this.logger.log(`Message '${chatReply}' already exists for candidate ${candidateId} (job ${candidateJob.id}), skipping processing`);
        return;
      } else {
        this.logger.log(`Message '${chatReply}' is new for candidate ${candidateId} (job ${candidateJob.id}), proceeding with processing`);
      }

      this.logger.log(
        'This is the candidate who has sent us the message, we have to update the database that this message has been received and queue for engagement::',
        chatReply, "candidateProfileData"
      );

      const replyObject = {
        chatReply: chatReply,
        whatsappDeliveryStatus: 'receivedFromCandidate',
        phoneNumberFrom: messageFrom,
        externalMessageId: 'NA',
      };

      // Step 4: Use the new queue service to process all engagement operations
      const responseAfterMessageUpdate = await queueService.processEngagementOperations(
        replyObject,
        candidateProfileData,
        candidateJob,
        apiToken,
      );

      this.logger.log(
        'This is the response after message update::',
        'Created the interim chat message and processed engagement operations',
      );

      // Step 5: Process the candidate for engagement after message processing,
      // respecting silent hours for outgoing messages when enabled.
      this.logger.log(`Processing candidate ${candidateId} for engagement after interim chat`);

      const silentHoursEnabled =
        process.env.ENGAGEMENT_SILENT_HOURS_ENABLED === 'true';

      const processCandidateNow = async () => {
        const chatFlowOrder =
          candidateJob.chatFlowOrder ||
          this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
        const activeChatControl = this.determineActiveChatControl(
          candidateProfileData,
          chatFlowOrder,
        );

        if (activeChatControl) {
          this.logger.log(
            `Processing candidate ${candidateId} with chat control: ${activeChatControl.chatControlType}`,
          );

          await candidateEngagement.processCandidate(
            candidateProfileData,
            candidateJob,
            activeChatControl,
            apiToken,
          );

          this.logger.log(
            `Successfully processed candidate ${candidateId} for engagement`,
          );
        } else {
          this.logger.log(
            `No active chat control found for candidate ${candidateId}, skipping engagement`,
          );
        }
      };

      if (silentHoursEnabled) {
        const now = new Date();
        const currentHour = now.getHours();
        const isWithinSilentHours = currentHour >= 23 || currentHour < 7;

        if (isWithinSilentHours) {
          const nextAllowed = new Date(now);

          if (currentHour >= 23) {
            nextAllowed.setDate(nextAllowed.getDate() + 1);
          }

          nextAllowed.setHours(7, 0, 0, 0);

          const delayMs = nextAllowed.getTime() - now.getTime();

          if (delayMs > 0) {
            this.logger.log(
              `Silent hours active (server time). Scheduling interim engagement for candidate ${candidateId} at ${nextAllowed.toISOString()} (delay ${delayMs}ms).`,
            );

            setTimeout(async () => {
              try {
                await processCandidateNow();
              } catch (error) {
                this.logger.error(
                  `Error processing candidate ${candidateId} after silent hours (interim chat):`,
                  error,
                );
              }
            }, delayMs);

            return;
          }
        }
      }

      await processCandidateNow();

    } catch (error) {
      this.logger.error(`Error handling interim chat queue for candidate ${candidateId}:`, error);
      throw error;
    }
  }

  private async processCandidateEngagement(candidateId: string, workspaceId: string, isIncomingMessage: boolean = false): Promise<void> {
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
        const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
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

        if (!candidate || !candidate.projects) {
          this.logger.warn(`Candidate ${candidateId} not found or has no active project`);
          return;
        }

        // Check if candidate is still eligible for engagement
        if (isCandidateFlagTrue(candidate, 'stopChat')) {
          this.logger.log(`Candidate ${candidateId} has stopChat enabled, not eligible for engagement`);
          return;
        }

        if (
          !isIncomingMessage &&
          !isCandidateFlagTrue(candidate, 'engagementStatus')
        ) {
          this.logger.log(`Candidate ${candidateId} has engagementStatus false and this is not an incoming message, not eligible for engagement`);
          return;
        }

        if (isIncomingMessage) {
          this.logger.log(
            `Processing incoming message for candidate ${candidateId}, engagementStatus will be ignored`,
          );
        }

        // Process the candidate using existing engagement logic
        const candidateEngagement = CandidateEngagementArx.create(
          this.workspaceQueryService,
          this.staticGraphQLService,
          this.workspaceMemberProfileUnipileService,
        );

        // Get the candidate's project and determine which chat controls to process
        const job = candidate.projects;

        // If silent hours are enabled for outgoing messages, and this is not an
        // incoming message, delay processing until the next allowed time
        // (23:00–07:00 window in server local time).
        const silentHoursEnabled =
          process.env.ENGAGEMENT_SILENT_HOURS_ENABLED === 'true';

        if (silentHoursEnabled && !isIncomingMessage) {
          const now = new Date();
          const currentHour = now.getHours();
          const isWithinSilentHours = currentHour >= 23 || currentHour < 7;

          if (isWithinSilentHours) {
            const nextAllowed = new Date(now);

            if (currentHour >= 23) {
              nextAllowed.setDate(nextAllowed.getDate() + 1);
            }

            nextAllowed.setHours(7, 0, 0, 0);

            const delayMs = nextAllowed.getTime() - now.getTime();

            if (delayMs > 0) {
              this.logger.log(
                `Silent hours active (server time). Scheduling engagement for candidate ${candidateId} at ${nextAllowed.toISOString()} (delay ${delayMs}ms).`,
              );

              setTimeout(async () => {
                try {
                  const refreshedCandidate = await new FilterCandidates(
                    this.workspaceQueryService,
                    this.staticGraphQLService,
                  ).fetchCandidateByCandidateId(candidateId, token.token);

                  if (!refreshedCandidate || !refreshedCandidate.projects) {
                    this.logger.warn(
                      `Candidate ${candidateId} not found or has no active project at silent-hours resume time`,
                    );
                    return;
                  }

                  const refreshedJob = refreshedCandidate.projects;
                  const chatFlowOrderNow =
                    refreshedJob.chatFlowOrder ||
                    this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
                  const activeChatControlNow =
                    this.determineActiveChatControl(
                      refreshedCandidate,
                      chatFlowOrderNow,
                    );

                  if (!activeChatControlNow) {
                    this.logger.log(
                      `No active chat control found for candidate ${candidateId} at silent-hours resume time`,
                    );
                    return;
                  }

                  await candidateEngagement.processCandidate(
                    refreshedCandidate,
                    refreshedJob,
                    activeChatControlNow,
                    token.token,
                  );
                } catch (error) {
                  this.logger.error(
                    `Error processing candidate ${candidateId} after silent hours:`,
                    error,
                  );
                }
              }, delayMs);

              // Early return: do not process immediately while in silent hours
              return;
            }
          }
        }

        const chatFlowOrder =
          job.chatFlowOrder ||
          this.chatFlowConfigBuilder.getDefaultChatFlowOrder();

        // Find appropriate chat control based on candidate's current state
        const activeChatControl = this.determineActiveChatControl(
          candidate,
          chatFlowOrder,
        );

        if (!activeChatControl) {
          this.logger.log(
            `No active chat control found for candidate ${candidateId}`,
          );
          return;
        }

        this.logger.log(
          `Processing candidate ${candidateId} with chat control: ${activeChatControl.chatControlType}`,
        );

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
    for (const chatControlTypeValue of chatFlowOrder) {
      if (
        getCandidateChatControlValue(candidate, chatControlTypeValue) &&
        !isChatControlCompleted(candidate, chatControlTypeValue)
      ) {
        return { chatControlType: chatControlTypeValue as chatControlType };
      }
    }

    for (let index = 0; index < chatFlowOrder.length - 1; index++) {
      const currentStage = chatFlowOrder[index];
      const nextStage = chatFlowOrder[index + 1];

      const isCurrentStageCompleted = isChatControlCompleted(
        candidate,
        currentStage,
      );
      const hasNextStageStarted = getCandidateChatControlValue(
        candidate,
        nextStage,
      );

      if (isCurrentStageCompleted && !hasNextStageStarted) {
        return { chatControlType: nextStage as chatControlType };
      }
    }

    return null;
  }
}
