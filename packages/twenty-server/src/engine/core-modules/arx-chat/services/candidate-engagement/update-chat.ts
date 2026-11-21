import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  allStatuses,
  AnswerMessageObj,
  buildCandidateFlagsPatchUpdate,
  CandidateNode,
  CandidatesEdge,
  CANDIDATE_CHAT_START_CONTROL_FIELDS as CANDIDATE_CHAT_START_CONTROL_FIELD_NAMES,
  chatMessageType,
  deleteOneChatMessage,
  getResolvedOtherFields,
  graphqlQueryToCreateOneNewChatMessage,
  graphqlQueryToRemoveMessages,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  Project,
  mergeOtherFields,
  PageInfo,
  questionTextToKey,
  whatappUpdateMessageObjType,
  workspaceMemberDisplayName,
  workspaceMemberEmail,
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';

import { IncomingWhatsappMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages';
import {
  MessagingChannel,
  messagingChannelEquals,
} from 'src/engine/core-modules/arx-chat/utils/messaging-channel.util';
import { buildIncomingAttachmentChatReply } from 'src/engine/core-modules/arx-chat/utils/unipile-attachment-message.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { materializeCandidateTouchWithGraphQL } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { WorkspaceMemberArxService } from '../../services/workspace-member-arx.service';
import { CandidateEngagementDataUpdateService } from './candidate-engagement-data-update.service';
import { EngagedCandidateJobData } from './engaged-candidate-processor.job';
import { FilterCandidates } from './filter-candidates';
import type { UnipileSyncMessageItem } from '../whatsapp-unipile/whatsapp-unipile-sync.service';

export const CANDIDATE_CHAT_START_CONTROL_FIELDS = new Set(
  CANDIDATE_CHAT_START_CONTROL_FIELD_NAMES,
);

@Injectable()
export class UpdateChat extends CandidateEngagementDataUpdateService {
  constructor(
    workspaceQueryService: WorkspaceQueryService,
    staticGraphQLService: StaticGraphQLService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue)
    private readonly messageQueueService?: MessageQueueService,
  ) {
    super(workspaceQueryService, staticGraphQLService);
  }

  // Static factory method for backward compatibility
  static create(
    workspaceQueryService: WorkspaceQueryService,
    staticGraphQLService: StaticGraphQLService,
  ): UpdateChat {
    return new UpdateChat(
      workspaceQueryService,
      staticGraphQLService,
      undefined,
    );
  }

  // Add this new method to the ScheduledJobService

  async updateMeetingStatusAfterCompletion(
    candidate: CandidateNode,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log(
        'Going to update the meeitng after completion of the interview',
      );
      // Get candidate ID
      const candidateId = candidate?.id;
      // Get updated version of candidate profile data
      const graphqlQueryObjToFetchCandidateData = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { eq: candidateId } } },
      });

      const updatedCandidateResponse =
        await this.staticGraphQLService.executeGraphQL(
          graphqlToFetchAllCandidateData,
          { filter: { id: { eq: candidateId } } },
          apiToken,
        );

      console.log('updatedCandidateResponse::', updatedCandidateResponse);
      const candidates = updatedCandidateResponse?.data?.data?.candidates as
        | {
            edges: CandidatesEdge[];
            pageInfo: PageInfo;
          }
        | undefined;

      const updatedCandidateProfileDataNodeObj = candidates?.edges.filter(
        (edge) => edge.node.project.id === candidate.project.id,
      )[0]?.node;

      console.log(
        'updatedCandidateProfileDataNodeObj::',
        updatedCandidateProfileDataNodeObj,
      );

      // Update the candidate's status to "Interview Completed"
      const updateCandidateVariables = {
        idToUpdate: candidateId,
        input: buildCandidateFlagsPatchUpdate(candidate, {
          startMeetingSchedulingChatCompleted: true,
        }),
      };

      await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate,
        updateCandidateVariables,
        apiToken,
      );
      console.log(
        `Successfully updated candidate status to "Interview Completed" for candidate ${candidateId}`,
      );

      await materializeCandidateTouchWithGraphQL({
        staticGraphQLService: this.staticGraphQLService,
        candidateId,
        touch: 'meeting_held',
        apiToken,
        companyId:
          (
            candidate as {
              project?: { companyId?: string; company?: { id?: string } };
            }
          )?.project?.companyId ??
          (candidate as { project?: { company?: { id?: string } } })?.project
            ?.company?.id,
        messagingChannel: (candidate as { messagingChannel?: string })
          ?.messagingChannel,
      });
    } catch (error) {
      console.error('Error updating meeting status after completion:', error);
    }
  }

  async checkScheduledClientMeetingsCount(_projectId, _apiToken: string) {
    return { edges: [] };
  }

  async createShortlist(candidateIds: string[], apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-shortlist'
        : 'http://localhost:5050/create-shortlist';

    console.log('This is the url:', url);
    console.log(
      'going to create create-shortlist by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    console.log('Response from create-shortlist', response.data);

    return response.data;
  }

  async createShortlistDocument(candidateIds: string[], apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-shortlist-document'
        : 'http://localhost:5050/create-shortlist-document';

    console.log('This is the url:', url);
    console.log(
      'going to create create-shortlist by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    console.log('Response from create-shortlist-document', response.data);

    return response.data;
  }

  async createGmailDraftShortlist(
    candidateIds: string[],
    origin: string,
    apiToken: string,
  ) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create_gmail_draft_shortlist'
        : 'http://localhost:5050/create_gmail_draft_shortlist';

    console.log('This is the url:', url);
    console.log(
      'going to create create-shortlist by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds, origin: origin },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    console.log('Response from create_gmail_draft_shortlist', response.data);

    return response.data;
  }

  async createChatBasedShortlistDelivery(
    candidateIds: string[],
    origin: string,
    apiToken: string,
  ) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/chat_based_shortlist_delivery'
        : 'http://localhost:5050/chat_based_shortlist_delivery';

    console.log('This is the url:', url);
    console.log(
      'going to create chat based shortlist delivery by shortlists by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds, origin: origin },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    return response.data;
  }

  async createInterviewVideos(projectId: string, apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-interview-videos'
        : 'http://localhost:5050/create-interview-videos';

    console.log('This is the url:', url);
    console.log('going to create projectId based interview videos', projectId);
    const response = await axios.post(
      url,
      { projectId: projectId },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    return response.data;
  }

  async testArxenaConnection(apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/test_arxena_connection'
        : 'http://localhost:5050/test_arxena_connection';

    console.log('This is the url:', url);
    const response = await axios.post(
      url,
      { candidateIds: 'candidateIds' },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    return response.data;
  }

  async resetMessagesFromWhatsapp(candidateId: string, apiToken: string) {
    const chatMessages = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllChatMessages(candidateId, apiToken);
    for (const message of chatMessages) {
      try {
        const deleteMessageResponse =
          await this.staticGraphQLService.executeGraphQL(
            deleteOneChatMessage,
            { idToDelete: message.id },
            apiToken,
          );
        // console.log('deleteMessageResponse::', deleteMessageResponse.data);
      } catch (error) {
        console.error('Error deleting message:', message.id, error);
      }
    }
    console.log('Successfully deleted messages:');
  }

  async createInterimChat(
    interimChat: string,
    candidateId: string,
    apiToken: string,
  ) {
    console.log('This is the interim chat message::', interimChat);
    console.log('This is the candidateId::', candidateId);
    // const personObj: PersonNode | undefined = await new FilterCandidates(
    //   this.workspaceQueryService,
    //   this.staticGraphQLService,
    // ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    // const candidateJob: Project = personObj?.candidates?.edges[0]?.node?.project as Project;
    const candidate = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateDetailsById(candidateId, apiToken);

    const candidateJob: Project = candidate?.project as Project;
    const workspaceMember = await new WorkspaceMemberArxService(
      this.staticGraphQLService,
    ).getByProject(candidateJob, apiToken);
    if (!workspaceMember) {
      console.warn(
        '[UpdateChat] Skipping interim chat: job has no recruiter (projectId: %s, candidateId: %s)',
        candidateJob?.id,
        candidateId,
      );
      return;
    }
    const chatReply = interimChat;

    // Set the appropriate message identifier based on messaging channel
    let messageFrom = candidate?.people?.phones?.primaryPhoneNumber ?? '';
    let messageTo = workspaceMember.phoneNumber || '';
    let messageType = 'string';

    if (
      messagingChannelEquals(
        candidate?.messagingChannel,
        MessagingChannel.LINKEDIN_CONNECT,
        MessagingChannel.LINKEDIN_SOCK,
      )
    ) {
      messageFrom = candidate?.people?.linkedinLink?.primaryLinkUrl ?? '';
      messageTo = workspaceMember.linkedinUrl || '';
      messageType = 'linkedin';
    }

    const whatsappIncomingMessage: chatMessageType = {
      phoneNumberFrom: messageFrom,
      phoneNumberTo: messageTo,
      messages: [{ role: 'user', content: chatReply }],
      messageType: messageType,
    };
    const candidateProfileData = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateInformation(whatsappIncomingMessage, apiToken);

    console.log(
      'This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::',
      chatReply,
      'candidateProfileData',
      candidateProfileData,
    );
    const replyObject = {
      chatReply: chatReply,
      whatsappDeliveryStatus: 'receivedFromCandidate',
      phoneNumberFrom: candidate?.people?.phones?.primaryPhoneNumber ?? '',
      externalMessageId: 'NA',
    };
    const responseAfterMessageUpdate = await new IncomingWhatsappMessages(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).createAndUpdateIncomingCandidateChatMessage(
      replyObject,
      candidateProfileData,
      candidateJob,
      apiToken,
      false, // Don't queue interim chats
    );

    console.log('This is the response after message update::');
  }

  async createInterimChatQueue(
    interimChat: string,
    candidateId: string,
    apiToken: string,
    options?: { delayMs?: number; chatControlType?: string },
  ) {
    console.log('📨 INTERIM CHAT QUEUE REQUEST:');
    try {
      const candidate = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateDetailsById(candidateId, apiToken);
      const slidingWindowDelayMinutes =
        candidate?.project?.engagementProcessingDelayMinutes;
      const chatControlType =
        options?.chatControlType ??
        (CANDIDATE_CHAT_START_CONTROL_FIELDS.has(interimChat)
          ? interimChat
          : 'startChat');

      // Queue the candidate for engagement processing with the interim chat data
      // All heavy operations including getWorkspaceIdFromToken and createChatControl will be moved to the worker
      await this.queueCandidateForEngagementWithData(
        candidateId,
        interimChat,
        apiToken,
        chatControlType,
        true,
        slidingWindowDelayMinutes,
        options?.delayMs,
      );

      console.log('✅ Successfully queued candidate for engagement processing');
    } catch (error) {
      console.error('❌ Error queuing candidate for engagement:', error);
      throw error;
    }
  }

  private async queueCandidateForEngagementWithData(
    candidateId: string,
    interimChat: string,
    apiToken: string,
    chatControlType: string = 'startChat',
    isIncomingMessage: boolean = true,
    slidingWindowDelayMinutes?: number,
    delayMs?: number,
  ): Promise<void> {
    console.log('🔄 QUEUE CANDIDATE FOR ENGAGEMENT WITH DATA:');
    console.log('Candidate ID:', candidateId);
    console.log('Interim Chat:', interimChat);
    console.log('Chat Control Type:', chatControlType);

    if (!this.messageQueueService) {
      console.warn(
        '❌ Message queue not available, falling back to direct processing',
      );
      await this.createInterimChat(interimChat, candidateId, apiToken);
      return;
    }

    try {
      // workspaceId will be resolved in the worker
      // Inlined from EngagedCandidateQueueService: same queue, same job id, same
      // delay. Calling it there made EngagedCandidateQueueService and UpdateChat
      // depend on each other, which is what forced the lazy require().
      await this.messageQueueService.add<EngagedCandidateJobData>(
        'EngagedCandidateProcessor',
        {
          candidateId,
          workspaceId: 'TBD',
          timestamp: Date.now(),
          messageId: 'NA',
          interimChat,
          apiToken,
          chatControlType,
          isIncomingMessage,
          ...(slidingWindowDelayMinutes != null && {
            slidingWindowDelayMinutes,
          }),
        },
        {
          priority: 1,
          id: `engaged-candidate-interim-${candidateId}-${chatControlType}`,
          ...(delayMs != null && delayMs > 0 ? { delay: delayMs } : {}),
        },
      );

      console.log(
        `Queued candidate ${candidateId} for engagement processing with interim chat data: ${interimChat} and chat control: ${chatControlType}`,
      );
    } catch (error) {
      console.error(
        `Failed to queue candidate ${candidateId} for engagement:`,
        error,
      );
      throw error;
    }
  }

  async setCandidateEngagementStatusToFalse(
    candidateId: string,
    apiToken: string,
  ) {
    console.log(
      'Setting candidate engagement status to false::',
      candidateId,
      ' at time :: ',
      new Date().toISOString(),
    );
    const candidate = await this.staticGraphQLService.executeGraphQL(
      graphqlToFetchAllCandidateData,
      { filter: { id: { eq: candidateId } } },
      apiToken,
    );
    const candidateNode = (
      candidate?.data?.data?.candidates as
        | { edges: CandidatesEdge[] }
        | undefined
    )?.edges[0]?.node;

    const updateCandidateObjectVariables = {
      idToUpdate: candidateId,
      input: buildCandidateFlagsPatchUpdate(candidateNode, {
        engagementStatus: false,
      }),
    };

    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate,
        updateCandidateObjectVariables,
        apiToken,
      );

      console.log(
        'Candidate engagement status updated successfully to false ::',
        response.data.data.updateCandidate,
        ' at time :: ',
        new Date().toISOString(),
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateAnswer(
    candidate: CandidateNode,
    AnswerMessageObj: AnswerMessageObj,
    apiToken: string,
  ) {
    try {
      const answerKey =
        AnswerMessageObj.questionKey ||
        (AnswerMessageObj.question
          ? questionTextToKey(AnswerMessageObj.question)
          : '');

      if (!answerKey) {
        console.error(
          'Skipping otherFields update: missing question or questionKey for candidate',
          AnswerMessageObj.candidateId,
        );

        return null;
      }

      const currentOtherFields = getResolvedOtherFields(candidate);
      const mergedOtherFields = mergeOtherFields(currentOtherFields, {
        [answerKey]: AnswerMessageObj.name,
      });

      const response = await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate,
        {
          idToUpdate: AnswerMessageObj.candidateId,
          input: { otherFields: mergedOtherFields },
        },
        apiToken,
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async removeChatsByMessageIDs(messageIDs: string[], apiToken: string) {
    const graphQLVariables = { filter: { id: { in: messageIDs } } };
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToRemoveMessages,
      variables: graphQLVariables,
    });
    const response = await this.staticGraphQLService.executeGraphQL(
      graphqlQueryToRemoveMessages,
      graphQLVariables,
      apiToken,
    );

    console.log('REsponse status:', response.data);

    return response;
  }

  async updateCandidateProfileStatus(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    const candidateStatus = whatappUpdateMessageObj.messageType;

    console.log('Updating the candidate status::', candidateStatus);
    console.log('Updating the candidate api token::', apiToken);
    const candidateId = candidate?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );
    const updateCandidateObjectVariables = {
      idToUpdate: candidateId,
      input: { status: candidateStatus },
    };

    console.log('GraphQL query to update candidate status:');
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate,
        updateCandidateObjectVariables,
        apiToken,
      );

      console.log('REsponse from updating candidate status:', response.data);

      return 'Updated the candidate profile with the status.';
    } catch {
      console.log('Error in updating candidate profile status');
    }
  }

  /**
   * Sync Baileys messages with database - saves messages that exist in Baileys but not in database
   */
  async syncBaileysMessagesWithDatabase(
    baileysMessages: any[],
    candidateId: string,
    apiToken: string,
  ): Promise<{ synced: number; skipped: number; errors: number }> {
    console.log(
      `🔄 Syncing ${baileysMessages.length} Baileys messages with database for candidate: ${candidateId}`,
    );

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Get existing messages from database for this candidate
      const existingMessages = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllChatMessages(candidateId, apiToken);
      console.log(
        'existingMessages in syncBaileysMessagesWithDatabase:',
        existingMessages,
      );
      // Create a set of existing message IDs for quick lookup
      const existingMessageIds = new Set(
        existingMessages
          .map((msg) => (msg as any).externalMessageId)
          .filter(Boolean),
      );

      console.log(
        `📊 Found ${existingMessages.length} existing messages in database`,
      );

      // Get candidate details
      const candidate = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateDetailsById(candidateId, apiToken);

      if (!candidate) {
        console.error(`❌ Candidate not found: ${candidateId}`);
        return { synced: 0, skipped: 0, errors: baileysMessages.length };
      }

      // Process each Baileys message
      for (const baileysMessage of baileysMessages) {
        try {
          // Skip if message already exists in database
          if (existingMessageIds.has(baileysMessage.id)) {
            skipped++;
            continue;
          }

          // Determine message direction and content
          const isFromMe = baileysMessage.fromMe;
          const messageContent = this.extractMessageContent(baileysMessage);
          const messageType = this.determineMessageType(baileysMessage);

          // Create WhatsApp message object
          const chatMessageObj: whatappUpdateMessageObjType = {
            id: baileysMessage.id,
            phoneNumberFrom: isFromMe
              ? (candidate.people?.phones?.primaryPhoneNumber ?? '')
              : baileysMessage.phoneFrom || '',
            phoneNumberTo: isFromMe
              ? baileysMessage.phoneTo || ''
              : (candidate.people?.phones?.primaryPhoneNumber ?? ''),
            messageType: isFromMe ? 'botMessage' : 'userMessage',
            messages: [
              {
                role: isFromMe ? 'assistant' : 'user',
                content: messageContent,
              },
            ],
            messageObj: [
              {
                role: isFromMe ? 'assistant' : 'user',
                content: messageContent,
              },
            ],
            whatsappDeliveryStatus: 'receivedFromCandidate',
            externalMessageId: baileysMessage.id,
            typeOfMessage: messageType,
            lastEngagementChatControl: 'startChat',
            candidateProfile: candidate,
            candidateFirstName: candidate.name?.split(' ')[0] || '',
            whatsappMessageType: messageType,
          };

          // Save message to database
          await this.createAndUpdateChatMessage(
            candidate,
            chatMessageObj,
            apiToken,
          );

          synced++;
          console.log(`✅ Synced message: ${baileysMessage.id}`);
        } catch (error) {
          console.error(
            `❌ Error syncing message ${baileysMessage.id}:`,
            error,
          );
          errors++;
        }
      }

      console.log(
        `📈 Sync completed - Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`,
      );
      return { synced, skipped, errors };
    } catch (error) {
      console.error('❌ Error in syncBaileysMessagesWithDatabase:', error);
      return { synced, skipped, errors: baileysMessages.length };
    }
  }

  /**
   * Extract message content from Baileys message object
   */
  private extractMessageContent(baileysMessage: any): string {
    if (baileysMessage.message?.conversation) {
      return baileysMessage.message.conversation;
    }
    if (baileysMessage.message?.extendedTextMessage?.text) {
      return baileysMessage.message.extendedTextMessage.text;
    }
    if (baileysMessage.message?.imageMessage?.caption) {
      return baileysMessage.message.imageMessage.caption;
    }
    if (baileysMessage.message?.videoMessage?.caption) {
      return baileysMessage.message.videoMessage.caption;
    }
    if (baileysMessage.message?.documentMessage?.caption) {
      return baileysMessage.message.documentMessage.caption;
    }
    if (baileysMessage.message?.audioMessage) {
      return '[Audio Message]';
    }
    if (baileysMessage.message?.imageMessage) {
      return '[Image]';
    }
    if (baileysMessage.message?.videoMessage) {
      return '[Video]';
    }
    if (baileysMessage.message?.documentMessage) {
      return '[Document]';
    }
    if (baileysMessage.message?.stickerMessage) {
      return '[Sticker]';
    }
    if (baileysMessage.message?.locationMessage) {
      return '[Location]';
    }
    if (baileysMessage.message?.contactMessage) {
      return '[Contact]';
    }

    return '[Unsupported Message Type]';
  }

  /**
   * Determine message type from Baileys message object
   */
  private determineMessageType(baileysMessage: any): string {
    const message = baileysMessage.message;
    if (!message) return 'conversation';

    if (message.conversation || message.extendedTextMessage) {
      return 'conversation';
    }
    if (message.imageMessage) {
      return 'imageMessage';
    }
    if (message.videoMessage) {
      return 'videoMessage';
    }
    if (message.audioMessage) {
      return 'audioMessage';
    }
    if (message.documentMessage) {
      return 'documentMessage';
    }
    if (message.stickerMessage) {
      return 'stickerMessage';
    }
    if (message.locationMessage) {
      return 'locationMessage';
    }
    if (message.contactMessage) {
      return 'contactMessage';
    }

    return 'conversation';
  }

  /**
   * Sync Unipile WhatsApp messages with database for a candidate conversation.
   */
  async syncUnipileMessagesWithDatabase(
    unipileMessages: UnipileSyncMessageItem[],
    candidateId: string,
    apiToken: string,
    context: { candidatePhone: string; recruiterPhone: string },
  ): Promise<{ synced: number; skipped: number; errors: number }> {
    console.log(
      `🔄 Syncing ${unipileMessages.length} Unipile messages with database for candidate: ${candidateId}`,
    );

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const existingMessages = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllChatMessages(candidateId, apiToken);

      const existingMessageIds = new Set(
        existingMessages
          .map(
            (msg) => (msg as { externalMessageId?: string }).externalMessageId,
          )
          .filter(Boolean),
      );

      const existingContentKeys = new Set(
        existingMessages.map((msg) =>
          this.buildMessageDedupeKey(
            msg.message ?? '',
            msg.phoneFrom ?? '',
            msg.phoneTo ?? '',
          ),
        ),
      );

      const candidate = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateDetailsById(candidateId, apiToken);

      if (!candidate) {
        console.error(`❌ Candidate not found: ${candidateId}`);
        return { synced: 0, skipped: 0, errors: unipileMessages.length };
      }

      const candidatePhoneDigits = this.normalizePhoneDigitsForSync(
        context.candidatePhone ||
          (candidate.people?.phones?.primaryPhoneNumber ?? ''),
      );
      const recruiterPhoneDigits = this.normalizePhoneDigitsForSync(
        context.recruiterPhone,
      );

      for (const unipileMessage of unipileMessages) {
        try {
          if (unipileMessage.deleted === 1 || unipileMessage.is_event === 1) {
            skipped++;
            continue;
          }

          const unipileMessageId = unipileMessage.id;
          const providerId = unipileMessage.provider_id?.trim();

          if (
            existingMessageIds.has(unipileMessageId) ||
            (providerId && existingMessageIds.has(providerId))
          ) {
            skipped++;
            continue;
          }

          const isFromConnectedUser = unipileMessage.is_sender === 1;
          const messageContent =
            this.extractUnipileMessageContent(unipileMessage);

          if (!messageContent) {
            skipped++;
            continue;
          }

          const phoneFrom = isFromConnectedUser
            ? recruiterPhoneDigits
            : candidatePhoneDigits;
          const phoneTo = isFromConnectedUser
            ? candidatePhoneDigits
            : recruiterPhoneDigits;

          const dedupeKey = this.buildMessageDedupeKey(
            messageContent,
            phoneFrom,
            phoneTo,
          );
          if (existingContentKeys.has(dedupeKey)) {
            skipped++;
            continue;
          }

          // Record id must be a UUID; Unipile ids go in externalMessageId for dedupe
          const chatMessageObj: whatappUpdateMessageObjType = {
            id: uuidv4(),
            phoneNumberFrom: phoneFrom,
            phoneNumberTo: phoneTo,
            messageType: isFromConnectedUser
              ? 'botMessage'
              : 'whatsapp-unipile',
            messages: [
              {
                role: isFromConnectedUser ? 'assistant' : 'user',
                content: messageContent,
              },
            ],
            messageObj: [
              {
                role: isFromConnectedUser ? 'assistant' : 'user',
                content: messageContent,
              },
            ],
            whatsappDeliveryStatus: isFromConnectedUser
              ? 'delivered'
              : 'receivedFromCandidate',
            externalMessageId: unipileMessageId,
            typeOfMessage: this.determineUnipileMessageType(unipileMessage),
            lastEngagementChatControl: 'startChat',
            candidateProfile: candidate,
            candidateFirstName: candidate.name?.split(' ')[0] || '',
            whatsappMessageType:
              this.determineUnipileMessageType(unipileMessage),
          };

          const createdMessage = await this.createAndUpdateChatMessage(
            candidate,
            chatMessageObj,
            apiToken,
            unipileMessage.timestamp
              ? { createdAt: unipileMessage.timestamp }
              : undefined,
          );

          if (!createdMessage) {
            errors++;
            console.error(
              `❌ Failed to persist Unipile message ${unipileMessageId}`,
            );
            continue;
          }

          existingMessageIds.add(unipileMessageId);
          if (providerId) {
            existingMessageIds.add(providerId);
          }
          existingContentKeys.add(dedupeKey);

          synced++;
          console.log(`✅ Synced Unipile message: ${unipileMessageId}`);
        } catch (error) {
          console.error(
            `❌ Error syncing Unipile message ${unipileMessage.id}:`,
            error,
          );
          errors++;
        }
      }

      console.log(
        `📈 Unipile sync completed - Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`,
      );
      return { synced, skipped, errors };
    } catch (error) {
      console.error('❌ Error in syncUnipileMessagesWithDatabase:', error);
      return { synced, skipped, errors: unipileMessages.length };
    }
  }

  private normalizePhoneDigitsForSync(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  private buildMessageDedupeKey(
    message: string,
    phoneFrom: string,
    phoneTo: string,
  ): string {
    const from = this.normalizePhoneDigitsForSync(phoneFrom);
    const to = this.normalizePhoneDigitsForSync(phoneTo);
    const participants = [from, to].sort().join('|');
    return `${participants}::${message}`;
  }

  private extractUnipileMessageContent(
    unipileMessage: UnipileSyncMessageItem,
  ): string {
    return buildIncomingAttachmentChatReply(
      unipileMessage.text,
      unipileMessage.attachments,
    );
  }

  private determineUnipileMessageType(
    unipileMessage: UnipileSyncMessageItem,
  ): string {
    const attachmentType = unipileMessage.attachments?.[0]?.type;
    if (!attachmentType) {
      return 'conversation';
    }
    if (attachmentType === 'img') {
      return 'imageMessage';
    }
    if (attachmentType === 'video') {
      return 'videoMessage';
    }
    if (attachmentType === 'audio') {
      return 'audioMessage';
    }
    if (attachmentType === 'file') {
      return 'documentMessage';
    }
    return 'conversation';
  }

  /**
   * Sync messages for a specific phone number and candidate
   */
  async syncMessagesForPhoneNumber(
    phoneNumber: string,
    candidateId: string,
    apiToken: string,
    baileysMessages: any[],
  ): Promise<{ synced: number; skipped: number; errors: number }> {
    console.log(
      `🔄 Syncing messages for phone number: ${phoneNumber}, candidate: ${candidateId}`,
    );

    try {
      console.log(
        'baileysMessages in syncMessagesForPhoneNumber:',
        baileysMessages,
      );
      // Filter messages for this specific phone number
      const phoneNumberClean = phoneNumber.replace(/[^0-9]/g, '');
      const relevantMessages = baileysMessages.filter((msg) => {
        const fromPhone = msg.phoneFrom?.replace(/[^0-9]/g, '') || '';
        const toPhone = msg.phoneTo?.replace(/[^0-9]/g, '') || '';
        return fromPhone === phoneNumberClean || toPhone === phoneNumberClean;
      });

      console.log(
        `📱 Found ${relevantMessages.length} relevant messages for phone number: ${phoneNumber}`,
      );

      if (relevantMessages.length === 0) {
        console.log('No relevant messages found in syncMessagesForPhoneNumber');
        return { synced: 0, skipped: 0, errors: 0 };
      }

      console.log(
        'relevantMessages in syncMessagesForPhoneNumber:',
        relevantMessages,
      );

      // Sync the messages
      return await this.syncBaileysMessagesWithDatabase(
        relevantMessages,
        candidateId,
        apiToken,
      );
    } catch (error) {
      console.error('❌ Error syncing messages for phone number:', error);
      return { synced: 0, skipped: 0, errors: baileysMessages.length };
    }
  }
}
