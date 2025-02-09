import * as allDataObjects from '../data-model-objects';
import { UpdateChat } from './update-chat';
import { axiosRequest, sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';
import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from './filter-candidates';
import { chatFlowConfigObj } from '../chat-flow-config';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import { workspacesWithOlderSchema } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';
import { PromptingAgents } from '../llm-agents/prompting-agents';

const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
import { graphQltoUpdateOneCandidate } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';

export default class CandidateEngagementArx {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

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

  async getChatTemplateFromChatControls( chatControl: allDataObjects.chatControls, sortedMessagesList: allDataObjects.MessageNode[], candidateJob: allDataObjects.Jobs, candidatePersonNodeObj: allDataObjects.PersonNode, apiToken: string, chatReply: allDataObjects.chatControlType, recruiterProfile: allDataObjects.recruiterProfileType ) {
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
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: chatReply }],
      lastEngagementChatControl: chatControl.chatControlType,
      messageType: 'candidateMessage',
      messageObj: chatHistory,
      whatsappDeliveryStatus: 'startChatTriggered',
      whatsappMessageId: 'NA',
    };
    
    return whatappUpdateMessageObj;
  }
  
  async createAndUpdateCandidateStartChatChatMessage(chatReply: allDataObjects.chatControlType, candidatePersonNodeObj: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    const personNode = candidatePersonNodeObj;
    const recruiterProfile = allDataObjects.recruiterProfile;
    const candidate = candidatePersonNodeObj?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
    const candidateId = candidate?.id || '';
    console.log('Candidate ID to start chat::', candidateId);
    const messagesList: allDataObjects.MessageNode[] = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
    const sortedMessagesList: allDataObjects.MessageNode[] = messagesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const whatappUpdateMessageObj = await this.getChatTemplateFromChatControls(chatControl, sortedMessagesList, candidateJob, candidatePersonNodeObj, apiToken, chatReply, recruiterProfile);
    await new UpdateChat(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObj, apiToken);
    console.log('Sending a messages::', chatReply, 'to the candidate::', personNode.name.firstName + ' ' + personNode.name.lastName, 'with candidate id::', candidateId);
  }
  async processCandidate(personNode: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('Engagement Type for the candidate ::', personNode.name.firstName + ' ' + personNode.name.lastName, 'for chat control::', chatControl.chatControlType);
    try {
      const candidate = personNode?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
      const candidateId = candidate?.id || '';
      const messagesList: allDataObjects.MessageNode[] = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
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

  async updateRecentCandidatesChatControls(apiToken: string) {
    console.log('Updating recent candidates chat controls::');
    
    // Iterate through chat configs that have status updates
    for (const [chatType, config] of Object.entries(chatFlowConfigObj)) {
      if (!config.statusUpdate) continue;

      // Check if we're within allowed time window
      if (!config.statusUpdate.isWithinAllowedTime()) {
        console.log(`Outside allowed time window for ${chatType}, skipping`);
        continue;
      }      
      const timeWindow = config.statusUpdate.timeWindow;
      const currentTime = new Date();
      const cutoffTime = new Date(currentTime.getTime() - (timeWindow * 60 * 60 * 1000));
      console.log(`Checking for candidates with status updates for ${chatType} between ${cutoffTime} (${timeWindow} hours ago) and ${currentTime}`);
      // Prepare the query with the config's filter
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlToFetchAllCandidateData, variables: { filter: { ...config.statusUpdate.filter, updatedAt: { gte: cutoffTime.toISOString(), lte: currentTime.toISOString() } }, orderBy: config.orderBy } });

      try {
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        const candidates = response?.data?.data?.candidates?.edges || [];
        console.log("Number of candidates receiced for updating chatType::", chatType, "is::", candidates.length);
        
        // Log candidate details for debugging
        candidates.forEach(edge => {
          console.log(`Candidate ID: ${edge.node.id}`);
          console.log(`Status: ${edge.node.candConversationStatus}`);
          console.log(`Updated At: ${edge.node.updatedAt}`);
          console.log('---');
        });

        // Extract unique candidate IDs and create chat controls
        const candidateIds = Array.from(new Set(
          candidates.map(edge => edge.node.id)
        ));

        console.log(`Found ${candidateIds.length} candidates for ${chatType}`);
        
        // Find the next chat type in the sequence
        const chatTypes = Object.entries(chatFlowConfigObj)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([type]) => type);

        const currentIndex = chatTypes.indexOf(config.type);
        const nextType = currentIndex < chatTypes.length - 1 ? chatTypes[currentIndex + 1] : null;

        if (nextType) {
          for (const candidateId of candidateIds) {
            await this.createChatControl(
              candidateId as string,
              { chatControlType: nextType as allDataObjects.chatControlType },
              apiToken
            );
          }
        }
      } catch (error) {
        console.error(`Error processing ${chatType} status updates:`, error);
      }
    }
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
  
  async engageCandidates(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], candidateJob: allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('These are the candidates who we want to engage ::', peopleCandidateResponseEngagementArr.length, 'for chat Control:', chatControl.chatControlType);

    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(peopleCandidateResponseEngagementArr);
    const config = chatFlowConfigObj[chatControl.chatControlType];

    if (!config) {
      console.log(`No configuration found for chat control type: ${chatControl.chatControlType}`);
      return;
    }

    const filteredCandidatesToEngage = sortedPeopleData.filter(person => {
      const candidate = person?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
      return candidate ? config.isEligibleForEngagement(candidate) : false;
    });

    console.log('Number of filtered candidates to engage after time scheduling: ', filteredCandidatesToEngage?.length, 'for chatcontrol', chatControl.chatControlType);

    for (const personNode of filteredCandidatesToEngage) {
      await new UpdateChat(this.workspaceQueryService).setCandidateEngagementStatusToFalse(personNode?.candidates?.edges[0]?.node?.id, apiToken);
      await this.processCandidate(personNode, candidateJob, chatControl, apiToken);
    }
  }
  async startChatControlEngagement(
    peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[],
    candidateJob: allDataObjects.Jobs,
    chatControl: allDataObjects.chatControls,
    apiToken: string,
    chatFlowConfig: Record<string, allDataObjects.ChatFlowConfig>,
  ) {
    const config = chatFlowConfig[chatControl.chatControlType];
    if (!config) {
      console.log(`No configuration found for chat control type: ${chatControl.chatControlType}`);
      return;
    }
    // Run any pre-processing steps
    await config.preProcessing?.(peopleCandidateResponseEngagementArr, candidateJob, chatControl, apiToken, this.workspaceQueryService);

    // Filter candidates using config's filter logic
    const filterCandidates = (personNode: allDataObjects.PersonNode) => {
      const candidate = personNode?.candidates?.edges[0]?.node;
      if (!candidate) return false;
      return config.filterLogic(candidate);
    };

    const filteredCandidatesToStartEngagement = peopleCandidateResponseEngagementArr?.filter(filterCandidates);

    console.log('Number of candidates to start chat engagement::', filteredCandidatesToStartEngagement.length, 'for chatControl::', chatControl.chatControlType);
    // Process filtered candidates
    for (const candidatePersonNodeObj of filteredCandidatesToStartEngagement) {
      console.log('Starting chat engagement for the candidate::', candidatePersonNodeObj.name.firstName + ' ' + candidatePersonNodeObj.name.lastName);
      const chatReply: allDataObjects.chatControlType = chatControl.chatControlType;
      await this.createAndUpdateCandidateStartChatChatMessage(chatReply, candidatePersonNodeObj, candidateJob, chatControl, apiToken);
    }
  }

  async fetchSpecificPeopleToEngageBasedOnChatControl(chatControl: allDataObjects.chatControls, apiToken: string): Promise<{ people: allDataObjects.PersonNode[]; candidateJob: allDataObjects.Jobs }> {
    try {
      console.log('Fetching candidates to engage');
      const candidates = await this.fetchAllCandidatesWithSpecificChatControl(chatControl.chatControlType, apiToken);
      console.log('Fetched', candidates?.length, ' candidates with chatControl', chatControl);
      const candidatePeopleIds = candidates?.filter(c => c?.people?.id).map(c => c?.people?.id);
      const candidateJob = candidates?.filter(c => c?.jobs?.id).map(c => c?.jobs)[0];
      console.log('Got a total of ', candidatePeopleIds?.length, 'candidate ids', 'for chatControl', chatControl);
      const people = await new FilterCandidates(this.workspaceQueryService).fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds, apiToken);
      console.log('Fetched', people?.length, 'people in fetch all People', 'with chatControl', chatControl);
      return { people, candidateJob };
    } catch (error) {
      console.log('This is the error in fetchPeopleToEngageByCheckingOnlyStartChat', error);
      console.log('An error occurred:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  async fetchAllCandidatesWithSpecificChatControl(chatControlType: allDataObjects.chatControlType, apiToken: string): Promise<allDataObjects.Candidate[]> {
    console.log('Fetching all candidates with chatControlType', chatControlType);
    
    let filters;
    if (chatControlType === 'allStartedAndStoppedChats') {
      filters = [
        { stopChat: { is: 'NULL' }, startChat: { eq: true } },
        { stopChat: { eq: true }, startChat: { eq: true } },
        { stopChat: { eq: false }, startChat: { eq: true } }
      ];
    } else {
      const config = chatFlowConfigObj[chatControlType];
      if ((!config || !config.chatFilters)) {
        console.log(`No configuration or filters found for chat control type: ${chatControlType}`);
        return [];
      }
      filters = config.chatFilters;
    }
  
    let allCandidates: allDataObjects.Candidate[] = [];
    let graphqlQueryObjToFetchAllCandidatesForChats = '';
    
    try {
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      graphqlQueryObjToFetchAllCandidatesForChats = workspacesWithOlderSchema.includes(workspaceId) 
        ? allGraphQLQueries.graphqlToFetchManyCandidatesOlderSchema 
        : allGraphQLQueries.graphqlToFetchAllCandidateData;
  
      // Add timestamp to ensure fresh data
      const timestamp = new Date().toISOString();
  
      for (const filter of filters) {
        let lastCursor: string | null = null;
        
        // Add updatedAt filter to ensure fresh data
        const timestampedFilter = {
          ...filter,
          updatedAt: { lte: timestamp }  // Only get candidates updated up to now
        };
  
        while (true) {
          const graphqlQueryObj = JSON.stringify({
            query: graphqlQueryObjToFetchAllCandidatesForChats,
            variables: { 
              lastCursor, 
              limit: 30, 
              filter: timestampedFilter,
              // Add explicit ordering by updatedAt to get most recent changes first
              orderBy: [{ updatedAt: 'DESC' }]
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
  
  async executeCandidateEngagement(apiToken: string) {
    try {
      console.log('Cron running and cycle started to check candidate engagement');
      console.log(`Execution started at: ${new Date().toISOString()}`);
      const chatFlow = Object.entries(chatFlowConfigObj)
        .filter(([, config]) => config.order > 0)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([, config]) => ({
          chatControlType: config.type,
        }));
  
      for (const chatControl of chatFlow) {
        // Add execution timestamp for this iteration
        const executionTime = new Date().toISOString();
        console.log(`Starting ${chatControl.chatControlType} execution at ${executionTime}`);
        
        const { people, candidateJob } = await this.fetchSpecificPeopleToEngageBasedOnChatControl(chatControl, apiToken);
  
        console.log(`Number of people to engage for ${chatControl.chatControlType}:`, people.length);
  
        if (people.length > 0) {
          await this.startChatControlEngagement(people, candidateJob, chatControl, apiToken, chatFlowConfigObj);
          await this.engageCandidates(people, candidateJob, chatControl, apiToken);
        }
        
        console.log(`Completed ${chatControl.chatControlType} execution at ${new Date().toISOString()}`);
      }
      return;
    } catch (error) {
      console.log('Error in checkCandidate Engagement', error);
    }
  }
}
