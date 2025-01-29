import * as allDataObjects from '../../services/data-model-objects';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import { v4 } from 'uuid';
import { axiosRequest, formatChat } from '../../utils/arx-chat-agent-utils';
import axios from 'axios';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { graphQltoUpdateOneCandidate, workspacesWithOlderSchema } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';
import {FilterCandidates} from './filter-candidates';
import { StageWiseClassification } from '../llm-agents/stage-classification';
import {Semaphore} from '../../utils/semaphore';
import { ChatControls } from './chat-controls';
import { StartChatProcesses } from './chat-control-processes/start-chat-processes';
export class FetchAndUpdateCandidatesChatsWhatsapps {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) { }
  async makeUpdatesForNewChats(apiToken:string){
    console.log("making updates to candidates based on the rchats they have made")
    const { candidateIds, jobIds } = await new StartChatProcesses().getRecentCandidateIdsToMakeUpdatesonChats(apiToken);
    console.log("Received a total of ", candidateIds.length, " candidates to make updates for based on the chats that they have done");
    await this.updateCandidatesWithChatCount(candidateIds, apiToken);
    await this.processCandidatesChatsGetStatuses(apiToken,jobIds, candidateIds);
  }

  async updateCandidatesWithChatCount(candidateIds: string[] | null = null, apiToken: string) {
    let allCandidates = await new FilterCandidates(this.workspaceQueryService).fetchAllCandidatesWithSpecificChatControl('startChat', apiToken);
    if (candidateIds && Array.isArray(candidateIds)) {
      allCandidates = allCandidates.filter(candidate => candidateIds.includes(candidate.id));
    }
    console.log('Fetched', allCandidates?.length, ' candidates with chatControl allStartedAndStoppedChats');
    for (const candidate of allCandidates) {
      const candidateId = candidate?.id;
      const whatsappMessages = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
      const chatCount = whatsappMessages?.length;
      const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { chatCount: chatCount } };
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateChatCount, variables: updateCandidateObjectVariables });

      try {
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        console.log('Candidate chat count updated successfully:', response.data);
      } catch (error) {
        console.log('Error in updating candidate chat count:', error);
      }
    }
  }

  async processCandidatesChatsGetStatuses(apiToken: string, jobIds: string[], candidateIds: string[] | null = null, currentWorkspaceMemberId: string | null = null) {
    console.log('Processing candidates chats to get statuses with start chat true');
    let allCandidates = await new FilterCandidates(this.workspaceQueryService).fetchAllCandidatesWithSpecificChatControl('allStartedAndStoppedChats', apiToken);
    if (candidateIds && Array.isArray(candidateIds)) {
      allCandidates = allCandidates.filter(candidate => candidateIds.includes(candidate.id));
    }
    console.log('Fetched', allCandidates?.length, ' candidates with chatControl allStartedAndStoppedChats');
    const semaphore = new Semaphore(10); // Allow 10 concurrent requests
    const processWithSemaphore = async (candidate: any) => {
      await semaphore.acquire();
      try {
        const candidateId = candidate?.id;
        const jobId = candidateIds ? jobIds[candidateIds.indexOf(candidateId)] : '';
        const whatsappMessages = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
        
        // Get the chat status and formatted chat in parallel
        const [candidateStatus] = await Promise.all([
          new StageWiseClassification(this.workspaceQueryService).getChatStageFromChatHistory(
            whatsappMessages, 
            candidateId,
            jobId || '', // Ensure jobId is a string
            currentWorkspaceMemberId, 
            apiToken
          ) as Promise<allDataObjects.allStatuses>
        ])
        // Return this info for later batch updates
        return {
          candidateId,
          candidateStatus,
          googleSheetId: candidate?.jobs?.googleSheetId,
          whatsappMessages,
        };
      } catch (error) {
        console.log('Error in processing candidate:', error);
        return null;
      } finally {
        semaphore.release();
      }
    };
  
    // Process all candidates and collect results
    const results = await Promise.all(allCandidates.map(candidate => processWithSemaphore(candidate)));
    const validResults = results.filter(result => result !== null);
  
    // Batch update the candidate statuses
    const updatePromises = validResults.map(async result => {
      if (!result) return;
  
      const updateCandidateObjectVariables = {
        idToUpdate: result.candidateId,
        input: { candConversationStatus: result.candidateStatus },
      };
  
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToUpdateCandidateChatCount,
        variables: updateCandidateObjectVariables,
      });
  
      try {
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        console.log('Candidate chat status updated successfully:', response.data, "with the status of ::", result.candidateStatus);
      } catch (error) {
        console.log('Error in updating candidate chat count:', error);
      }
    });
  
    await Promise.all(updatePromises);
    return validResults;
  }

  async createAndUpdateWhatsappMessage(candidateProfileObj: allDataObjects.CandidateNode, userMessage: allDataObjects.whatappUpdateMessageObjType, apiToken: string) {
    console.log('This is the message being updated in the database ', userMessage?.messages[0]?.content);
    const createNewWhatsappMessageUpdateVariables = {
      input: {
        position: 'first',
        id: v4(),
        candidateId: candidateProfileObj?.id,
        personId: candidateProfileObj?.person?.id,
        message: userMessage?.messages[0]?.content || userMessage?.messages[0]?.text,
        phoneFrom: userMessage?.phoneNumberFrom,
        phoneTo: userMessage?.phoneNumberTo,
        jobsId: candidateProfileObj.jobs?.id,
        recruiterId: candidateProfileObj?.jobs?.recruiterId,
        name: userMessage?.messageType,
        lastEngagementChatControl: userMessage?.lastEngagementChatControl,
        messageObj: userMessage?.messageObj,
        whatsappDeliveryStatus: userMessage.whatsappDeliveryStatus,
        whatsappMessageId: userMessage?.whatsappMessageId,
        typeOfMessage: userMessage?.type,
        audioFilePath: userMessage?.databaseFilePath,
      },
    };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneNewWhatsappMessage, variables: createNewWhatsappMessageUpdateVariables });
    try {
      console.log('GRAPHQL WITH WHATSAPP MESSAGE:', createNewWhatsappMessageUpdateVariables?.input?.message);
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementStatus(candidateProfileObj: allDataObjects.CandidateNode, whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType, apiToken: string) {
    const candidateEngagementStatus = whatappUpdateMessageObj.messageType !== 'botMessage';
    console.log('Updating candidate engagement status to:', candidateEngagementStatus, "for candidate id::", candidateProfileObj.id);
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { engagementStatus: candidateEngagementStatus, lastEngagementChatControl: whatappUpdateMessageObj.lastEngagementChatControl } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Candidate engagement status updated successfully to ::',candidateEngagementStatus );
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }


  async setCandidateEngagementStatusToFalse(candidateId: string, apiToken: string) {
    console.log("Setting Candidate ENgagement Status sto false::", candidateId);
    const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { engagementStatus: false } };
    console.log('This is the value of updatecandidateobject variables::0', updateCandidateObjectVariables);
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Response from axios update request:', response.data);
      console.log('Candidate engagement status updated successfully to ::',false );
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateAnswer(candidateProfileObj: allDataObjects.CandidateNode, AnswerMessageObj: allDataObjects.AnswerMessageObj, apiToken: string) {
    const updateCandidateObjectVariables = { input: { ...AnswerMessageObj } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneAnswer, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
  async scheduleCandidateInterview(candidateProfileObj: allDataObjects.CandidateNode, scheduleInterviewObj: allDataObjects.whatappUpdateMessageObjType, apiToken: string) {
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { scheduleInterviewObj: scheduleInterviewObj } };
    const graphqlQueryObj = JSON.stringify({ query: {}, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementDataInTable(whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType, apiToken:string, isAfterMessageSent: boolean = false) {
    let candidateProfileObj = whatappUpdateMessageObj.messageType !== 'botMessage' ? await new FilterCandidates(this.workspaceQueryService).getCandidateInformation(whatappUpdateMessageObj,apiToken) : whatappUpdateMessageObj.candidateProfile;
    if (candidateProfileObj.name === '') return;
    console.log('Candidate information retrieved successfully');
    const whatsappMessage = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).createAndUpdateWhatsappMessage(candidateProfileObj, whatappUpdateMessageObj,apiToken);
    if (!whatsappMessage || isAfterMessageSent) return;
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj, apiToken);
    if (!updateCandidateStatusObj) return;
    return { status: 'success', message: 'Candidate engagement status updated successfully' };
  }

  async removeChatsByPhoneNumber(phoneNumberFrom: string, apiToken: string) {
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(phoneNumberFrom, apiToken);
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    const messagesList = personCandidateNode?.whatsappMessages?.edges;
    const messageIDs = messagesList?.map(message => message?.node?.id);
    this.removeChatsByMessageIDs(messageIDs, apiToken);
  }

  async removeChatsByMessageIDs(messageIDs: string[], apiToken: string) {
    const graphQLVariables = { filter: { id: { in: messageIDs } } };
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToRemoveMessages,
      variables: graphQLVariables,
    });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('REsponse status:', response.status);
    return response;
  }


  async updateCandidateProfileStatus(candidateProfileObj: allDataObjects.CandidateNode, whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType, apiToken: string) {
    const candidateStatus = whatappUpdateMessageObj.messageType;
    console.log('Updating the candidate status::', candidateStatus);
    console.log('Updating the candidate api token::', apiToken);
    const candidateId = candidateProfileObj?.id;
    console.log('This is the candidateID for which we are trying to update the status:', candidateId);
    const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { status: candidateStatus } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateStatus, variables: updateCandidateObjectVariables });
    console.log('GraphQL query to update candidate status:', graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('REsponse from updating candidate status:', response.status);
      return 'Updated the candidate profile with the status.';
    } catch {
      console.log('Error in updating candidate profile status');
    }
  }


}
