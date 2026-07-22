import { forwardRef, Inject, Injectable, Optional } from '@nestjs/common';
import { render } from '@react-email/render';
import axios from 'axios';
import { InsufficientCreditsEmail } from 'twenty-emails';
import {
  allStatuses,
  AnswerMessageObj,
  CandidateNode,
  CandidatesEdge,
  chatMessageType,
  deleteOneWhatsappMessage,
  getResolvedOtherFields,
  graphqlQueryToCreateOneNewWhatsappMessage,
  graphqlQueryToRemoveMessages,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  graphqlToUpdateOneClientInterview,
  Job,
  mergeOtherFields,
  PageInfo,
  questionTextToKey,
  whatappUpdateMessageObjType
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';

import { StageWiseClassification } from 'src/engine/core-modules/arx-chat/services/llm-agents/stage-classification';
import { IncomingWhatsappMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages';
import { buildIncomingAttachmentChatReply } from 'src/engine/core-modules/arx-chat/utils/unipile-attachment-message.util';
import { Semaphore } from 'src/engine/core-modules/arx-chat/utils/semaphore';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { RecruiterProfileService } from '../../services/recruiter-profile';
import { CandidateEngagementArx } from './candidate-engagement';
import { FilterCandidates } from './filter-candidates';
import type { UnipileSyncMessageItem } from '../whatsapp-unipile/whatsapp-unipile-sync.service';

@Injectable()
export class UpdateChat {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    @Optional() @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly messageQueueService?: MessageQueueService,
    @Optional() @Inject(forwardRef(() => {
      // Lazy require to avoid circular dependency at module load time
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./engaged-candidate-queue.service').EngagedCandidateQueueService;
    })) private readonly engagedCandidateQueueService?: any, // EngagedCandidateQueueService type to avoid circular dependency
  ) {}

  // Static factory method for backward compatibility
  static create(
    workspaceQueryService: WorkspaceQueryService,
    staticGraphQLService: StaticGraphQLService,
  ): UpdateChat {
    const instance = new UpdateChat(workspaceQueryService, staticGraphQLService, undefined);
    return instance;
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
      const candidateId =
        candidate?.id;
      // Get updated version of candidate profile data
      const graphqlQueryObjToFetchCandidateData = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { eq: candidateId } } },
      });

      const updatedCandidateResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { id: { eq: candidateId } } }, apiToken);

      console.log('updatedCandidateResponse::', updatedCandidateResponse);
      const candidates = updatedCandidateResponse?.data?.data?.candidates as { 
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;  



      const updatedCandidateProfileDataNodeObj =
        candidates?.edges.filter(
          (edge) => edge.node.jobs.id === candidate.jobs.id,
        )[0]?.node;

      console.log(
        'updatedCandidateProfileDataNodeObj::',
        updatedCandidateProfileDataNodeObj,
      );
      const clientInterviewId =
        updatedCandidateProfileDataNodeObj?.clientInterview?.edges[0]?.node?.id;

      console.log('clientInterviewId::', clientInterviewId);
      const updateClientInterviewVariables = {
        idToUpdate: clientInterviewId,
        input: { clientInterviewCompleted: true },
      };


      await this.staticGraphQLService.executeGraphQL(graphqlToUpdateOneClientInterview, updateClientInterviewVariables, apiToken);
      console.log(
        `Successfully closed meeting status for candidate ${candidateId}`,
      );
      // Optionally, you could also update the candidate's status or add follow-up tasks here

      // Update the candidate's status to "Interview Completed"
      const updateCandidateVariables = {
        idToUpdate: candidateId,
        input: { startMeetingSchedulingChatCompleted: true },
      };


      await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, updateCandidateVariables, apiToken);
      console.log(
        `Successfully updated candidate status to "Interview Completed" for candidate ${candidateId}`,
      );
    } catch (error) {
      console.error('Error updating meeting status after completion:', error);
    }
  }

  async checkScheduledClientMeetingsCount(jobId, apiToken: string) {
    const scheduledClientMeetings = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchScheduledClientMeetings(jobId, apiToken);
    const today = new Date();
    const dayAfterTomorrow = new Date(today);

    dayAfterTomorrow.setDate(today.getDate() + 2);
    const countScheduledMeetings = scheduledClientMeetings?.edges.filter((meeting) => {
      const meetingDate = new Date(meeting.node.interviewTime.date);

      return meetingDate.toDateString() === dayAfterTomorrow.toDateString();
    }).length;

    console.log(
      `Number of scheduled meetings for the day after tomorrow: ${countScheduledMeetings}`,
    );
    // Send candidate details to email
    const candidateDetails = scheduledClientMeetings?.edges.map((meeting) => ({
      candidateId: meeting.node?.candidateId,
      candidateName: meeting.node?.candidateName,
      interviewTime: meeting.node?.interviewTime,
    }));
    const candidateIds = scheduledClientMeetings?.edges.map(
      (meeting) => meeting.node?.candidateId,
    ) || [];

    await this.createShortlist(candidateIds, apiToken);

    return scheduledClientMeetings;
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


  async createGmailDraftShortlist(candidateIds: string[], origin: string, apiToken: string) {
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

  async createInterviewVideos(jobId: string, apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-interview-videos'
        : 'http://localhost:5050/create-interview-videos';

    console.log('This is the url:', url);
    console.log('going to create jobId based interview videos', jobId);
    const response = await axios.post(
      url,
      { jobId: jobId },
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
    const whatsappMessages = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllWhatsappMessages(candidateId, apiToken);
    for (const message of whatsappMessages) {
      try {
        const deleteMessageResponse = await this.staticGraphQLService.executeGraphQL(deleteOneWhatsappMessage, { idToDelete: message.id }, apiToken);
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
    // const candidateJob: Job = personObj?.candidates?.edges[0]?.node?.jobs as Job;
    const candidate = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateDetailsById(candidateId, apiToken);

    const candidateJob: Job = candidate?.jobs as Job;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, apiToken);
    if (!recruiterProfile) {
      console.warn(
        '[UpdateChat] Skipping interim chat: job has no recruiter (jobId: %s, candidateId: %s)',
        candidateJob?.id,
        candidateId,
      );
      return;
    }
    const chatReply = interimChat;

    // Set the appropriate message identifier based on messaging channel
    let messageFrom = candidate?.phoneNumber?.primaryPhoneNumber || '';
    let messageTo = recruiterProfile.phoneNumber || '';
    let messageType = 'string';
    
    if (candidate?.messagingChannel === 'linkedin' || candidate?.messagingChannel === 'linkedin-sock') {
      messageFrom = candidate?.linkedinUrl?.primaryLinkUrl || '';
      messageTo = recruiterProfile.linkedinUrl || '';
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
      chatReply, "candidateProfileData", candidateProfileData
    );
    const replyObject = {
      chatReply: chatReply,
      whatsappDeliveryStatus: 'receivedFromCandidate',
      phoneNumberFrom: candidate?.phoneNumber?.primaryPhoneNumber || '',
      whatsappMessageId: 'NA',
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

    console.log(
      'This is the response after message update::',
    );
  }

  async createInterimChatQueue(
    interimChat: string,
    candidateId: string,
    apiToken: string,
    options?: { delayMs?: number },
  ) {
    console.log('📨 INTERIM CHAT QUEUE REQUEST:');
    try {
      const candidate = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getCandidateDetailsById(candidateId, apiToken);
      const slidingWindowDelayMinutes = candidate?.jobs?.engagementProcessingDelayMinutes;

      // Queue the candidate for engagement processing with the interim chat data
      // All heavy operations including getWorkspaceIdFromToken and createChatControl will be moved to the worker
      await this.queueCandidateForEngagementWithData(
        candidateId,
        interimChat,
        apiToken,
        'startChat', // chatControlType
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
    console.log('EngagedCandidateQueueService available:', !!this.engagedCandidateQueueService);
    
    if (!this.engagedCandidateQueueService) {
      console.warn('❌ EngagedCandidateQueueService not available, falling back to direct processing');
      // Fallback to direct processing if queue service is not available
      await this.createInterimChat(interimChat, candidateId, apiToken);
      return;
    }

    try {
      // Queue the candidate for engagement processing with extended data
      // workspaceId will be resolved in the worker
      await this.engagedCandidateQueueService.queueCandidateForEngagementWithData(
        candidateId,
        interimChat,
        apiToken,
        chatControlType,
        isIncomingMessage,
        slidingWindowDelayMinutes,
        delayMs,
      );

      console.log(`Queued candidate ${candidateId} for engagement processing with interim chat data: ${interimChat} and chat control: ${chatControlType}`);
    } catch (error) {
      console.error(`Failed to queue candidate ${candidateId} for engagement:`, error);
      throw error;
    }
  }

  async updateCandidatesWithChatCount(
    candidateIds: string[],
    apiToken: string,
  ) {
    try {
      console.log('Updating candidates with chat count');
      console.log('Candidate ids for updating chat count::', candidateIds);
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { in: candidateIds } } },
      });
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { id: { in: candidateIds } } }, apiToken);
      const candidates = response?.data?.data?.candidates as { 
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;  
      const currentCandidates = candidates?.edges || [];

      console.log('Number of current Candidates:', currentCandidates.length);
      for (const candidate of currentCandidates) {
        const currentCount = candidate.node.chatCount || 0;

        console.log('Current chat count::', currentCount);
        const messagesList = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
          ).fetchAllWhatsappMessages(candidate.node.id, apiToken);
        const newCount = messagesList.length;

        console.log('New chat count::', newCount);
        if (newCount !== currentCount) {
          const graphqlVariables = {
            idToUpdate: candidate.node.id,
            input: { chatCount: newCount },
          };
          const updateGraphqlQueryObj = JSON.stringify({
            query: graphQltoUpdateOneCandidate,
            variables: graphqlVariables,
          });
          const updateResponse = await this.staticGraphQLService.executeGraphQL(
            graphQltoUpdateOneCandidate,
            graphqlVariables,
            apiToken,
          );

          if (updateResponse.data.errors) {
            console.log(
              'Error updating chat count:',
              updateResponse.data.errors,
            );
          } else {
            console.log(
              `Updated chat count for candidate ${candidate.node.id} from ${currentCount} to ${newCount}`,
            );
          }
        } else {
          console.log(
            `Chat count for candidate ${candidate.node.id} is already up to date`,
          );
        }
      }
    } catch (error) {
      console.error('Error in updateCandidates WithChatCount:', error);
    }
  }

  private async sendInsufficientCreditsEmail(apiToken: string, recruiterId: string) {
    try {
      const workspaceName = await this.workspaceQueryService.getWorkspaceNameFromToken(apiToken);
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByRecruiterId(recruiterId, apiToken);
      
      // Send socket notification to the recruiter
      if (recruiterId) {
        this.workspaceQueryService.webSocketService.sendToUser(recruiterId, 'openai_credits_status', {
          hasInsufficientCredits: true
        });
      }

      const emailTemplate = InsufficientCreditsEmail({
        userName: currentUser?.name || '',
        workspaceDisplayName: workspaceName || 'Arxena',
        locale: 'en',
      });

      const html = render(emailTemplate);
      const text = render(emailTemplate, {
        plainText: true,
      });

      await this.workspaceQueryService.emailService.send({
        from: `Arxena <${process.env.EMAIL_FROM_ADDRESS || 'no-reply@arxena.com'}>`,
        to: currentUser?.email,
        subject: 'OpenAI Credits Depleted - Action Required ⚠️',
        html,
        text,
      });

      console.log('Sent insufficient credits email to:', currentUser?.email);
    } catch (error) {
      console.error('Error sending insufficient credits email:', error);
    }
  }

  async processCandidatesChatsGetStatuses(
    apiToken: string,
    jobIds: string[],
    candidateIds: string[] | null = null,
    updateType: string = "processCandidatesChatsGetStatuses",
  ) {
    console.log('This is the update type::', updateType);
    console.log('Processing candidates chats to get statuses with chat true');
    console.log('Received a lngth of candidate Ids::', candidateIds?.length);
    console.log('candidate Ids::', candidateIds);
    let allCandidates = await new CandidateEngagementArx(
      this.workspaceQueryService,
      this.staticGraphQLService,   
    ).fetchAllCandidatesWithAllChatControls(
      'allStartedAndStoppedChats',
    apiToken,
    );

    console.log(
      'Received a lngth of allCandidates in process Candidates Chats GetStatuses::',
      allCandidates?.length,
    );
    if (candidateIds && Array.isArray(candidateIds)) {
      allCandidates = allCandidates.filter(
        (candidate) =>
          candidateIds.includes(candidate.id) && candidate.candConversationStatus !== 'CONVERSATION_CLOSED_TO_BE_CONTACTED',
      );
    } else {
      console.log('Candidate Ids are not present in the request');
    }

    console.log(
      'Fetched',
      allCandidates?.length,
      ' candidates with chatControl allStartedAndStoppedChats in getStatus',
    );
    console.log('Fetched filtered candidates of', allCandidates);
    const semaphore = new Semaphore(10); // Allow 10 concurrent requests
    const processWithSemaphore = async (candidate: any) => {
      await semaphore.acquire();
      try {
        const candidateId = candidate?.id;

        console.log(
          'This is the candidate ID::',
          candidateId,
          'and candidate name for processing and getting udpated status::',
          candidate?.name,
        );
        const jobId = candidateIds
          ? jobIds[candidateIds.indexOf(candidateId)]
          : '';


        const recruiterId = candidate?.jobs?.recruiterId;

        if (jobId == '') {
          console.log('Job ID is not present for the candidate::', candidateId);
        }
        const whatsappMessages = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).fetchAllWhatsappMessages(candidateId, apiToken);
        // Get the chat status and formatted chat in parallel
        try {
          const [candidateStatus] = await Promise.all([
            new StageWiseClassification(
              this.workspaceQueryService,
              this.staticGraphQLService,
            ).getChatStageFromChatHistory(
              whatsappMessages,
              candidateId,
              jobId,
              apiToken,
            ) as Promise<allStatuses>,
          ]);

          // console.log(
          //   'This is the candidate status::',
          //   candidate,
          //   'for the candidate::',
          //   candidateId,
          //   'and the status is::',
          //   candidateStatus,
          // );

          return {
            candidateId,
            candidateStatus,
            googleSheetId: candidate?.jobs?.googleSheetId,
            whatsappMessages,
          };
        } catch (error) {
          console.log('Error in processing candidate:', error);
          if (error?.error?.type === 'insufficient_quota' || error?.code === 'insufficient_quota') {
            console.log('OpenAI credits depleted, sending notification email');
            await this.sendInsufficientCreditsEmail(apiToken, recruiterId);
          }
          throw error;
        }
      } catch (error) {
        console.log('Error in processing candidate:', error);
        return null;
      } finally {
        semaphore.release();
      }
    };
    const results = await Promise.all(
      allCandidates.map((candidate) => processWithSemaphore(candidate)),
    );
    const validResults = results.filter((result) => result !== null);
    // Batch update the candidate statuses
    const updatePromises = validResults.map(async (result) => {
      if (!result) return;
      const updateCandidateObjectVariables = {
        idToUpdate: result.candidateId,
        input: { candConversationStatus: result.candidateStatus },
      };
      const graphqlQueryObj = JSON.stringify({
        query: graphQltoUpdateOneCandidate,
        variables: updateCandidateObjectVariables,
      });

      // if (['CONVERSATION_CLOSED_TO_BE_CONTACTED', 'CANDIDATE_IS_KEEN_TO_CHAT'].includes(result.candidateStatus)){
      if (
        ['CONVERSATION_CLOSED_TO_BE_CONTACTED'].includes(result.candidateStatus)
      ) {
        const updateCandidateVariables = {
          idToUpdate: result.candidateId,
          input: { startChatCompleted: true },
        };
        const graphqlQueryObjForUpdationForCandidateStatus = JSON.stringify({
          query: graphQltoUpdateOneCandidate,
          variables: updateCandidateVariables,
        });

        try {
          await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, updateCandidateVariables, apiToken);
        } catch (e) {
          console.log('Error in candidate status update::', e);
        }
      }
      try {
        const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, updateCandidateObjectVariables, apiToken);

        console.log(
          'Candidate chat status updated successfully "with the status of ::',
          result.candidateStatus,
        );
      } catch (error) {
        console.log('Error in updating candidate chat count:', error);
      }
    });

    await Promise.all(updatePromises);

    return validResults;
  }


  async createAndUpdateWhatsappMessage(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    options?: { createdAt?: string },
  ) {
    console.log(
      'This is the message being updated in the database ',
      whatappUpdateMessageObj?.messages[0]?.content || '',
    );
    const createNewWhatsappMessageUpdateVariables = {
      input: {
        position: 'first',
        id: whatappUpdateMessageObj?.id || uuidv4(),
        candidateId: candidate?.id,
        personId: candidate?.peopleId,
        message:
        whatappUpdateMessageObj?.messages[0]?.content ||
        whatappUpdateMessageObj?.messages[0]?.text || '',
        phoneFrom: whatappUpdateMessageObj?.phoneNumberFrom,
        phoneTo: whatappUpdateMessageObj?.phoneNumberTo,
        jobsId: candidate?.jobs?.id,
        recruiterId: candidate?.jobs?.recruiterId,
        name: whatappUpdateMessageObj?.messageType,
        lastEngagementChatControl: whatappUpdateMessageObj?.lastEngagementChatControl,
        messageObj: whatappUpdateMessageObj?.messageObj,
        whatsappDeliveryStatus: whatappUpdateMessageObj.whatsappDeliveryStatus,
        whatsappMessageId: whatappUpdateMessageObj?.whatsappMessageId,
        typeOfMessage: whatappUpdateMessageObj?.typeOfMessage,
        audioFilePath: whatappUpdateMessageObj?.databaseFilePath,
        ...(options?.createdAt ? { createdAt: options.createdAt } : {}),
      },
    };


    try {
      console.log(
        'GRAPHQL WITH WHATSAPP MESSAGE:',
        createNewWhatsappMessageUpdateVariables?.input?.message,
      );
      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToCreateOneNewWhatsappMessage, createNewWhatsappMessageUpdateVariables, apiToken);
      const recruiterId = candidate?.jobs?.recruiterId;
      console.log('This is the recruiterId::', recruiterId);
      if (recruiterId) {
        console.log('Sending WebSocket event to the specific recruiter::', recruiterId);
        this.workspaceQueryService.webSocketService.sendToUser(recruiterId, 'whatsapp_message_updated', {
          candidateId: candidate?.id,
          jobId: candidate?.jobs?.id,
          messageId: createNewWhatsappMessageUpdateVariables.input.id,
        });
        console.log('WebSocket event sent to the specific recruiter::', recruiterId);
      } else {
        console.log('No recruiterId found for the message, skipping WebSocket notification');
      }

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementStatus(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    const candidateEngagementStatus = whatappUpdateMessageObj.messageType !== 'botMessage';

    console.log( 'Updating candidate engagement status to:', candidateEngagementStatus, 'for candidate id::', candidate?.id);
    const updateCandidateObjectVariables = {
      idToUpdate: candidate?.id,
      input: {
        engagementStatus: candidateEngagementStatus,
        lastEngagementChatControl:
          whatappUpdateMessageObj.lastEngagementChatControl,
      },
    };
    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, updateCandidateObjectVariables, apiToken);
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
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
    const updateCandidateObjectVariables = {
      idToUpdate: candidateId,
      input: { engagementStatus: false },
    };

    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, updateCandidateObjectVariables, apiToken);

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

  async updateCandidateEngagementDataInTable(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    isAfterMessageSent = false,
  ) {

    if (candidate?.name === '') return;
    console.log('Candidate information retrieved successfully');
    const whatsappMessage = await this.createAndUpdateWhatsappMessage(
      candidate,
      whatappUpdateMessageObj,
      apiToken,
    );

    if (!whatsappMessage || isAfterMessageSent) {
      console.log( 'WhatsApp message not found or message already sent, hence not updating the candidate engagement status to true', );
      return;
    }
    const updateCandidateStatusObj = await this.updateCandidateEngagementStatus(
      candidate,
      whatappUpdateMessageObj,
      apiToken,
    );

    if (!updateCandidateStatusObj) return;

    await this.updateCandidateEngagementStatusAndChatCounts(
      candidate,
      whatappUpdateMessageObj,
      apiToken,
    );
    return {
      status: 'success',
      message: 'Candidate engagement status updated successfully',
    };
  }


  async updateCandidateEngagementStatusAndChatCounts(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    // console.log('whatappUpdateMessageObj::', whatappUpdateMessageObj);
    // console.log('Updating candidate engagement status and chat counts');
    // console.log('Candidate profile object::', candidate);
    // console.log('Whatapp update message object::', whatappUpdateMessageObj);

    await this.updateCandidatesWithChatCount([candidate?.id], apiToken);

    const results = await this.processCandidatesChatsGetStatuses(apiToken, [candidate?.jobs?.id],[candidate?.id], "updateCandidateEngagementStatusAndChatCounts");
    // console.log('Results from updating candidate engagement status and chat counts::', results);
    return results;
  }

  async removeChatsByMessageIDs(messageIDs: string[], apiToken: string) {
    const graphQLVariables = { filter: { id: { in: messageIDs } } };
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToRemoveMessages,
      variables: graphQLVariables,
    });
    const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToRemoveMessages, graphQLVariables, apiToken);

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
      const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, updateCandidateObjectVariables, apiToken);

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
    console.log(`🔄 Syncing ${baileysMessages.length} Baileys messages with database for candidate: ${candidateId}`);
    
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Get existing messages from database for this candidate
      const existingMessages = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllWhatsappMessages(candidateId, apiToken);
      console.log("existingMessages in syncBaileysMessagesWithDatabase:", existingMessages);
      // Create a set of existing message IDs for quick lookup
      const existingMessageIds = new Set(
        existingMessages.map(msg => (msg as any).whatsappMessageId).filter(Boolean)
      );

      console.log(`📊 Found ${existingMessages.length} existing messages in database`);

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
          const whatsappMessageObj: whatappUpdateMessageObjType = {
            id: baileysMessage.id,
            phoneNumberFrom: isFromMe 
              ? candidate.phoneNumber?.primaryPhoneNumber || ''
              : baileysMessage.phoneFrom || '',
            phoneNumberTo: isFromMe 
              ? baileysMessage.phoneTo || ''
              : candidate.phoneNumber?.primaryPhoneNumber || '',
            messageType: isFromMe ? 'botMessage' : 'userMessage',
            messages: [{
              role: isFromMe ? 'assistant' : 'user',
              content: messageContent
            }],
            messageObj: [{
              role: isFromMe ? 'assistant' : 'user',
              content: messageContent
            }],
            whatsappDeliveryStatus: 'receivedFromCandidate',
            whatsappMessageId: baileysMessage.id,
            typeOfMessage: messageType,
            lastEngagementChatControl: 'startChat',
            candidateProfile: candidate,
            candidateFirstName: candidate.name?.split(' ')[0] || '',
            whatsappMessageType: messageType
          };

          // Save message to database
          await this.createAndUpdateWhatsappMessage(
            candidate,
            whatsappMessageObj,
            apiToken
          );

          synced++;
          console.log(`✅ Synced message: ${baileysMessage.id}`);

        } catch (error) {
          console.error(`❌ Error syncing message ${baileysMessage.id}:`, error);
          errors++;
        }
      }

      console.log(`📈 Sync completed - Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`);
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
      ).fetchAllWhatsappMessages(candidateId, apiToken);

      const existingMessageIds = new Set(
        existingMessages
          .map((msg) => (msg as { whatsappMessageId?: string }).whatsappMessageId)
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
          candidate.phoneNumber?.primaryPhoneNumber ||
          '',
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
          const messageContent = this.extractUnipileMessageContent(unipileMessage);

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

          const whatsappMessageObj: whatappUpdateMessageObjType = {
            id: unipileMessageId,
            phoneNumberFrom: phoneFrom,
            phoneNumberTo: phoneTo,
            messageType: isFromConnectedUser ? 'botMessage' : 'whatsapp-unipile',
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
            whatsappMessageId: unipileMessageId,
            typeOfMessage: this.determineUnipileMessageType(unipileMessage),
            lastEngagementChatControl: 'startChat',
            candidateProfile: candidate,
            candidateFirstName: candidate.name?.split(' ')[0] || '',
            whatsappMessageType: this.determineUnipileMessageType(unipileMessage),
          };

          await this.createAndUpdateWhatsappMessage(
            candidate,
            whatsappMessageObj,
            apiToken,
            unipileMessage.timestamp
              ? { createdAt: unipileMessage.timestamp }
              : undefined,
          );

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
    baileysMessages: any[]
  ): Promise<{ synced: number; skipped: number; errors: number }> {
    console.log(`🔄 Syncing messages for phone number: ${phoneNumber}, candidate: ${candidateId}`);
    
    try {
      console.log("baileysMessages in syncMessagesForPhoneNumber:", baileysMessages);
      // Filter messages for this specific phone number
      const phoneNumberClean = phoneNumber.replace(/[^0-9]/g, '');
      const relevantMessages = baileysMessages.filter(msg => {
        const fromPhone = msg.phoneFrom?.replace(/[^0-9]/g, '') || '';
        const toPhone = msg.phoneTo?.replace(/[^0-9]/g, '') || '';
        return fromPhone === phoneNumberClean || toPhone === phoneNumberClean;
      });

      console.log(`📱 Found ${relevantMessages.length} relevant messages for phone number: ${phoneNumber}`);

      if (relevantMessages.length === 0) {
        console.log("No relevant messages found in syncMessagesForPhoneNumber");
        return { synced: 0, skipped: 0, errors: 0 };
      }

      console.log("relevantMessages in syncMessagesForPhoneNumber:", relevantMessages);

      // Sync the messages
      return await this.syncBaileysMessagesWithDatabase(
        relevantMessages,
        candidateId,
        apiToken
      );

    } catch (error) {
      console.error('❌ Error syncing messages for phone number:', error);
      return { synced: 0, skipped: 0, errors: baileysMessages.length };
    }
  }
}
