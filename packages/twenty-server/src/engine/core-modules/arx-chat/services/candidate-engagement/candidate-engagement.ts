import {
  CandidateEdge,
  CandidateNode,
  ChatControlsObjType,
  chatControlType,
  ChatHistoryItem,
  graphqlToFetchAllCandidateData,
  graphQlToFetchWhatsappMessages,
  graphQltoUpdateOneCandidate,
  Job,
  MessageNode,
  PageInfo,
  PersonNode,
  RecruiterProfileType,
  whatappUpdateMessageObjType
} from 'twenty-shared';

import { ChatFlowConfigBuilder } from 'src/engine/core-modules/arx-chat/services/chat-flow-config';
import { OpenAIArxMultiStepClient } from 'src/engine/core-modules/arx-chat/services/llm-agents/arx-multi-step-client';
import { PromptingAgents } from 'src/engine/core-modules/arx-chat/services/llm-agents/prompting-agents';
import { TimeManagement } from 'src/engine/core-modules/arx-chat/services/time-management';
import {
  sortWhatsAppMessages
} from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { v4 as uuidv4 } from 'uuid';
import { RecruiterProfileService } from '../recruiter-profile';
import { FilterCandidates } from './filter-candidates';
import { UpdateChat } from './update-chat';

export interface ChatFlowConfig {
  order: number;
  type: chatControlType;
  filterLogic: (candidate: CandidateNode) => boolean;
  preProcessing?: (
    candidates: PersonNode[],
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
  ) {
    this.chatFlowConfigBuilder = new ChatFlowConfigBuilder(
      workspaceQueryService,
      staticGraphQLService,
    );
  }

  async getSystemPrompt(
    personNode: PersonNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log('This is the chatControl:', chatControl);
    if (chatControl.chatControlType == 'startVideoInterviewChat') {
      return new PromptingAgents(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getVideoInterviewPrompt(personNode, candidateJob, apiToken);
    } else if (chatControl.chatControlType === 'startChat') {
      return new PromptingAgents(this.workspaceQueryService, this.staticGraphQLService).getStartChatPrompt(
        personNode,
        candidateJob,
        apiToken,
      );
    } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return new PromptingAgents(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getStartMeetingSchedulingPrompt(personNode, candidateJob, apiToken);
    } else {
      return new PromptingAgents(this.workspaceQueryService, this.staticGraphQLService).getStartChatPrompt(
        personNode,
        candidateJob,
        apiToken,
      );
    }
  }

  async getChatTemplateFromChatControls(
    chatControl: ChatControlsObjType,
    sortedMessagesList: MessageNode[],
    candidateJob: Job,
    candidatePersonNodeObj: PersonNode,
    apiToken: string,
    chatReply: chatControlType,
    recruiterProfile: RecruiterProfileType,
    chatFlowConfigObj: Record<string, ChatFlowConfig>,
  ) {
    const config = chatFlowConfigObj[chatReply].templateConfig;
    const isFirstMessage =
      candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappMessages
        ?.edges.length === 0;
    const messageSetup = config.messageSetup(isFirstMessage);
    const chatHistory = sortedMessagesList[0]?.messageObj || [];
    if (messageSetup.requiresSystemPrompt) {
      const SYSTEM_PROMPT = await this.getSystemPrompt(
        candidatePersonNodeObj,
        candidateJob,
        chatControl,
        apiToken,
      );
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    }
    chatHistory.push({ role: 'user', content: messageSetup.userContent });

    const whatsappTemplate =
      candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappProvider ||
      config.defaultTemplate;

    let phoneNumberFrom:string = candidatePersonNodeObj.phones.primaryPhoneNumber.length == 10
    ? '91' + candidatePersonNodeObj.phones.primaryPhoneNumber
    : candidatePersonNodeObj.phones.primaryPhoneNumber;
    if (candidatePersonNodeObj?.candidates?.edges[0]?.node?.messagingChannel == 'linkedin') {
      phoneNumberFrom = candidatePersonNodeObj?.linkedinLink?.primaryLinkUrl || '';
    }
    else{
      phoneNumberFrom = candidatePersonNodeObj.phones.primaryPhoneNumber.length == 10
          ? '91' + candidatePersonNodeObj.phones.primaryPhoneNumber
          : candidatePersonNodeObj.phones.primaryPhoneNumber
    }

    let phoneNumberTo:string = recruiterProfile.phoneNumber;
    console.log("This is recruiter profile:", recruiterProfile)

    if (candidatePersonNodeObj?.candidates?.edges[0]?.node?.messagingChannel == 'linkedin') {
      phoneNumberTo = recruiterProfile.linkedinUrl || '';
    }
    else{
      phoneNumberTo = recruiterProfile.phoneNumber
    }


    console.log("This is the messaging channel ::", candidatePersonNodeObj?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob.id,
    )[0]?.node.messagingChannel)
    console.log("This is the whatsapp provider ::", candidatePersonNodeObj?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob.id,
    )[0]?.node.whatsappProvider)

    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: candidatePersonNodeObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node,
      candidateFirstName: candidatePersonNodeObj?.name?.firstName,
      phoneNumberFrom: phoneNumberFrom,
      whatsappMessageType: whatsappTemplate,
      phoneNumberTo: phoneNumberTo,
      messages: [{ content: chatReply }],
      lastEngagementChatControl: chatControl.chatControlType,
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
      typeOfMessage: candidatePersonNodeObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };

    return whatappUpdateMessageObj;
  }

  async createAndUpdateCandidateStartChatChatMessage(
    chatReply: chatControlType,
    candidatePersonNodeObj: PersonNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
    chatFlowConfigObj,
  ) {
    console.log('Createing and updating candidate start chat messages');
    const personNode = candidatePersonNodeObj;

    if (personNode.phones.primaryPhoneNumber === '') {
      console.log('Phone number from is empty, returning empty candidate profile object');
      return;
    }

    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob as Job,
      apiToken,
    );

    // const recruiterProfile = recruiterProfile;
    const candidate = candidatePersonNodeObj?.candidates?.edges?.find(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )?.node;
    const candidateId = candidate?.id || '';

    console.log('Candidate ID to start chat::', candidateId);
    const messagesList: MessageNode[] = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllWhatsappMessages(candidateId, apiToken);
    const sortedMessagesList: MessageNode[] = messagesList.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const whatappUpdateMessageObj = await this.getChatTemplateFromChatControls(
      chatControl,
      sortedMessagesList,
      candidateJob,
      candidatePersonNodeObj,
      apiToken,
      chatReply,
      recruiterProfile,
      chatFlowConfigObj,
    );

    await new UpdateChat(
      this.workspaceQueryService,
      this.staticGraphQLService, 
    ).updateCandidateEngagementDataInTable(whatappUpdateMessageObj,  apiToken);
    // console.log('Sending a messages::', chatReply, 'to the candidate::', personNode.name.firstName + ' ' + personNode.name.lastName, 'with candidate id::', candidateId);
  }

  async processCandidate(
    personNode: PersonNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log(
      'Engagement Type for the candidate ::',
      personNode.name.firstName + ' ' + personNode.name.lastName,
      'for chat control::',
      chatControl.chatControlType,
    );
    try {
      const candidate = personNode?.candidates?.edges?.find(
        (edge) => edge.node.jobs.id === candidateJob.id,
      )?.node;
      const candidateId = candidate?.id || '';
      const messagesList: MessageNode[] = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllWhatsappMessages(candidateId, apiToken);

      console.log(
        'the number of messages in the message list is::',
        messagesList.length,
      );
      const mostRecentMessageArr: ChatHistoryItem[] = new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getMostRecentMessageFromMessagesList(messagesList);

      if (mostRecentMessageArr?.length > 0) {
        console.log(
          'Taking MULTI Step Client for - Prompt Engineering type:',
          process.env.PROMPT_ENGINEERING_TYPE,
          'for candidate::',
          personNode.name.firstName + ' ' + personNode.name.lastName,
        );
        await new OpenAIArxMultiStepClient(
          personNode,
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).createCompletion(
          mostRecentMessageArr,
          candidateJob as Job,
          chatControl,
          apiToken,
        );
      } else {
        console.log(
          'mostRecentMessageArr?.length is not greater than 0, hence no engagement:: (length)::',
          mostRecentMessageArr?.length,
        );
      }
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
        await new UpdateChat(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).updateCandidatesWithChatCount(candidateIds, apiToken);

        // Process chat statuses
        const results = await new UpdateChat(
          this.workspaceQueryService,
            this.staticGraphQLService,
        ).processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds, "makeUpdatesonChats");

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
      input: { [chatControl.chatControlType]: true },
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
    peopleCandidateResponseEngagementArr: PersonNode[],
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    chatFlowConfigObj,
    apiToken: string,
  ) {
    console.log(
      'These are the candidates who we want to engage ::',
      peopleCandidateResponseEngagementArr.length,
      'for chat Control:',
      chatControl.chatControlType,
    );

    const sortedPeopleData: PersonNode[] = sortWhatsAppMessages(
      peopleCandidateResponseEngagementArr,
    );
    const config = chatFlowConfigObj[chatControl.chatControlType];

    if (!config) {
      console.log(
        `No configuration found for chat control type: ${chatControl.chatControlType}`,
      );

      return;
    }

    const filteredCandidatesToEngage = sortedPeopleData.filter((person) => {
      const candidate = person?.candidates?.edges?.find(
        (edge) => edge.node.jobs.id === candidateJob.id,
      )?.node;
      const isEligible = candidate
        ? config.isEligibleForEngagement(candidate)
        : false;
      return isEligible;
    });

    console.log(
      'Number of filtered candidates to engage after time scheduling: ',
      filteredCandidatesToEngage?.length,
      'for chatcontrol',
      chatControl.chatControlType,
    );
    console.log(
      'Names of filtered candidates to engage after filtering ',
      filteredCandidatesToEngage?.map(
        (person) => person.name.firstName + ' ' + person.name.lastName,
      ),
      'for chatcontrol',
      chatControl.chatControlType,
    );

    for (const personNode of filteredCandidatesToEngage) {
      await new UpdateChat(
        this.workspaceQueryService,
          this.staticGraphQLService,
      ).setCandidateEngagementStatusToFalse(
        personNode?.candidates?.edges
          .filter((edge) => edge.node.jobs.id === candidateJob.id)
          .map((edge) => edge.node)[0]?.id,
        apiToken,
      );
      await this.processCandidate(
        personNode,
        candidateJob,
        chatControl,
        apiToken,
      );
    }
  }

  async startChatControlEngagement(
    peopleCandidateResponseEngagementArr: PersonNode[],
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    chatFlowConfigObj: Record<chatControlType, ChatFlowConfig>,
    apiToken: string,
  ) {
    const config = chatFlowConfigObj[chatControl.chatControlType];

    if (!config) {
      console.log(
        `No configuration found for chat control type: ${chatControl.chatControlType}`,
      );

      return;
    }
    await config.preProcessing?.(
      peopleCandidateResponseEngagementArr,
      candidateJob,
      chatControl,
      apiToken,
      this.workspaceQueryService,
    );
    const filterCandidates = (personNode: PersonNode) => {
      const candidate = personNode?.candidates?.edges
        .filter((edge) => edge.node.jobs.id === candidateJob.id)
        .map((edge) => edge.node)[0];

      if (!candidate) return false;
      const chatFlowOrder =
        candidateJob?.chatFlowOrder ||
        this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
      const currentIndex = chatFlowOrder.indexOf(chatControl.chatControlType);

      if (currentIndex != 0) {
        if ( candidate.lastEngagementChatControl !== chatControl.chatControlType ) {
          const waitTime = TimeManagement.timeDifferentials .timeDifferentialInMinutesBeforeStartingNextStageMessaging * 60 * 1000;
          const cutoffTime = new Date(Date.now() - waitTime).toISOString();
          if (new Date(candidate.updatedAt).toISOString() > cutoffTime) {
            console.log(
              `Stage transition waiting period not elapsed for candidate ${candidate.name}, last engagement was ${candidate.lastEngagementChatControl}, last udpated was ${candidate.updatedAt} and cutoff time is ${cutoffTime}`,
            );
            return false;
          }
        } else {
          console.log(
            `Candidate ${candidate.name} is eligible for stage transition from startChat because its the first one`,
          );
        }
      }
      return config.filterLogic(candidate);
    };

    // console.log( 'peopleCandidateResponse EngagementArr length::', peopleCandidateResponseEngagementArr.length, 'for chatControl::', chatControl.chatControlType, );
    const filteredCandidatesToStartEngagement =
      peopleCandidateResponseEngagementArr?.filter(filterCandidates);

    console.log( 'Number of candidates to start chat engagement::', filteredCandidatesToStartEngagement.length, 'for chatControl::', chatControl.chatControlType );
    // Process filtered candidates
    for (const candidatePersonNodeObj of filteredCandidatesToStartEngagement) {
      // console.log( 'Starting chat engagement for the candidate::', candidatePersonNodeObj.name.firstName + ' ' + candidatePersonNodeObj.name.lastName );
      const chatReply: chatControlType = chatControl.chatControlType;
      await this.createAndUpdateCandidateStartChatChatMessage(
        chatReply,
        candidatePersonNodeObj,
        candidateJob,
        chatControl,
        apiToken,
        chatFlowConfigObj,
      );
    }
  }

  async fetchSpecificPeopleToEngageAcrossAllChatControls(
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<{ people: PersonNode[]; candidateJob: Job }> {
    try {
      console.log('Fetching candidates to engage');
      const candidates = await this.fetchAllCandidatesWithAllChatControls(
        chatControl.chatControlType,
        apiToken,
      );

      console.log( 'Fetched', candidates?.length, '  fetchSpecificPeopleTo EngageAcrossAllChatControls candidates with chatControl', chatControl );
      const peopleIds = candidates
        ?.filter((c) => c?.people?.id)
        .map((c) => c?.people?.id);
      const candidateJob = candidates
        ?.filter((c) => c?.jobs?.id)
        .map((c) => c?.jobs)[0];

      console.log(
        'Got a total of ',
        peopleIds?.length,
        'candidate ids for chatControl',
        chatControl,
      );
      const people = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllPeopleByPeopleIds(peopleIds, apiToken);

      console.log(
        'Fetched',
        people?.length,
        'people in fetch all People  with chatControl',
        chatControl,
      );

      return { people, candidateJob };
    } catch (error) {
      console.log(
        'This is the error in fetchPeopleToEngageByCheckingOnlyStartChat',
        error,
      );
      console.log('An error occurred:', error);
      throw error; // Re-throw the error to be handled by the caller
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
          graphqlToFetchAllCandidateData,
          {
            lastCursor,
            limit: 400,
            filter: timestampedFilter,
            orderBy: [{ createdAt: 'DESC' }],
          },
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
    chatFlowConfigObj: Record<string, ChatFlowConfig>,
    apiToken: string,
  ): Promise<CandidateNode[]> {
    const config = chatFlowConfigObj[chatControlType];
    if (!config || !config.chatFilters) {
      console.log( `No configuration or filters found for chat control type: ${chatControlType}` );
      return [];
    }
    const filters = config.chatFilters();
    const allCandidates: CandidateNode[] = [];
    let graphqlQueryObjToFetchAllCandidatesForChats = '';
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      graphqlQueryObjToFetchAllCandidatesForChats = graphqlToFetchAllCandidateData;
      const timestamp = new Date().toISOString();
      for (const filter of filters) {
        let lastCursor: string | null = null;
        const timestampedFilter = {
          filter,
          updatedAt: { lte: timestamp },
          orderBy: [{ updatedAt: 'DESC' }],
          limit: 400,
          lastCursor,
        };

        let hasNextPage = true;
        while (hasNextPage) {
          const variables ={
            ...timestampedFilter,
          }
          const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryObjToFetchAllCandidatesForChats, variables, apiToken);
          const candidates = response?.data?.data?.candidates as { 
            edges: CandidateEdge[];
            pageInfo: PageInfo;
          } | undefined;

          if (response.data.errors) {
            console.log( 'Errors in executeGraphQL:', response.data.errors, 'with workspace Id:', workspaceId );
            break;
          }
          const edges = candidates?.edges || [];
          hasNextPage = candidates?.pageInfo?.hasNextPage || false;

          if (!edges.length) {
            break;
          }

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
          if (!hasNextPage) {
            break;
          };

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
  ): Promise<{ people: PersonNode[]; candidateJobs: Map<string, Job> }> {
    try {
      const candidates = await this.fetchAllCandidatesWithSpecificChatControl(
        chatControl.chatControlType,
        chatFlowConfigObj,
        apiToken,
      );

      const candidateJobs = new Map<string, Job>();
      candidates.forEach((candidate) => {
        if (candidate?.jobs?.id) {
          candidateJobs.set(candidate.jobs.id, candidate.jobs);
        }
      });

      const candidatePeopleIds = candidates
        ?.filter((c) => c?.people?.id)
        .map((c) => c?.people?.id);
      const people = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllPeopleByPeopleIds(candidatePeopleIds, apiToken);
      // console.log("Number of all people fetched ::", people.length);
      return { people, candidateJobs };
    } catch (error) {
      console.log(
        'Error in fetchSpecificPeopleToEngageBasedOnChatControl:',
        error,
      );
      throw error;
    }
  }

  async executeCandidateEngagement(apiToken: string) {
    try {
      console.log(
        'Cron running and cycle started to check candidate engagement',
      );
      console.log(`Execution started at: ${new Date().toISOString()}`);

      const defaultChatFlowOrder =
        this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
      let chatFlowConfigObj =
        this.chatFlowConfigBuilder.buildChatFlowConfig(defaultChatFlowOrder);

      const chatFlow = Object.entries(chatFlowConfigObj)
        .filter(([, config]) => config.order > 0)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([, config]) => ({ chatControlType: config.type }));

      for (const chatControl of chatFlow) {
        const executionTime = new Date().toISOString();

        console.log(
          `Starting ${chatControl.chatControlType} execution at ${executionTime}`,
        );

        const { people, candidateJobs } =
          await this.fetchSpecificPeopleToEngageBasedOnChatControl(
            chatControl,
            chatFlowConfigObj as Record<chatControlType, ChatFlowConfig>,
            apiToken,
          );

        // Process each job separately
        for (const [jobId, job] of candidateJobs) {
          if (job?.chatFlowOrder) {
            chatFlowConfigObj = this.chatFlowConfigBuilder.buildChatFlowConfig(
              job.chatFlowOrder,
            );
          }
          // Filter people for this specific job
          const peopleForJob = people.filter((person) => {
            return person?.candidates?.edges?.some(
              (edge) => edge.node.jobs.id === jobId,
            );
          });

          if (peopleForJob.length > 0) {
            await this.startChatControlEngagement(
              peopleForJob,
              job,
              chatControl,
              chatFlowConfigObj as Record<chatControlType, ChatFlowConfig>,
              apiToken,
            );
            await this.engageCandidates(
              peopleForJob,
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
      console.log('Error in checkCandidateEngagement', error);
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
