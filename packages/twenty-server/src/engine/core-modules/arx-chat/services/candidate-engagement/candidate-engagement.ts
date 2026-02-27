import {
  CandidateEdge,
  CandidateNode,
  ChatControlsObjType,
  chatControlType,
  ChatHistoryItem,
  graphqlToFetchAllCandidateData,
  graphqlToFetchAllCandidateDataWithFieldValues,
  graphQlToFetchWhatsappMessages,
  graphqlToFindManyJobs,
  graphQltoUpdateOneCandidate,
  Job,
  JobEdge,
  MessageNode,
  PageInfo,
  RecruiterProfileType,
  whatappUpdateMessageObjType
} from 'twenty-shared';

import { ChatFlowConfigBuilder } from 'src/engine/core-modules/arx-chat/services/chat-flow-config';
import { OpenAIArxMultiStepClient } from 'src/engine/core-modules/arx-chat/services/llm-agents/arx-multi-step-client';
import { PromptingAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-agents';
import { TimeManagement } from 'src/engine/core-modules/arx-chat/services/time-management';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { Injectable, Optional } from '@nestjs/common';
import axios from 'axios';
import { sortWhatsAppMessages } from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { v4 as uuidv4 } from 'uuid';
import { RecruiterProfileService } from '../recruiter-profile';
import { FilterCandidates } from './filter-candidates';

export interface ChatFlowConfig {
  order: number;
  type: chatControlType;
  filterLogic: (candidate: CandidateNode) => boolean;
  preProcessing?: (
    candidates: CandidateNode[],
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
    workspaceQueryService: WorkspaceQueryService,
  ) => Promise<void>;
  chatFilters: () => Array<Record<string, any>>;
  isEligibleForEngagement: (candidate: CandidateNode) => boolean;
  statusUpdate?: {
    isWithinAllowedTime: () => boolean;
    filter: Record<string, any>;
    orderBy?: Array<Record<string, any>>;
  };
  filter: Record<string, any>;
  orderBy: Array<Record<string, any>>;
  templateConfig: {
    defaultTemplate: string;
    messageSetup: (isFirstMessage: boolean) => {
      whatsappTemplate: string;
      requiresSystemPrompt: boolean;
      userContent: string;
    };
  };
}

@Injectable()
export class CandidateEngagementArx {
  private chatFlowConfigBuilder: ChatFlowConfigBuilder;
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    @Optional() private readonly updateChat?: any, // UpdateChat type to avoid circular dependency
  ) {
    this.chatFlowConfigBuilder = new ChatFlowConfigBuilder(
      workspaceQueryService,
      staticGraphQLService,
    );
  }

  // Static factory method for backward compatibility
  static create(
    workspaceQueryService: WorkspaceQueryService,
    staticGraphQLService: StaticGraphQLService,
  ): CandidateEngagementArx {
    // Create instance without UpdateChat dependency to avoid circular import
    const instance = new CandidateEngagementArx(workspaceQueryService, staticGraphQLService, undefined);
    return instance;
  }

  async getSystemPrompt(
    candidate: CandidateNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log('This is the chatControl:', chatControl);
    if (chatControl.chatControlType == 'startVideoInterviewChat') {
      return new PromptingAgents(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getVideoInterviewPrompt(candidate, candidateJob, apiToken);
    } else if (chatControl.chatControlType === 'startChat') {
      return new PromptingAgents(this.workspaceQueryService, this.staticGraphQLService).getStartChatPrompt(
        candidate,
        candidateJob,
        apiToken,
      );
    } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return new PromptingAgents(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getStartMeetingSchedulingPrompt(candidate, candidateJob, apiToken);
    } else {
      return new PromptingAgents(this.workspaceQueryService, this.staticGraphQLService).getStartChatPrompt(
        candidate,
        candidateJob,
        apiToken,
      );
    }
  }

  async getChatTemplateFromChatControls(
    chatControl: ChatControlsObjType,
    sortedMessagesList: MessageNode[],
    candidateJob: Job,
    candidate: CandidateNode,
    apiToken: string,
    chatReply: chatControlType,
    recruiterProfile: RecruiterProfileType,
    chatFlowConfigObj: Record<string, ChatFlowConfig>,
  ) {
    const config = chatFlowConfigObj[chatReply].templateConfig;
    const isFirstMessage =
      candidate?.whatsappMessages
        ?.edges.length === 0;
    const messageSetup = config.messageSetup(isFirstMessage);
    const chatHistory = sortedMessagesList[0]?.messageObj || [];
    if (messageSetup.requiresSystemPrompt) {
      const SYSTEM_PROMPT = await this.getSystemPrompt(
        candidate,
        candidateJob,
        chatControl,
        apiToken,
      );
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    }
    chatHistory.push({ role: 'user', content: messageSetup.userContent });

    const whatsappTemplate =
      candidate?.whatsappProvider ||
      config.defaultTemplate;

    let messageFrom:string = '';
    if (candidate?.messagingChannel == 'linkedin' || candidate?.messagingChannel == 'linkedin-sock') {
      messageFrom = candidate?.linkedinUrl?.primaryLinkUrl || '';
    } else if (candidate?.phoneNumber?.primaryPhoneNumber) {
      messageFrom = candidate.phoneNumber.primaryPhoneNumber.length == 10
          ? '91' + candidate.phoneNumber.primaryPhoneNumber
          : candidate.phoneNumber.primaryPhoneNumber;
    } else {
      console.warn('No phone number found for candidate, using empty string');
      messageFrom = '';
    }

    let messageTo:string = recruiterProfile.phoneNumber;
    console.log("This is recruiter profile:", recruiterProfile)

    if (candidate?.messagingChannel == 'linkedin' || candidate?.messagingChannel == 'linkedin-sock') {
      messageTo = recruiterProfile.linkedinUrl || '';
    }
    else{
      messageTo = recruiterProfile.phoneNumber
    }


    console.log("This is the messaging channel ::", candidate?.messagingChannel)
    console.log("This is the whatsapp provider ::", candidate?.whatsappProvider)

    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: candidate,
      candidateFirstName: candidate?.name,
      phoneNumberFrom: messageFrom,
      whatsappMessageType: whatsappTemplate,
      phoneNumberTo: messageTo,
      messages: [{ content: chatReply }],
      lastEngagementChatControl: chatControl.chatControlType,
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
      typeOfMessage: candidate?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };
    console.log('This is the whatappUpdateMessageObj::', whatappUpdateMessageObj);

    return whatappUpdateMessageObj;
  }

  async createAndUpdateCandidateStartChatChatMessage(
    chatReply: chatControlType,
    candidate: CandidateNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
    chatFlowConfigObj,
  ) {
    console.log('Creating and updating candidate start chat messages');

    // For LinkedIn candidates, we should allow startChat even without phone number
    if (!candidate?.phoneNumber?.primaryPhoneNumber && candidate.messagingChannel !== 'linkedin' && candidate.messagingChannel !== 'linkedin-premium') {
      console.log('Phone number from is empty, returning empty candidate profile object');
      return;
    }

    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob as Job,
      apiToken,
    );

    const candidateId = candidate?.id || '';
    console.log("candidateId::", candidateId)
    if (candidateId && chatReply === 'startChat') {
      const companyName = candidate?.candidateFieldValues?.edges?.find(field => field.node.name === 'job_company_name')?.node?.name;
      const jobTitle = candidate?.candidateFieldValues?.edges?.find(field => field.node.name === 'job_name')?.node?.name;
      console.log('companyName in google contacts::', companyName);
      console.log('jobTitle in google contacts::', jobTitle);
    }

    console.log('Candidate ID to start chat::', candidateId);
    const messagesList: MessageNode[] = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllWhatsappMessages(candidateId, apiToken);
    console.log("messagesList::", messagesList)
    const sortedMessagesList: MessageNode[] = messagesList.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const whatappUpdateMessageObj = await this.getChatTemplateFromChatControls(
      chatControl,
      sortedMessagesList,
      candidateJob,
      candidate,
      apiToken,
      chatReply,
      recruiterProfile,
      chatFlowConfigObj,
    );

    if (this.updateChat) {
      await this.updateChat.updateCandidateEngagementDataInTable(candidate, whatappUpdateMessageObj,  apiToken);
    } else {
      // Fallback to direct instantiation if UpdateChat is not injected
      const { UpdateChat } = await import('./update-chat');
      const updateChat = UpdateChat.create(this.workspaceQueryService, this.staticGraphQLService);
      await updateChat.updateCandidateEngagementDataInTable(candidate, whatappUpdateMessageObj,  apiToken);
    }
  }

  async processCandidate(
    candidate: CandidateNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log( 'Engagement Type for the candidate ::', candidate.name, 'for chat control::', chatControl.chatControlType, );
    try {
      const candidateId = candidate?.id || '';
      const messagesList: MessageNode[] = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllWhatsappMessages(candidateId, apiToken);

      console.log( 'the number of messages in the message list is::', messagesList.length, );
      const mostRecentMessageArr: ChatHistoryItem[] = new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getMostRecentMessageFromMessagesList(messagesList);

      // if (mostRecentMessageArr?.length > 0) {
        console.log( 'Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE, 'for candidate::', candidate.name, );
        await new OpenAIArxMultiStepClient(
          candidate,
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).createCompletion(
          mostRecentMessageArr,
          candidateJob as Job,
          chatControl,
          apiToken,
        );
      // } else {
      //   console.log(
      //     'mostRecentMessageArr?.length is not greater than 0, hence no engagement:: (length)::',
      //     mostRecentMessageArr?.length,
      //   );
      // }
    } catch (error) {
      console.log('This is the error in processCandidate', error);
    }
  }
  private async checkForStageTransitions(
    candidate: any,
    chatFlowOrder: string[],
    apiToken: string,
  ): Promise<boolean> {
    for (let i = 0; i < chatFlowOrder.length - 1; i++) {
      const currentStage = chatFlowOrder[i];
      const nextStage = chatFlowOrder[i + 1];

      // Check if current stage is completed but next stage hasn't started
      const isCurrentStageCompleted =
        candidate[`${currentStage}Completed`] === true;
      const hasNextStageStarted = candidate[nextStage] === true;

      if (isCurrentStageCompleted && !hasNextStageStarted) {
        // Create the next stage's chat control
        await this.createChatControl(
          candidate.id,
          { chatControlType: nextStage as chatControlType },
          apiToken,
        );
        return true;
      }
    }

    return false;
  }

  private async fetchCandidateById(
    candidateId: string,
    apiToken: string,
  ): Promise<any> {

    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
      filter: {
        id: {
          eq: candidateId,
        },
      },
    }, apiToken);

    const candidates = response?.data?.data?.candidates as { 
      edges: CandidateEdge[];
      pageInfo: PageInfo;
    } | undefined;

    return candidates?.edges[0]?.node;
  }

  private async fetchRecentMessages(
    startTime: Date,
    endTime: Date,
    apiToken: string,
  ) {
    console.log('Fetching recent messages from startTime to endTime');
    const graphqlQueryObj = JSON.stringify({
      query: graphQlToFetchWhatsappMessages,
      variables: {
        filter: {
          createdAt: {
            gte: startTime.toISOString(),
            lte: endTime.toISOString(),
          },
        },
      },
    });

    console.log(
      'The value of startTime.toISOString():',
      startTime.toISOString(),
    );
    console.log('The value of endTime.toISOString()():', endTime.toISOString());

    const response = await this.staticGraphQLService.executeGraphQL(graphQlToFetchWhatsappMessages, {
      filter: {
        createdAt: {
          gte: startTime.toISOString(),
          lte: endTime.toISOString(),
        },
      },
    }, apiToken);

    // console.log(
    //   'Number of messages in fetchRe centMessages::',
    //   response?.data?.data?.whatsappMessages?.edges.length,
    // );

    const messages = response?.data?.data?.whatsappMessages as { 
      edges: MessageNode[];
      pageInfo: PageInfo;
    } | undefined;

    // console.log("This is the response from cre atedAt::", response?.data?.data?.whatsappMessages?.edges.map((message) => message.node.createdAt));
    return messages?.edges || [];
  }

  private groupMessagesByJob(messages: any[]): Map<string, any[]> {
    const messagesByJob = new Map();

    for (const message of messages) {
      const jobId = message.node.jobsId;

      if (!messagesByJob.has(jobId)) {
        messagesByJob.set(jobId, []);
      }
      messagesByJob.get(jobId).push(message);
    }

    return messagesByJob;
  }

  async makeUpdatesonChats(
    apiToken: string,
  ): Promise<{ candidateIds: string[]; jobIds: string[] }> {
    console.log('Going to make updates on chats');
    try {
      const timeWindow =
        TimeManagement.timeDifferentials
          .timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls;
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeWindow * 60 * 1000);

      const messages = await this.fetchRecentMessages(
        startTime,
        endTime,
        apiToken,
      );

      console.log('Number of messages::', messages.length);
      const messagesByJob = this.groupMessagesByJob(messages);

      console.log('Number of Jobs::', messagesByJob.size);

      const eligibleCandidates = new Set<string>();
      const eligibleJobs = new Set<string>();
      const processedCandidates = new Set<string>();

      for (const [jobId, jobMessages] of messagesByJob.entries()) {
        const job = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).fetchJobById(jobId, apiToken);

        const chatFlowOrder =
          job?.chatFlowOrder ||
          this.chatFlowConfigBuilder.getDefaultChatFlowOrder();

        // Get unique candidate IDs for this job
        const candidateIds = [
          ...new Set(jobMessages.map((message) => message.node.candidate.id)),
        ];
        const jobIds = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
          ).getJobIdsFromCandidateIds(candidateIds, apiToken);

        console.log(
          'Number of Candidate IDs for which we are going to do updates::',
          candidateIds.length,
        );

        // Update chat counts first
        let results;
        if (this.updateChat) {
          await this.updateChat.updateCandidatesWithChatCount(candidateIds, apiToken);
          // Process chat statuses
          results = await this.updateChat.processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds, "makeUpdatesonChats");
        } else {
          // Fallback to direct instantiation if UpdateChat is not injected
          const { UpdateChat } = await import('./update-chat');
          const updateChat = UpdateChat.create(this.workspaceQueryService, this.staticGraphQLService);
          await updateChat.updateCandidatesWithChatCount(candidateIds, apiToken);
          // Process chat statuses
          results = await updateChat.processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds, "makeUpdatesonChats");
        }

        await new GoogleSheetsService(
          this.staticGraphQLService,
        ).updateGoogleSheetsWithChatData(
          results,
          apiToken,
        );

        // Check stage transitions for each unique candidate only once
        for (const message of jobMessages) {
          const candidateId = message.node.candidate.id;

          // Skip if we've already processed this candidate
          if (processedCandidates.has(candidateId)) {
            continue;
          }

          processedCandidates.add(candidateId);

          const candidate = await this.fetchCandidateById(
            candidateId,
            apiToken,
          );

          if (
            await this.checkForStageTransitions(
              candidate,
              chatFlowOrder,
              apiToken,
            )
          ) {
            eligibleCandidates.add(candidateId);
            eligibleJobs.add(jobId);
          }
        }
      }

      console.log(
        'Number of eligibleCandidates::',
        eligibleCandidates.size,
        'Number of eligibleJobs::',
        eligibleJobs.size,
      );

      return {
        candidateIds: Array.from(eligibleCandidates),
        jobIds: Array.from(eligibleJobs),
      };
    } catch (error) {
      console.error('Error in makeUpdatesonChats:', error);

      return { candidateIds: [], jobIds: [] };
    }
  }

  // Helper methods for grouping candidates by job
  private async groupCandidatesByJob(
    candidateIds: string[],
    apiToken: string,
  ): Promise<Record<string, string[]>> {
    if (candidateIds.length === 0) {
      return {};
    }

    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
      filter: { id: { in: candidateIds } },
    }, apiToken);

    const candidates = response?.data?.data?.candidates as { 
      edges: CandidateEdge[];
      pageInfo: PageInfo;
    } | undefined;

    console.log('Candidates array:', candidates);

    const groupedCandidates = candidates?.edges.reduce(
      (acc: Record<string, string[]>, edge: any) => {
        // Add null checks
        if (!edge?.node) {
          console.log('Invalid edge object:', edge);

          return acc;
        }
        const jobId = edge.node.jobs?.id;
        const candidateId = edge.node.id;
        if (jobId && candidateId) {
          acc[jobId] = acc[jobId] || [];
          acc[jobId].push(candidateId);
          console.log(`Added candidate ${candidateId} to job ${jobId}`);
        } else {
          console.log('Missing jobId or candidateId:', {
            jobId,
            candidateId,
            edge,
          });
        }

        return acc;
      },
      {},
    );

    console.log('Final grouped candidates:', groupedCandidates);

    return groupedCandidates || {};
  }

  async createChatControl(
    candidateId: string,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log(
      'Dynamically changing the chat controls to true if conditions are being met.',
    );
    console.log(
      'Setting the:::chatControl.chatControlType:::',
      chatControl.chatControlType,
      'to true for candidate::',
      candidateId,
    );
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: { [chatControl.chatControlType]: true, stopChat: false },
    };  
    const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariables, apiToken);

    if (response.data.errors) {
      console.log('Error in startChat:', response.data.errors);
    }
    
    // console.log(
    //   'Response from create ChatControl',
    //   response.data.data?.updateCandidate,
    //   'for chat control',
    //   chatControl.chatControlType,
    //   'for candidate ID:',
    //   candidateId,
    // );

    return response.data;
  }

  async engageCandidates(
    candidates: CandidateNode[],
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    chatFlowConfigObj,
    apiToken: string,
  ) {
    console.log(
      'These are the candidates who we want to engage ::',
      candidates.length,
      'for chat Control:',
      chatControl.chatControlType,
    );

    const sortedCandidates: CandidateNode[] = sortWhatsAppMessages(
      candidates,
    );
    const config = chatFlowConfigObj[chatControl.chatControlType];

    if (!config) {
      console.log( `No configuration found for chat control type: ${chatControl?.chatControlType}`, );
      return;
    }

    const filteredCandidatesToEngage = sortedCandidates.filter((candidate) => {
      const isEligible = candidate
        ? config.isEligibleForEngagement(candidate)
        : false;
      return isEligible;
    });

    console.log( 'Number of filtered candidates to engage after time scheduling: ', filteredCandidatesToEngage?.length, 'for chatcontrol', chatControl.chatControlType, );
    console.log( 'Names of filtered candidates to engage after filtering ', filteredCandidatesToEngage?.map( (candidate) => candidate.name ), 'for chatcontrol', chatControl.chatControlType, );

    for (const candidate of filteredCandidatesToEngage) {
      if (this.updateChat) {
        await this.updateChat.setCandidateEngagementStatusToFalse( candidate?.id, apiToken );
      } else {
        const { UpdateChat } = await import('./update-chat');
        const updateChat = UpdateChat.create(this.workspaceQueryService, this.staticGraphQLService);
        await updateChat.setCandidateEngagementStatusToFalse( candidate?.id, apiToken );
      }
      await this.processCandidate( candidate, candidateJob, chatControl, apiToken );
    }
  }

  async startChatControlEngagement(
    candidates: CandidateNode[],
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    chatFlowConfigObj: Record<chatControlType, ChatFlowConfig>,
    apiToken: string,
  ) {
    console.log('This is the number of candidates in startChatControlEngagement::', candidates?.length, 'for job name::', candidateJob?.name);
    const config = chatFlowConfigObj[chatControl.chatControlType];

    if (!config) {
      console.log( `No configuration found for chat control type: ${chatControl?.chatControlType}`, );
      return;
    }

    await config.preProcessing?.(
      candidates as CandidateNode[],
      candidateJob,
      chatControl,
      apiToken,
      this.workspaceQueryService,
    );

    const filterCandidates = (candidate: CandidateNode) => {
      if (!candidate) return false;
      const chatFlowOrder =
        candidateJob?.chatFlowOrder ||
        this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
      const currentIndex = chatFlowOrder.indexOf(chatControl.chatControlType);

      if (currentIndex != 0) {
        if ( candidate?.lastEngagementChatControl !== chatControl?.chatControlType ) {
          const waitTime = TimeManagement?.timeDifferentials?.timeDifferentialInMinutesBeforeStartingNextStageMessaging * 60 * 1000;
          const cutoffTime = new Date(Date.now() - waitTime).toISOString();
          if (new Date(candidate?.updatedAt).toISOString() > cutoffTime) {
            console.log( `Stage transition waiting period not elapsed for candidate ${candidate?.name}, last engagement was ${candidate?.lastEngagementChatControl}, last udpated was ${candidate?.updatedAt} and cutoff time is ${cutoffTime}` );
            return false;
          }
        } else {
          console.log(`Candidate ${candidate?.name} is eligible for stage transition from startChat because its the first one`);
        }
      }
      return config.filterLogic(candidate);
    };

    const filteredCandidatesToStartEngagement = candidates?.filter(filterCandidates);
    console.log( 'Number of candidates to start chat engagement::', filteredCandidatesToStartEngagement?.length, 'for chatControl::', chatControl?.chatControlType, 'for job name::', candidateJob?.name );
    for (const candidate of filteredCandidatesToStartEngagement) {
      const chatReply: chatControlType = chatControl.chatControlType;
      await this.createAndUpdateCandidateStartChatChatMessage(
        chatReply,
        candidate,
        candidateJob,
        chatControl,
        apiToken,
        chatFlowConfigObj,
      );
    }
  }


  async fetchAllCandidatesWithAllChatControlsByJobId(
    jobId: string,
    apiToken: string,
  ): Promise<CandidateNode[]> {
    console.log('Fetching all candidates with chatControlType by job ID:', jobId);
    const allCandidates: CandidateNode[] = [];
    try {
      const timestampedFilter = {
        jobsId: { eq: jobId },
      };
      let hasNextPage = true;
      let lastCursor: string | null = null;
      while (hasNextPage) {
        const response = await this.staticGraphQLService.executeGraphQL(
          // graphqlToFetchAllCandidateDataForTable, { lastCursor, limit: 400, filter: timestampedFilter, orderBy: [{ createdAt: 'DESC' }] },
          graphqlToFetchAllCandidateDataWithFieldValues, { lastCursor, limit: 400, filter: timestampedFilter, orderBy: [{ createdAt: 'DESC' }] },
          apiToken,
        );
        const candidates = response?.data?.data?.candidates as { 
          edges: CandidateEdge[];
          pageInfo: PageInfo;
        } | undefined;
        if (!candidates) {
          console.log('No candidates found for this filter condition');
          break;
        }
        const edges = candidates.edges || [];
        hasNextPage = candidates.pageInfo?.hasNextPage || false;
        if (!edges.length) {
          hasNextPage = false;
          break;
        }
        allCandidates.push(...edges.map((edge) => edge.node));
        if (!hasNextPage) {
          break;
        }
        lastCursor = candidates.pageInfo?.endCursor;
      }
      console.log(`Fetched ${allCandidates.length} candidates for job ID ${jobId}`);
      return allCandidates;
    } catch (error) {
      console.error('Error fetching candidates by job ID:', error);
      throw error;
    }
  }

  
  async fetchAllCandidatesWithAllChatControls(
    chatControlType: chatControlType,
    apiToken: string,
  ): Promise<CandidateNode[]> {

    let filters;
    if (chatControlType === 'allStartedAndStoppedChats') {
      filters = [
        { stopChat: { eq: false }, startChat: { eq: true } },
        { stopChat: { eq: true }, startChat: { eq: true } },
      ];
    }
    const allCandidates: CandidateNode[] = [];
    try {
      const timestamp = new Date().toISOString();

      for (const filter of filters) {
        let lastCursor: string | null = null;
        const timestampedFilter = {
          ...filter,
          updatedAt: { lte: timestamp },
        };

        let hasNextPage = true;

        while (hasNextPage) {
          // const graphqlQueryObj = JSON.stringify({
          //   query: graphqlQueryObjToFetchAllCandidatesForChats,
          //   variables: {
          //     lastCursor,
          //     limit: 400,
          //     filter: timestampedFilter,
          //     orderBy: [{ updatedAt: 'DESC' }],
          //   },
          // });


          const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
            lastCursor,
            limit: 400,
            filter: timestampedFilter,
            orderBy: [{ updatedAt: 'DESC' }],
          }, apiToken);

        const candidates = response?.data?.data?.candidates as { 
          edges: CandidateEdge[];
          pageInfo: PageInfo;
        } | undefined;

          if (!candidates?.edges.length) break;
          hasNextPage = candidates?.pageInfo?.hasNextPage || false;
          const newCandidates = candidates?.edges
            .map((edge: any) => edge.node)
            .filter((candidate: CandidateNode) => {
              const isNew = !allCandidates.some(
                (existing) => existing.id === candidate.id,
              );
              const isRecent =
                new Date(candidate.updatedAt) <= new Date(timestamp);
              return isNew && isRecent;
            });
          allCandidates.push(...newCandidates);
          if (!hasNextPage) break;
          lastCursor = candidates?.pageInfo?.endCursor;
        }
      }
      console.log( `Fetched ${allCandidates.length} fresh candidates at ${timestamp} for chatControlType ${chatControlType}` );
    } catch (error) {
      console.log('Error fetching candidates:', error);
    }

    return allCandidates;
  }

  async fetchAllCandidatesWithSpecificChatControl(
    chatControlType: chatControlType,
    activeJobsIds: string[],
    chatFlowConfigObj: Record<string, ChatFlowConfig>,
    apiToken: string,
  ): Promise<CandidateNode[]> {
    const config = chatFlowConfigObj[chatControlType];
    if (!config || !config.chatFilters) {
      console.log( `No configuration or filters found for chat control type: ${chatControlType}` );
      return [];
    }

    // If there are no active jobs, return empty array
    if (!activeJobsIds || activeJobsIds.length === 0) {
      console.log('No active jobs found, returning empty candidates array');
      return [];
    }
    console.log("activeJobsIds::", activeJobsIds);
    const filters = config.chatFilters();
    const allCandidates: CandidateNode[] = [];
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const timestamp = new Date().toISOString();
    for (const filter of filters) {
        let lastCursor: string | null = null;
        const jobsIdFilter = {
          or: [
            { and: [
              { jobsId: { in: activeJobsIds } },
              { engagementStatus: { eq: true } },
              { startChat: { eq: true } },
              { stopChat: { eq: false }},
              {or:[{startChatCompleted:{eq:false}},{startChatCompleted:{is:"NULL"}}]},
            ] },
            { and: [
              { jobsId: { in: activeJobsIds } },
              { engagementStatus: { eq: false } },
              { startChat: { eq: true } },
              { stopChat: { eq: false }},
              { and: [
                { updatedAt: { lte: timestamp } },
                { updatedAt: { gte: new Date(new Date(timestamp).getTime() - 15 * 60 * 1000).toISOString() } },
              ] },
            ] },



              // { startChatCompleted: { eq: false }},
            // { and: [
            // ] },
            // { and: [
            //   { engagementStatus: { eq: false } },
            //   { startChat: { eq: true } },
            //   { stopChat: { eq: false }},
            // ] },
          // ] },
        ],
          // ...filter,
        };
        // console.log('jobsIdFilter::', jobsIdFilter);
        const timestampedFilter = {
          ...filter,
          updatedAt: { lte: timestamp },
        };


        let hasNextPage = true;
        while (hasNextPage) {
          // const variables ={
          //   ...timestampedFilter,
          // }
          // console.log("variables::", variables);
          const variables = {
            lastCursor,
            limit: 400,
            filter: jobsIdFilter,
            orderBy: [{ updatedAt: 'DESC' }],
          }

          const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, variables, apiToken);
          const candidates = response?.data?.data?.candidates as { 
            edges: CandidateEdge[];
            pageInfo: PageInfo;
          } | undefined;
          // console.log('candidates::', candidates?.edges[0]?.node.engagementStatus, candidates?.edges[0]?.node.startChat, candidates?.edges[0]?.node.stopChat);
          if (response.data.errors) {
            console.log( 'Errors in executeGraphQL:', response.data.errors, 'with workspace Id:', workspaceId );
            break;
          }
          const edges = candidates?.edges || [];
          hasNextPage = candidates?.pageInfo?.hasNextPage || false;
          if (!edges.length) {
            break;
          }
          console.log("All candidates::", allCandidates?.length, "for workspaceId::", workspaceId);
          const newCandidates = edges
            .map((edge: any) => edge.node)
            .filter((candidate: CandidateNode) => {
              const isNew = !allCandidates.some(
                (existing) => existing.id === candidate.id,
              );
              const isRecent =
                new Date(candidate.updatedAt) <= new Date(timestamp);
              return isNew && isRecent;
            });
          allCandidates.push(...newCandidates);
          console.log('newCandidates::', newCandidates.length, 'for workspaceId::', workspaceId);
          console.log("Candidate names fetched::", allCandidates?.map((candidate) => candidate.name));
          if (!hasNextPage) {
            break;
          }
          lastCursor = candidates?.pageInfo?.endCursor || null;
        }
      }
      console.log(
        `Fetched ${allCandidates.length} fresh candidates at ${timestamp} for chatControlType ${chatControlType}`,
      );
    } catch (error) {
      console.error('Error fetching candidates:', error);
      console.error('Stack trace:', error.stack);
    }
    console.log("Number of candidates fetched in fetchAllCandidatesWithSpecificChatControl::", allCandidates.length);
    return allCandidates;
  }

  async updateCandidatesChatControls(apiToken: string) {
    const { candidateIds, jobIds } = await this.makeUpdatesonChats(apiToken);
    const candidatesByJob = await this.groupCandidatesByJob(
      candidateIds,
      apiToken,
    );

    for (const [jobId, jobCandidates] of Object.entries(candidatesByJob)) {
      const job = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchJobById(jobId, apiToken);
      const chatFlowOrder = job?.chatFlowOrder || this.chatFlowConfigBuilder.getDefaultChatFlowOrder();

      for (const candidateId of jobCandidates) {
        const candidate = await this.fetchCandidateById(candidateId, apiToken);
        for (let i = 0; i < chatFlowOrder.length - 1; i++) {
          const currentStage = chatFlowOrder[i];
          const nextStage = chatFlowOrder[i + 1];
          const isCurrentStageCompleted = candidate[`${currentStage}Completed`];
          const hasNextStageStarted = candidate[nextStage];

          if (isCurrentStageCompleted && !hasNextStageStarted) {
            await this.createChatControl(
              candidateId,
              { chatControlType: nextStage as chatControlType },
              apiToken,
            );
            console.log( `Transitioned candidate ${candidateId} from ${currentStage} to ${nextStage}`, );
            break;
          }
        }
      }
    }
  }

  async fetchSpecificPeopleToEngageBasedOnChatControl(
    chatControl: ChatControlsObjType,
    chatFlowConfigObj: Record<chatControlType, ChatFlowConfig>,
    apiToken: string,
  ): Promise<{ candidates: CandidateNode[]; candidateJobs: Map<string, Job> }> {
    try {

      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobs, { filter: { isActive: { eq: true } } }, apiToken);
      const activeJobs = response?.data?.data?.jobs as { 
        edges: JobEdge[];
        pageInfo: PageInfo;
      } | undefined;
      const activeJobsEdges = activeJobs?.edges || [];
      const activeJobsIds = activeJobsEdges.map((edge) => edge.node.id);
      console.log("activeJobs to consider::", activeJobsEdges.map((edge) => edge.node.name));

      const candidates = await this.fetchAllCandidatesWithSpecificChatControl(
        chatControl.chatControlType,
        activeJobsIds,
        chatFlowConfigObj,
        apiToken,
      );

      const candidateJobs = new Map<string, Job>();
      candidates.forEach((candidate) => {
        if (candidate?.jobs?.id) {
          candidateJobs.set(candidate.jobs.id, candidate.jobs);
        }
      });

      // const candidatePeopleIds = candidates
      //   ?.filter((c) => c?.people?.id)
      //   .map((c) => c?.people?.id);
      // const people = await new FilterCandidates(
      //   this.workspaceQueryService,
      //   this.staticGraphQLService,
      // ).fetchAllPeopleByPeopleIds(candidatePeopleIds, apiToken);
      console.log("Number of all people fetched ::", candidates.length);
      return { candidates, candidateJobs };
    } catch (error) {
      console.log(
        'Error in fetchSpecificPeopleTo EngageBasedOnChatControl:',
        error,
      );
      throw error;
    }
  }

  async executeCandidateEngagement(apiToken: string) {
    try {
      console.log('Cron running and cycle started to check candidate engagement' );
      console.log(`Execution started at: ${new Date().toISOString()}`);

      const defaultChatFlowOrder = this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
      let chatFlowConfigObj = this.chatFlowConfigBuilder.buildChatFlowConfig(defaultChatFlowOrder);

      const chatFlow = Object.entries(chatFlowConfigObj)
        .filter(([, config]) => config.order > 0)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([, config]) => ({ chatControlType: config.type }));

      for (const chatControl of chatFlow) {
        console.log("chatControl::", chatControl)
        const executionTime = new Date().toISOString();

        console.log( `Starting ${chatControl.chatControlType} execution at ${executionTime}`, );

        const { candidates, candidateJobs } =
          await this.fetchSpecificPeopleToEngageBasedOnChatControl(
            chatControl,
            chatFlowConfigObj as Record<chatControlType, ChatFlowConfig>,
            apiToken,
          );
          // console.log("Candidates fetched::", candidates?.map((candidate) => candidate.name));
          console.log("Number of candidates fetched::", candidates?.length, "for chatControlType::", chatControl.chatControlType);
          for (const [jobId, job] of candidateJobs) {
          if (job?.chatFlowOrder) {
            chatFlowConfigObj = this.chatFlowConfigBuilder.buildChatFlowConfig(
              job.chatFlowOrder,
            );
          }
          console.log("Number of candidates fetched::", candidates?.length);
          const candidatesForJob = candidates.filter((candidate) => {
            return candidate?.jobs?.id === jobId;
          });

          console.log("Number of candidates for job::", candidatesForJob?.length)
          if (candidatesForJob.length > 0) {
            await this.startChatControlEngagement(
              candidatesForJob as CandidateNode[],
              job,
              chatControl,
              chatFlowConfigObj as Record<chatControlType, ChatFlowConfig>,
              apiToken,
            );
            await this.engageCandidates(
              candidatesForJob as CandidateNode[],
              job,
              chatControl,
              chatFlowConfigObj,
              apiToken,
            );
          }
        }
        console.log(
          `Completed ${chatControl.chatControlType} execution at ${new Date().toISOString()}`,
        );
      }
    } catch (error) {
      console.log('Error in check Candidate Engagement', error);
    }
  }

  async fetchLinkedinSockMessages(token: string) {
    console.log("These are the fetch linkedin sock messages")
    let data = JSON.stringify({});
    const arxenaSiteBaseUrl =
    process.env.ARXENA_SITE_BASE_URL || 'http://localhost:5050';


    console.log("arxenaSiteBaseUrl::", arxenaSiteBaseUrl)
    
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: arxenaSiteBaseUrl+'/get_linkedin_unread_messages',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: data
    };

    try {
      const response = await axios.request(config);
      return response.data;
    } catch (error) {
      console.error('Error fetching LinkedIn messages:', error);
      throw error;
    }
  }
}
