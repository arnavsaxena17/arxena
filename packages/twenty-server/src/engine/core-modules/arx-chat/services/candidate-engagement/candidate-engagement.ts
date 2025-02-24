import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { graphqlToFetchAllCandidateData, graphqlToFetchManyCandidatesOlderSchema, graphQlToFetchWhatsappMessages, graphQltoUpdateOneCandidate } from 'twenty-shared';
import { axiosRequest, sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';
import { ChatFlowConfigBuilder } from '../chat-flow-config';
import * as allDataObjects from '../data-model-objects';
import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { PromptingAgents } from '../llm-agents/prompting-agents';
import { getRecruiterProfileByJob } from '../recruiter-profile';
import { TimeManagement } from '../time-management';
import { FilterCandidates } from './filter-candidates';
import { UpdateChat } from './update-chat';

export const workspacesWithOlderSchema = ["20202020-1c25-4d02-bf25-6aeccf7ea419","3b8e6458-5fc1-4e63-8563-008ccddaa6db"];


const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default class CandidateEngagementArx {
  private chatFlowConfigBuilder: ChatFlowConfigBuilder;

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {
    this.chatFlowConfigBuilder = new ChatFlowConfigBuilder(workspaceQueryService);
  }

  async getSystemPrompt(personNode: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('This is the chatControl:', chatControl);
    if (chatControl.chatControlType == 'startVideoInterviewChat') {
      return new PromptingAgents(this.workspaceQueryService).getVideoInterviewPrompt(personNode, apiToken);
    } else if (chatControl.chatControlType === 'startChat') {
      return new PromptingAgents(this.workspaceQueryService).getStartChatPrompt(personNode, candidateJob, apiToken);
    } else if (chatControl.chatControlType === 'startMeetingSchedulingChat') {
      return new PromptingAgents(this.workspaceQueryService).getStartMeetingSchedulingPrompt(personNode, candidateJob, apiToken);
    } else {
      return new PromptingAgents(this.workspaceQueryService).getStartChatPrompt(personNode, candidateJob, apiToken);
    }
  }

  async getChatTemplateFromChatControls(
    chatControl: allDataObjects.chatControls,
    sortedMessagesList: allDataObjects.MessageNode[],
    candidateJob: allDataObjects.Jobs,
    candidatePersonNodeObj: allDataObjects.PersonNode,
    apiToken: string,
    chatReply: allDataObjects.chatControlType,
    recruiterProfile: allDataObjects.recruiterProfileType,
    chatFlowConfigObj: Record<string, allDataObjects.ChatFlowConfig>,
  ) {
    const config = chatFlowConfigObj[chatReply].templateConfig;
    const isFirstMessage = candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges.length === 0;
    const messageSetup = config.messageSetup(isFirstMessage);
    let chatHistory = sortedMessagesList[0]?.messageObj || [];
    if (messageSetup.requiresSystemPrompt) {
      const SYSTEM_PROMPT = await this.getSystemPrompt(candidatePersonNodeObj, candidateJob, chatControl, apiToken);
      chatHistory.push({ role: 'system', content: SYSTEM_PROMPT });
    }
    chatHistory.push({ role: 'user', content: messageSetup.userContent });
    const whatsappTemplate = candidatePersonNodeObj?.candidates?.edges[0]?.node?.whatsappProvider || config.defaultTemplate;
    let whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType = {
      candidateProfile: candidatePersonNodeObj?.candidates?.edges[0]?.node,
      candidateFirstName: candidatePersonNodeObj?.name?.firstName,
      phoneNumberFrom: candidatePersonNodeObj?.phone,
      whatsappMessageType: whatsappTemplate,
      phoneNumberTo: recruiterProfile.phoneNumber,
      messages: [{ content: chatReply }],
      lastEngagementChatControl: chatControl.chatControlType,
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
    };

    return whatappUpdateMessageObj;
  }

  async createAndUpdateCandidateStartChatChatMessage(
    chatReply: allDataObjects.chatControlType,
    candidatePersonNodeObj: allDataObjects.PersonNode,
    candidateJob: allDataObjects.Jobs,
    chatControl: allDataObjects.chatControls,
    apiToken: string,
    chatFlowConfigObj,
  ) {
    const personNode = candidatePersonNodeObj;

    const recruiterProfile = await getRecruiterProfileByJob(candidateJob, apiToken) 

    // const recruiterProfile = allDataObjects.recruiterProfile;
    const candidate = candidatePersonNodeObj?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
    const candidateId = candidate?.id || '';
    console.log('Candidate ID to start chat::', candidateId);
    const messagesList: allDataObjects.MessageNode[] = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
    const sortedMessagesList: allDataObjects.MessageNode[] = messagesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const whatappUpdateMessageObj = await this.getChatTemplateFromChatControls(chatControl, sortedMessagesList, candidateJob, candidatePersonNodeObj, apiToken, chatReply, recruiterProfile, chatFlowConfigObj);
    await new UpdateChat(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObj, apiToken);
    // console.log('Sending a messages::', chatReply, 'to the candidate::', personNode.name.firstName + ' ' + personNode.name.lastName, 'with candidate id::', candidateId);
  }
  async processCandidate(personNode: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('Engagement Type for the candidate ::', personNode.name.firstName + ' ' + personNode.name.lastName, 'for chat control::', chatControl.chatControlType);
    try {
      const candidate = personNode?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
      const candidateId = candidate?.id || '';
      const messagesList: allDataObjects.MessageNode[] = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
      console.log('the number of messages in the message list is::', messagesList.length);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new FilterCandidates(this.workspaceQueryService).getMostRecentMessageFromMessagesList(messagesList);
      if (mostRecentMessageArr?.length > 0) {
        console.log('Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE, 'for candidate::', personNode.name.firstName + ' ' + personNode.name.lastName);
        await new OpenAIArxMultiStepClient(personNode, this.workspaceQueryService).createCompletion(mostRecentMessageArr, candidateJob, chatControl, apiToken);
      } else {
        console.log('mostRecentMessageArr?.length is not greater than 0, hence no engagement:: (length)::', mostRecentMessageArr?.length);
      }
    } catch (error) {
      console.log('This is the error in processCandidate', error);
    }
  }
  private async checkForStageTransitions(candidate: any, chatFlowOrder: string[], apiToken: string): Promise<boolean> {
    for (let i = 0; i < chatFlowOrder.length - 1; i++) {
      const currentStage = chatFlowOrder[i];
      const nextStage = chatFlowOrder[i + 1];

      // Check if current stage is completed but next stage hasn't started
      const isCurrentStageCompleted = candidate[`${currentStage}Completed`] === true;
      const hasNextStageStarted = candidate[nextStage] === true;

      if (isCurrentStageCompleted && !hasNextStageStarted) {
        // Create the next stage's chat control
        await this.createChatControl(candidate.id, { chatControlType: nextStage as allDataObjects.chatControlType }, apiToken);
        return true;
      }
    }
    return false;
  }
  private async fetchCandidateById(candidateId: string, apiToken: string): Promise<any> {
    const graphqlQueryObj = JSON.stringify({
      query: graphqlToFetchAllCandidateData,
      variables: { filter: { id: { eq: candidateId } } },
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    return response?.data?.data?.candidates?.edges[0]?.node;
  }

  private async fetchRecentMessages(startTime: Date, endTime: Date, apiToken: string) {
    console.log("Fetching recent messages from startTime to endTime");
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
    console.log("The value of startTime.toISOString():",  startTime.toISOString())
    console.log("The value of endTime.toISOString()():",  endTime.toISOString())

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log("Number of messages in fetchRe centMessages::", response?.data?.data?.whatsappMessages?.edges.length);
    // console.log("This is the response from cre atedAt::", response?.data?.data?.whatsappMessages?.edges.map((message) => message.node.createdAt));
    return response?.data?.data?.whatsappMessages?.edges || [];


    // The value of startTime.toISOString(): 2025-02-12T10:38:00.018Z
    // The value of endTime.toISOString()(): 2025-02-12T11:38:00.018Z
    // This is the response from createdAt:: [ '2025-02-12T11:37:28.989Z', '2025-02-12T11:37:53.282Z' ]
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
  

  async makeUpdatesonChats(apiToken: string): Promise<{ candidateIds: string[]; jobIds: string[] }> {
    console.log('Going to make updates on chats');
    try {
      const timeWindow = TimeManagement.timeDifferentials.timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls;
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeWindow * 60 * 1000);
      // Get recent messages

      // const allWhatsappMessages = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken)
      const messages = await this.fetchRecentMessages(startTime, endTime, apiToken);
      console.log('Number of messages::', messages.length);
      // Group by job for different chat flows
      const messagesByJob = this.groupMessagesByJob(messages);
      console.log('Number of Jobs::', messagesByJob.size);
      const eligibleCandidates = new Set<string>();
      const eligibleJobs = new Set<string>();
      for (const [jobId, jobMessages] of messagesByJob.entries()) {
        console.log('this is hte ojb id:', jobId);
        const job = await new FilterCandidates(this.workspaceQueryService).fetchJobById(jobId, apiToken);
        console.log('Got this joib ::', job);
        console.log('This is the job chatfloworder::', job?.chatFlowOrder);
        console.log('This is the default job chatfloworder::', this.chatFlowConfigBuilder.getDefaultChatFlowOrder());
        const chatFlowOrder = job?.chatFlowOrder || this.chatFlowConfigBuilder.getDefaultChatFlowOrder();

        // First update chat counts and statuses for all candidates in this job
        const candidateIds = [...new Set(jobMessages.map(message => message.node.candidate.id))];
        const jobIds = await new FilterCandidates(this.workspaceQueryService).getJobIdsFromCandidateIds(candidateIds, apiToken);
        console.log('Number of Candidate IDs for which we are going to do updates::', candidateIds.length);
        // console.log(" Candidate IDs here::", candidateIds);
        // console.log(" Candidate IDs here::", jobMessages);

        // Update chat counts first
        await new UpdateChat(this.workspaceQueryService).updateCandidatesWithChatCount(candidateIds, apiToken);

        // Then process chat statuses
        const results = await new UpdateChat(this.workspaceQueryService).processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds);
        console.log("Results from processCandidatesChatsGetStatuses::", results);
        await new GoogleSheetsService().updateGoogleSheetsWithChatData(results, apiToken);

        // After updates are complete, check which candidates are eligible for stage transitions
        for (const message of jobMessages) {
          const candidate = await this.fetchCandidateById(message.node.candidate.id, apiToken);

          // Now check for stage transitions with updated status
          if (await this.checkForStageTransitions(candidate, chatFlowOrder, apiToken)) {
            eligibleCandidates.add(candidate.id);
            eligibleJobs.add(jobId);
          } else {
            // Log ineligible candidates and reasons
            console.log(`Candidate ${candidate.name} ineligible for transition: Current stage incomplete or next stage already started`);
          }
        }
      }

      console.log('Number of eligibleCandidates::', eligibleCandidates.size, 'Number of eligibleJobs::', eligibleJobs.size);
      return {
        candidateIds: Array.from(eligibleCandidates),
        jobIds: Array.from(eligibleJobs),
      };
    } catch (error) {
      console.error('Error in getRecentCandidateIds ToMakeUpdatesonChats:', error);
      return { candidateIds: [], jobIds: [] };
    }
  }

  // Helper methods for grouping candidates by job
  private async groupCandidatesByJob(candidateIds: string[], apiToken: string): Promise<Record<string, string[]>> {
    const graphqlQueryObj = JSON.stringify({
      query: graphqlToFetchAllCandidateData,
      variables: { filter: { id: { in: candidateIds } } },
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);

    const candidates = response?.data?.data?.candidates?.edges || [];
    console.log('Candidates array:', candidates);

    const groupedCandidates = candidates.reduce((acc: Record<string, string[]>, edge: any) => {
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
        console.log('Missing jobId or candidateId:', { jobId, candidateId, edge });
      }

      return acc;
    }, {});

    console.log('Final grouped candidates:', groupedCandidates);
    return groupedCandidates;
  }

  async createChatControl(candidateId: string, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('Dynamically changing the chat controls to true if conditions are being met.');
    console.log('Setting the:::chatControl.chatControlType:::', chatControl.chatControlType, 'to true for candidate::', candidateId);
    const graphqlVariables = { idToUpdate: candidateId, input: { [chatControl.chatControlType]: true } };
    const graphqlQueryObj = JSON.stringify({ query: graphQltoUpdateOneCandidate, variables: graphqlVariables });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    if (response.data.errors) {
      console.log('Error in startChat:', response.data.errors);
    }
    console.log('Response from create ChatControl', response.data.data.updateCandidate, 'for chat control', chatControl.chatControlType, 'for candidate ID:', candidateId);
    return response.data;
  }

  async engageCandidates(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, chatFlowConfigObj, apiToken: string) {
    console.log('These are the candidates who we want to engage ::', peopleCandidateResponseEngagementArr.length, 'for chat Control:', chatControl.chatControlType);

    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(peopleCandidateResponseEngagementArr);
    const config = chatFlowConfigObj[chatControl.chatControlType];

    if (!config) {
      console.log(`No configuration found for chat control type: ${chatControl.chatControlType}`);
      return;
    }

    const filteredCandidatesToEngage = sortedPeopleData.filter(person => {
      const candidate = person?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
      const isEligible = candidate ? config.isEligibleForEngagement(candidate) : false;
      console.log(`Candidate eligibility for engagement: ${isEligible} for candidate ID: ${candidate?.name}, will be updating the engagement status to false soon `);
      return isEligible;
    });

    console.log('Number of filtered candidates to engage after time scheduling: ', filteredCandidatesToEngage?.length, 'for chatcontrol', chatControl.chatControlType);
    console.log('Names of filtered candidates to engage after filtering ', filteredCandidatesToEngage?.map(person => person.name.firstName+ " " + person.name.lastName), 'for chatcontrol', chatControl.chatControlType);

    for (const personNode of filteredCandidatesToEngage) {
      await new UpdateChat(this.workspaceQueryService).setCandidateEngagementStatusToFalse(personNode?.candidates?.edges[0]?.node?.id, apiToken);
      await this.processCandidate(personNode, candidateJob, chatControl, apiToken);
    }
  }
  async startChatControlEngagement(
    peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[],
    candidateJob: allDataObjects.Jobs,
    chatControl: allDataObjects.chatControls,
    chatFlowConfigObj: Record<string, allDataObjects.ChatFlowConfig>,
    apiToken: string,
  ) {
    const config = chatFlowConfigObj[chatControl.chatControlType];
    if (!config) {
      console.log(`No configuration found for chat control type: ${chatControl.chatControlType}`);
      return;
    }
    await config.preProcessing?.(peopleCandidateResponseEngagementArr, candidateJob, chatControl, apiToken, this.workspaceQueryService);
    const filterCandidates = (personNode: allDataObjects.PersonNode) => {
      const candidate = personNode?.candidates?.edges[0]?.node;
      if (!candidate) return false;
      const chatFlowOrder = candidateJob?.chatFlowOrder || this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
      const currentIndex = chatFlowOrder.indexOf(chatControl.chatControlType);
      if (currentIndex != 0) {
        if (candidate.lastEngagementChatControl !== chatControl.chatControlType) {
          const waitTime = TimeManagement.timeDifferentials.timeDifferentialInMinutesBeforeStartingNextStageMessaging * 60 * 1000;
          const cutoffTime = new Date(Date.now() - waitTime).toISOString();
          if (new Date(candidate.updatedAt).toISOString() > cutoffTime) {
            console.log(`Stage transition waiting period not elapsed for candidate ${candidate.name}, last engagement was ${candidate.lastEngagementChatControl}, last udpated was ${candidate.updatedAt} and cutoff time is ${cutoffTime}`);
            return false;
          }
        } else {
          console.log(`Candidate ${candidate.name} is eligible for stage transition from startChat because its the first one`);
        }
      }

      return config.filterLogic(candidate);
    };
    console.log('peopleCandidateResponse EngagementArr length::', peopleCandidateResponseEngagementArr.length, 'for chatControl::', chatControl.chatControlType);
    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(filterCandidates);
    console.log('Number of candidates to start chat engagement::', filteredCandidatesToStartEngagement.length, 'for chatControl::', chatControl.chatControlType);
    // Process filtered candidates
    for (const candidatePersonNodeObj of filteredCandidatesToStartEngagement) {
      console.log('Starting chat engagement for the candidate::', candidatePersonNodeObj.name.firstName + ' ' + candidatePersonNodeObj.name.lastName);
      const chatReply: allDataObjects.chatControlType = chatControl.chatControlType;
      await this.createAndUpdateCandidateStartChatChatMessage(chatReply, candidatePersonNodeObj, candidateJob, chatControl, apiToken, chatFlowConfigObj);
    }
  }

  async fetchSpecificPeopleToEngageAcrossAllChatControls(chatControl: allDataObjects.chatControls, apiToken: string): Promise<{ people: allDataObjects.PersonNode[]; candidateJob: allDataObjects.Jobs }> {
    try {
      console.log('Fetching candidates to engage');

      const candidates = await this.fetchAllCandidatesWithAllChatControls(chatControl.chatControlType, apiToken);
      console.log('Fetched', candidates?.length, '  fetchSpecificPeopleTo EngageAcrossAllChatControls candidates with chatControl', chatControl);
      const candidatePeopleIds = candidates?.filter(c => c?.people?.id).map(c => c?.people?.id);
      const candidateJob = candidates?.filter(c => c?.jobs?.id).map(c => c?.jobs)[0];
      console.log('Got a total of ', candidatePeopleIds?.length, 'candidate ids for chatControl', chatControl);
      const people = await new FilterCandidates(this.workspaceQueryService).fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds, apiToken);
      console.log('Fetched', people?.length, 'people in fetch all People  with chatControl', chatControl);
      return { people, candidateJob };
    } catch (error) {
      console.log('This is the error in fetchPeopleToEngageByCheckingOnlyStartChat', error);
      console.log('An error occurred:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }



  async fetchAllCandidatesWithAllChatControls(chatControlType: allDataObjects.chatControlType, apiToken: string): Promise<allDataObjects.Candidate[]> {
    console.log('Fetching all candidates with chatControlType', chatControlType);

    let filters;
    if (chatControlType === 'allStartedAndStoppedChats') {
      filters = [
        { stopChat: { eq: false }, startChat: { eq: true } },
        { stopChat: { eq: true }, startChat: { eq: true } },
      ];
    }

    let allCandidates: allDataObjects.Candidate[] = [];
    let graphqlQueryObjToFetchAllCandidatesForChats = '';

    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      graphqlQueryObjToFetchAllCandidatesForChats = workspacesWithOlderSchema.includes(workspaceId) ? graphqlToFetchManyCandidatesOlderSchema : graphqlToFetchAllCandidateData;

      // Add timestamp to ensure fresh data
      const timestamp = new Date().toISOString();

      for (const filter of filters) {
        let lastCursor: string | null = null;
        // Add updatedAt filter to ensure fresh data
        const timestampedFilter = {
          ...filter,
          updatedAt: { lte: timestamp }, // Only get candidates updated up to now
        };

        while (true) {
          const graphqlQueryObj = JSON.stringify({
            query: graphqlQueryObjToFetchAllCandidatesForChats,
            variables: {
              lastCursor,
              limit: 30,
              filter: timestampedFilter,
              orderBy: [{ updatedAt: 'DESC' }],
            },
          });

          const response = await axiosRequest(graphqlQueryObj, apiToken);
          if (response.data.errors) {
            console.log('Errors in axiosRequest:', response.data.errors, 'with workspace Id:', workspaceId);
            break;
          }

          const edges = response?.data?.data?.candidates?.edges || [];
          if (!edges.length) break;

          // Verify each candidate's timestamp before adding
          const newCandidates = edges
            .map((edge: any) => edge.node)
            .filter((candidate: allDataObjects.Candidate) => {
              const isNew = !allCandidates.some(existing => existing.id === candidate.id);
              const isRecent = new Date(candidate.updatedAt) <= new Date(timestamp);
              return isNew && isRecent;
            });

          allCandidates.push(...newCandidates);

          if (edges.length < 30) break;
          lastCursor = edges[edges.length - 1].cursor;
        }
      }

      // Add logging for transparency
      console.log(`Fetched ${allCandidates.length} fresh candidates at ${timestamp} for chatControlType ${chatControlType}`);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }

    return allCandidates;
  }

  async fetchAllCandidatesWithSpecificChatControl(chatControlType: allDataObjects.chatControlType, chatFlowConfigObj: Record<string, allDataObjects.ChatFlowConfig>, apiToken: string): Promise<allDataObjects.Candidate[]> {
    let filters;
    const config = chatFlowConfigObj[chatControlType];
    if (!config || !config.chatFilters) {
      console.log(`No configuration or filters found for chat control type: ${chatControlType}`);
      return [];
    }
    filters = config.chatFilters;
    let allCandidates: allDataObjects.Candidate[] = [];
    let graphqlQueryObjToFetchAllCandidatesForChats = '';
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      graphqlQueryObjToFetchAllCandidatesForChats = workspacesWithOlderSchema.includes(workspaceId) ? graphqlToFetchManyCandidatesOlderSchema : graphqlToFetchAllCandidateData;
      const timestamp = new Date().toISOString();
      for (const filter of filters) {
        // console.log(`Trying filter condition:`, filter);
        let lastCursor: string | null = null;
        const timestampedFilter = {
          ...filter,
          updatedAt: { lte: timestamp },
        };
        while (true) {
          const graphqlQueryObj = JSON.stringify({
            query: graphqlQueryObjToFetchAllCandidatesForChats,
            variables: {
              lastCursor,
              limit: 30,
              filter: timestampedFilter,
              orderBy: [{ updatedAt: 'DESC' }],
            },
          });
          const response = await axiosRequest(graphqlQueryObj, apiToken);
          if (response.data.errors) {
            console.log('Errors in axiosRequest:', response.data.errors, 'with workspace Id:', workspaceId);
            break;
          }
          const edges = response?.data?.data?.candidates?.edges || [];
          console.log(`Received ${edges.length} candidates for current filter, for chatControlType ${chatControlType}`);
          if (!edges.length) {
            console.log('No candidates found for this filter condition');
            break;
          }
          const newCandidates = edges
            .map((edge: any) => edge.node)
            .filter((candidate: allDataObjects.Candidate) => {
              const isNew = !allCandidates.some(existing => existing.id === candidate.id);
              const isRecent = new Date(candidate.updatedAt) <= new Date(timestamp);
              if (!isNew) console.log(`Skipping duplicate candidate: ${candidate.id}`);
              if (!isRecent) console.log(`Skipping non-recent candidate: ${candidate.id}`);
              return isNew && isRecent;
            });
          console.log(`Found ${newCandidates.length} new candidates after filtering`);
          allCandidates.push(...newCandidates);
          if (edges.length < 30) break;
          lastCursor = edges[edges.length - 1].cursor;
        }
      }
      console.log(`Fetched ${allCandidates.length} fresh candidates at ${timestamp} for chatControlType ${chatControlType}`);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      console.error('Stack trace:', error.stack);
    }

    return allCandidates;
  }



  async updateCandidatesChatControls(apiToken: string) {
    console.log('Updating recent candidates chat controls');
    const { candidateIds, jobIds } = await this.makeUpdatesonChats(apiToken);
    console.log('Number of CandidateIds::', candidateIds.length, 'Number of JobIds::', jobIds.length);
    const candidatesByJob = await this.groupCandidatesByJob(candidateIds, apiToken);
    for (const [jobId, jobCandidates] of Object.entries(candidatesByJob)) {
      const job = await new FilterCandidates(this.workspaceQueryService).fetchJobById(jobId, apiToken);
      const chatFlowOrder = job?.chatFlowOrder || this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
      for (const candidateId of jobCandidates) {
        const candidate = await this.fetchCandidateById(candidateId, apiToken);
        for (let i = 0; i < chatFlowOrder.length - 1; i++) {
          const currentStage = chatFlowOrder[i];
          const nextStage = chatFlowOrder[i + 1];
          const isCurrentStageCompleted = candidate[`${currentStage}Completed`];
          const hasNextStageStarted = candidate[nextStage];
          if (isCurrentStageCompleted && !hasNextStageStarted) {
            await this.createChatControl(candidateId, { chatControlType: nextStage as allDataObjects.chatControlType }, apiToken);
            console.log(`Transitioned candidate ${candidateId} from ${currentStage} to ${nextStage}`);
            break;
          }
        }
      }
    }
  }


  async fetchSpecificPeopleToEngageBasedOnChatControl(
    chatControl: allDataObjects.chatControls,
    chatFlowConfigObj: Record<string, allDataObjects.ChatFlowConfig>,
    apiToken: string,
): Promise<{ people: allDataObjects.PersonNode[]; candidateJobs: Map<string, allDataObjects.Jobs> }> {
    try {
        console.log('Fetching candidates to engage');
        const candidates = await this.fetchAllCandidatesWithSpecificChatControl(chatControl.chatControlType, chatFlowConfigObj, apiToken);
        
        // Create a map of jobs indexed by job ID
        const candidateJobs = new Map<string, allDataObjects.Jobs>();
        candidates.forEach(candidate => {
            if (candidate?.jobs?.id) {
                candidateJobs.set(candidate.jobs.id, candidate.jobs);
            }
        });

        const candidatePeopleIds = candidates?.filter(c => c?.people?.id).map(c => c?.people?.id);
        const people = await new FilterCandidates(this.workspaceQueryService).fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds, apiToken);
        
        return { people, candidateJobs };
    } catch (error) {
        console.log('Error in fetchSpecificPeopleToEngageBasedOnChatControl:', error);
        throw error;
    }
}


async executeCandidateEngagement(apiToken: string) {
  try {
      console.log('Cron running and cycle started to check candidate engagement');
      console.log(`Execution started at: ${new Date().toISOString()}`);

      const defaultChatFlowOrder = this.chatFlowConfigBuilder.getDefaultChatFlowOrder();
      let chatFlowConfigObj = this.chatFlowConfigBuilder.buildChatFlowConfig(defaultChatFlowOrder);

      const chatFlow = Object.entries(chatFlowConfigObj)
          .filter(([, config]) => config.order > 0)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([, config]) => ({
              chatControlType: config.type,
          }));

      for (const chatControl of chatFlow) {
          const executionTime = new Date().toISOString();
          console.log(`Starting ${chatControl.chatControlType} execution at ${executionTime}`);

          const { people, candidateJobs } = await this.fetchSpecificPeopleToEngageBasedOnChatControl(
              chatControl, 
              chatFlowConfigObj, 
              apiToken
          );

          console.log(`Number of people to engage for ${chatControl.chatControlType}:`, people.length);
          console.log(`Number of jobs:`, candidateJobs.size);

          // Process each job separately
          for (const [jobId, job] of candidateJobs) {
              if (job?.chatFlowOrder) {
                  chatFlowConfigObj = this.chatFlowConfigBuilder.buildChatFlowConfig(job.chatFlowOrder);
              }

              // Filter people for this specific job
              const peopleForJob = people.filter(person => {
                  return person?.candidates?.edges?.some(edge => 
                      edge.node.jobs.id === jobId
                  );
              });

              if (peopleForJob.length > 0) {
                  await this.startChatControlEngagement(peopleForJob, job, chatControl, chatFlowConfigObj, apiToken);
                  await this.engageCandidates(peopleForJob, job, chatControl, chatFlowConfigObj, apiToken);
              }
          }

          console.log(`Completed ${chatControl.chatControlType} execution at ${new Date().toISOString()}`);
      }
  } catch (error) {
      console.log('Error in checkCandidateEngagement', error);
  }
}
}
