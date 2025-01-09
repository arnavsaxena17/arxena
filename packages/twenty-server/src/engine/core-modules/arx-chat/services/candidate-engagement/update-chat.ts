import * as allDataObjects from '../../services/data-model-objects';
import * as allGraphQLQueries from '../../services/candidate-engagement/graphql-queries-chatbot';
import { v4 } from 'uuid';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import axios from 'axios';
import { ToolsForAgents } from '../../services/llm-agents/prompting-tool-calling';
import  {GetCurrentStageByMessages}  from '../../services/llm-agents/get-current-stage-from-messages';
import { ApiKeyToken } from 'src/engine/core-modules/auth/dto/token.entity';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// import { last } from 'rxjs';
// import { MicroserviceHealthIndicator } from '@nestjs/terminus';
import { CreateManyCandidates, CreateManyPeople, graphQltoStartChat,UpdateOneJob , CreateOneJob, graphQltoStopChat, createOneQuestion, graphqlToFindManyJobByArxenaSiteId } from 'src/engine/core-modules/candidate-sourcing/graphql-queries';

class Semaphore {
  private permits: number;
  private tasks: (() => void)[] = [];
  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.tasks.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.tasks.length > 0 && this.permits > 0) {
      this.permits--;
      const nextTask = this.tasks.shift();
      nextTask?.();
    }
  }
}



export class FetchAndUpdateCandidatesChatsWhatsapps {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}

  async fetchSpecificPeopleToEngageBasedOnChatControl(chatControl: allDataObjects.chatControls, apiToken:string): Promise<allDataObjects.PersonNode[]> {
    try {
      console.log('Fetching candidates to engage');
      const candidates = await this.fetchAllCandidatesWithSpecificChatControl(chatControl,apiToken);
      console.log("Fetched", candidates?.length, " candidates with chatControl", chatControl);
      const candidatePeopleIds = candidates?.filter(c => c?.people?.id).map(c => c?.people?.id);
      console.log("Got a total of ", candidatePeopleIds?.length, "candidate ids", "for chatControl", chatControl);
      const people = await this.fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds, apiToken);
      console.log("Fetched", people?.length ,"people in fetch all People", "with chatControl", chatControl);
      return people;
    } catch (error) {
      console.log("This is the error in fetchPeopleToEngageByCheckingOnlyStartChat", error);
      console.error('An error occurred:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }
  async fetchSpecificPersonToEngageBasedOnChatControl(chatControl: allDataObjects.chatControls, personId:string, apiToken:string): Promise<allDataObjects.PersonNode[]> {
    try {
      console.log('Fetching candidates to engage');
      // const candidates = await this.fetchAllCandidatesWithSpecificChatControl(chatControl);
      // console.log("Fetched", candidates?.length, " candidates with chatControl", chatControl);
      // const candidatePeopleIds = candidates?.filter(c => c?.people?.id).map(c => c?.people?.id);
      // console.log("Got a total of ", candidatePeopleIds?.length, "candidate ids", "for chatControl", chatControl);
      const people = await this.fetchAllPeopleByCandidatePeopleIds([personId], apiToken);
      console.log("Fetched", people?.length ,"people in fetch person", "with chatControl", chatControl);
      return people;
    } catch (error) {
      console.log("This is the error in fetchPeopleToEngageByCheckingOnlyStartChat", error);
      console.error('An error occurred:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }


  async updateCandidatesWithChatCount(candidateIds: string[] | null = null, apiToken:string){
    let allCandidates = await this.fetchAllCandidatesWithSpecificChatControl("startChat",apiToken);
    if (candidateIds && Array.isArray(candidateIds)) {
      allCandidates = allCandidates.filter(candidate => candidateIds.includes(candidate.id));
    }

    console.log("Fetched", allCandidates?.length, " candidates with chatControl allStartedAndStoppedChats");
    for (const candidate of allCandidates){
      const candidateId = candidate?.id;
      const whatsappMessages = await this.fetchAllWhatsappMessages(candidateId, apiToken);
      const chatCount = whatsappMessages?.length;
      const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { chatCount: chatCount } };
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateChatCount, variables: updateCandidateObjectVariables });

      try {
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        console.log("Candidate chat count updated successfully:", response.data);
        console.log('Candidate chat count updated successfully');
      } catch (error) {
        console.log('Error in updating candidate chat count:', error);
      }
    }
  }


  async updateRecentCandidatesChatCount(apiToken:string) {
    const candidateIds = await this.getRecentCandidateIds(apiToken);
    await this.updateCandidatesWithChatCount(candidateIds, apiToken);
  }


  async updateRecentCandidatesProcessCandidateChatsGetStatuses(apiToken:string) {
    const candidateIds = await this.getRecentCandidateIds(apiToken);
    await this.processCandidatesChatsGetStatuses(apiToken,candidateIds);
  }


  async processCandidatesChatsGetStatuses(apiToken:string,candidateIds: string[] | null = null, currentWorkspaceMemberId: string| null = null ) {
    console.log("Processing candidates chats to get statuses with start chat true");
    let allCandidates = await this.fetchAllCandidatesWithSpecificChatControl("allStartedAndStoppedChats",apiToken);
    if (candidateIds && Array.isArray(candidateIds)) {
      allCandidates = allCandidates.filter(candidate => candidateIds.includes(candidate.id));
    }
    console.log("Fetched", allCandidates?.length, " candidates with chatControl allStartedAndStoppedChats");
    
    const semaphore = new Semaphore(10); // Allow 10 concurrent requests
    const processWithSemaphore = async (candidate: any) => {
      await semaphore.acquire();
      try {
        const candidateId = candidate?.id;
        const whatsappMessages = await this.fetchAllWhatsappMessages(candidateId,apiToken);
        const candidateStatus = await new GetCurrentStageByMessages(this.workspaceQueryService).getChatStageFromChatHistory(whatsappMessages, currentWorkspaceMemberId, apiToken) as allDataObjects.allStatuses;

        const updateCandidateObjectVariables = { 
          idToUpdate: candidateId, 
          input: { candConversationStatus: candidateStatus } 
        };
        const graphqlQueryObj = JSON.stringify({ 
          query: allGraphQLQueries.graphqlQueryToUpdateCandidateChatCount, 
          variables: updateCandidateObjectVariables 
        });
        const response = await axiosRequest(graphqlQueryObj,apiToken);
        console.log("Candidate chat status updated successfully:", response.data);
      } catch (error) {
        console.log('Error in updating candidate chat count:', error);
      } finally {
        semaphore.release();
      }
    };
  
    // Process all candidates with semaphore control
    await Promise.all(
      allCandidates.map(candidate => processWithSemaphore(candidate))
    );
  }
  

  async fetchAllCandidatesWithSpecificChatControl(chatControl:allDataObjects.chatControls, apiToken:string): Promise<allDataObjects.Candidate[]> {
    console.log("Fetching all candidates with chatControl", chatControl);
    let allCandidates: allDataObjects.Candidate[] = [];
    let lastCursor: string | null = null;
    let graphqlQueryObj;
    while (true) {
      if (chatControl === "startChat"){
        graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlToFetchAllCandidatesByStartChat, variables: {lastCursor, limit: 30, filter: {startChat: {eq: true}, stopChat: { eq: false }, startVideoInterviewChat: {eq: false}}}});
      }
      if (chatControl === "allStartedAndStoppedChats"){
        graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlToFetchAllCandidatesByStartChat, variables: {lastCursor, limit: 30, filter: {startChat: {eq: true}}}});
      }
      else if (chatControl === "startVideoInterviewChat"){
        graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlToFetchAllCandidatesByStartChat, variables: {lastCursor, limit: 30, filter: {startVideoInterviewChat: {eq: true}, stopChat: { eq: false }}}});
      }
      else if (chatControl === "startMeetingSchedulingChat"){
        graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlToFetchAllCandidatesByStartChat, variables: {lastCursor, limit: 30, filter: {startMeetingSchedulingChat: {eq: true}, startVideoInterviewChat: {eq: true}, stopChat: { eq: false }}}});
      }
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      if (response.data.errors) {
        console.log("Errors in axiosRequest response when trying to fetch candidates with specific chat control:", response.data.errors);
      }
      const edges = response?.data?.data?.candidates?.edges || [];
      if (!edges || edges?.length === 0) break;
      allCandidates = allCandidates?.concat(edges.map((edge: any) => edge.node));
      lastCursor = edges[edges.length - 1].cursor;
    }
    console.log("Number of candidates from fetchedcandidates:", allCandidates?.length, "for chatControl", chatControl)
    return allCandidates;
  }
  async fetchCandidateByCandidateId(candidateId: string, apiToken:string): Promise<allDataObjects.CandidateNode> {
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { id: { eq: candidateId } } } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log("Fetched candidate by candidate ID:", response?.data);
      console.log("Number of candidates with candidate ID:", response?.data?.data?.candidates?.edges?.length);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      return candidateObj;
    } catch (error) {
      console.log('Error in fetching candidate by candidate ID:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }
  async fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds: string[], apiToken:string): Promise<allDataObjects.PersonNode[]> {
    let allPeople: allDataObjects.PersonNode[] = [];
    let lastCursor: string | null = null;
    while (true) {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyPeopleEngagedCandidates, variables: {filter: {id: {in: candidatePeopleIds}}, lastCursor}});
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      const edges = response?.data?.data?.people?.edges;
      if (!edges || edges?.length === 0) break;
      allPeople = allPeople.concat(edges.map((edge: any) => edge?.node));
      lastCursor = edges[edges.length - 1].cursor;
    }
    console.log("Number of people fetched in fetchAllPeopleByCandidatePeopleIds:", allPeople?.length);
    return allPeople;
  }


  async getRecentCandidateIds(apiToken:string): Promise<string[]> {
    try {
      // Calculate timestamp from 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphQlToFetchWhatsappMessages,
        variables: {
          filter: {
        createdAt: {
          gte: fiveMinutesAgo
        }
          },
          orderBy: [{
        position: 'AscNullsFirst'
          }]
        }
      });

      const data = await axiosRequest(graphqlQueryObj, apiToken);
      // console.log("This is the number of perople who edges data messaged recently in getRecentCandidateIds", data);
      // Extract unique candidate IDs
      if (data?.data?.whatsappMessages?.edges?.length > 0) {
        console.log("This is the number of perople who messaged recently in getRecentCandidateIds", data?.data?.whatsappMessages?.edges?.length);
        const candidateIds: string[] = Array.from(new Set(
          data?.data?.whatsappMessages?.edges
        .map(edge => edge?.node?.candidate?.id)
        .filter(id => id) // Remove any null/undefined values
        )) as unknown as string[];
        
        return candidateIds;
      } else {
        console.log("No recent candidates found");
        return [];
      }
  
    } catch (error) {
      console.log('Error fetching recent WhatsApp messages:', error);
      return [];
    }
  }
  
  
  async fetchAllWhatsappMessages(candidateId: string, apiToken:string): Promise<allDataObjects.MessageNode[]> {
    // console.log("Fetching all whatsapp messages for candidate ID:", candidateId);
    let allWhatsappMessages: allDataObjects.MessageNode[] = [];
    let lastCursor = null;
    while (true) {
      try {
        const graphqlQueryObj = JSON.stringify({
          query: allGraphQLQueries.graphQlToFetchWhatsappMessages,
          variables: { "limit": 30, "lastCursor": lastCursor, "filter": { "candidateId": { "in": [candidateId] } }, "orderBy": [{ "position": "DescNullsFirst" }] } });
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        const whatsappMessages = response?.data?.data?.whatsappMessages;
        if (!whatsappMessages || whatsappMessages?.edges?.length === 0) {
          console.log("No more data to fetch.");
          break;
        }
        const newWhatsappMessages = whatsappMessages.edges.map(edge => edge.node);
        allWhatsappMessages = allWhatsappMessages.concat(newWhatsappMessages);
        lastCursor = whatsappMessages.edges[whatsappMessages.edges.length - 1].cursor;
        if (newWhatsappMessages.length < 30) {
          console.log("Reached the last page.");
          break;
        }
      } catch (error) {
        console.error('Error fetching whatsappmessages:', error);
        break;
      }
    }
    // console.log("Number of messages for candidate id:", candidateId, "is", allWhatsappMessages?.length);
    return allWhatsappMessages;
  }

  async getInterviewByJobId(jobId: string, apiToken:string){
    try {
      console.log("jobId::", jobId)
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindInterviewsByJobId, variables: { "filter": { "jobId": { "in": [ jobId ] } }, "orderBy": [ { "position": "AscNullsFirst" } ] } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log("This is the response data:", response.data)
      console.log("This is the responsedata.data:", response.data.data)
      console.log("This is the responseaIInterviews:", response.data.data.aIInterviews)
      const interviewObj = response?.data?.data?.aIInterviews.edges[0].node;
      return interviewObj;
    } catch (error) {
      console.log('Error in fetching interviews:: ', error);
    }
  }
  async createVideoInterviewForCandidate(candidateId : string, apiToken:string){
    try {
      const candidateObj:allDataObjects.CandidateNode = await this.fetchCandidateByCandidateId(candidateId, apiToken);
      const jobId = candidateObj?.jobs?.id;
      console.log("jobId:",jobId)
      const interviewObj = await this.getInterviewByJobId(jobId, apiToken);
      console.log("interviewObj:::",interviewObj)
      const interviewStatusId = v4();
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToCreateVideoInterview,
        variables: {
        input: {
          id: interviewStatusId,
          candidateId: candidateObj?.id,
          name: "Interview - "+ candidateObj?.name + " for "+ candidateObj?.jobs?.name,
          aIInterviewId: interviewObj?.id,
          interviewStarted:false,
          interviewCompleted:false,
          interviewLink:{
            url:"/video-interview/"+interviewStatusId,
            label: "/video-interview/"+interviewStatusId,
          },
          interviewReviewLink:{
            url:"/video-interview-review/"+candidateObj?.id,
            label: "/video-interview-review/"+candidateObj?.id,
          },
          cameraOn:false,
          micOn:false,
          position: "first"
        }
        }
      });
    
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      if (response.data.errors) {
        console.log("Error in response for create interview for candidate:", response?.data?.errors);
      }else{
        console.log('Video Interview created successfully');
      }

      return response.data;

    } catch (error) {
      console.log('Error in creating video interview:', error.message);
    }
  }

  async formatChat(messages) {
    // Sort messages by position in ascending order
    // messages.sort((a, b) => a.position - b.position);
  
    let formattedChat = '';
    let messageCount = 1;
    messages.forEach(message => {
      const timestamp = new Date(message.createdAt).toLocaleString();
      let sender = '';
      if (message.name === 'candidateMessage') {
        sender = 'Candidate';
      } else if (message.name === 'botMessage' || message.name === 'recruiterMessage') {
        sender = 'Recruiter';
      } else {
        sender = message.name;
      }
      
      formattedChat += `[${timestamp}] ${sender}:\n`;
      formattedChat += `${message.message}\n\n`;
      messageCount++;
    });
  
    return formattedChat;
  }
  
  
  async getPersonDetailsByPhoneNumber(phoneNumber: string, apiToken:string) {
    console.log('Trying to get person details by phone number:', phoneNumber);
    
    if (!phoneNumber || phoneNumber === '') {
      console.log('Phone number is empty and no candidate found');
      return allDataObjects.emptyCandidateProfileObj;
    }
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumber + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const personObj = response.data?.data?.people?.edges[0]?.node;
      if (personObj){
        console.log('Personobj:', personObj?.name?.firstName || "" +" " + personObj?.name?.lastName) + "";
        return personObj;
      }
      else{
        console.log("Person not found")
        return allDataObjects.emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty candidate person profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }
  
  async getPersonDetailsByCandidateId(candidateId: string,apiToken:string) {
    console.log('Trying to get person details by candidateId:', candidateId);
    if (!candidateId || candidateId === '') {
      console.log('Phone number is empty and no candidate found');
      return allDataObjects.emptyCandidateProfileObj;
    }
    const graphVariables = { filter: { id: { eq: candidateId } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: graphVariables });
      const candidateObjresponse = await axiosRequest(graphqlQueryObj, apiToken);
      const candidateObj = candidateObjresponse?.data?.data;
      console.log("candidate objk1:", candidateObj);
      
      const candidateNode = candidateObjresponse?.data?.data?.candidates?.edges[0]?.node;
      if (!candidateNode) {
        console.log('Candidate not found');
        return { status: 'Failed', message: 'Candidate not found' };
      }
  
      const person = candidateNode?.people;
      if (!person) {
        console.log('Person ID not found');
        return { status: 'Failed', message: 'Person ID not found' };
      }
      console.log("Person ID:", person);
  

      if (person){
        console.log('Personobj:', person?.name?.firstName || "" +" " + person?.name?.lastName) + "";
        return person;
      }
      else{
        console.log("Person not found")
        return allDataObjects.emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty candidate person profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }
  

    async startChatByCandidateId(candidateId: string, apiToken: string) {
      const graphqlVariables = {
        idToUpdate: candidateId,
        input: {
          startChat: true,
        },
      };
      const graphqlQueryObj = JSON.stringify({
        query: graphQltoStartChat,
        variables: graphqlVariables,
      });
  
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      if (response.data.errors) {
        console.log('Error in startChat:', response.data.errors);
      }
      console.log("Response from create startChat", response.data.data);
      return response.data;
    }
  

  async getCandidateInformation(userMessage: allDataObjects.chatMessageType, apiToken:string) {
    console.log('This is the phoneNumberFrom', userMessage.phoneNumberFrom);
    let phoneNumberToSearch: string;
    if (userMessage.messageType === 'messageFromSelf') {
      phoneNumberToSearch = userMessage.phoneNumberTo.replace("+","");
    } else {
      phoneNumberToSearch = userMessage.phoneNumberFrom.replace("+","");
    }

    // Ignore if phoneNumberToSearch is not a valid number
    if (isNaN(Number(phoneNumberToSearch))) {
      console.log('Phone number is not valid, ignoring:', phoneNumberToSearch);
      return allDataObjects.emptyCandidateProfileObj;
    }

    console.log("Phone number to search is :", phoneNumberToSearch)
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumberToSearch + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      console.log('going to get candidate information');
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      const activeJobCandidateObj = candidateDataObjs?.find((edge: any) => edge?.node?.jobs?.isActive);
      console.log('This is the number of candidates', candidateDataObjs?.length);
      console.log('This is the activeJobCandidateObj who got called', activeJobCandidateObj?.node?.name || "");
      if (activeJobCandidateObj) {
        const personWithActiveJob = response?.data?.data?.people?.edges?.find((person: { node: { candidates: { edges: any[] } } }) => person?.node?.candidates?.edges?.some(candidate => candidate?.node?.jobs?.isActive));
        const candidateProfileObj: allDataObjects.CandidateNode = {
          name: personWithActiveJob?.node?.name?.firstName || "",
          id: activeJobCandidateObj?.node?.id,
          whatsappProvider : activeJobCandidateObj?.node?.whatsappProvider,
          jobs: {
            name: activeJobCandidateObj?.node?.jobs?.name || "",
            id: activeJobCandidateObj?.node?.jobs?.id,
            recruiterId: activeJobCandidateObj?.node?.jobs?.recruiterId,
            jobCode:activeJobCandidateObj?.node?.jobs?.jobCode,
            company: {
              name: activeJobCandidateObj?.node?.jobs?.companies?.name || "",
              companyId: activeJobCandidateObj?.node?.jobs?.companies?.id,
              domainName: activeJobCandidateObj?.node?.jobs?.companies?.domainName,
              descriptionOneliner: activeJobCandidateObj?.node?.jobs?.companies?.descriptionOneliner,
            },
            jobLocation: activeJobCandidateObj?.node?.jobs?.jobLocation,
            whatsappMessages: activeJobCandidateObj?.node?.jobs?.whatsappMessages,
          },
          aIInterviewStatus: activeJobCandidateObj?.node?.aIInterviewStatus,
          engagementStatus: activeJobCandidateObj?.node?.engagementStatus,
          lastEngagementChatControl: activeJobCandidateObj?.node?.lastEngagementChatControl,
          phoneNumber: personWithActiveJob?.node?.phone,
          email: personWithActiveJob?.node?.email,
          input: userMessage?.messages[0]?.content,
          startChat: activeJobCandidateObj?.node?.startChat,
          startMeetingSchedulingChat: activeJobCandidateObj?.node?.startMeetingSchedulingChat,
          startVideoInterviewChat: activeJobCandidateObj?.node?.startVideoInterviewChat,
          stopChat: activeJobCandidateObj?.node?.stopChat,
          whatsappMessages: activeJobCandidateObj?.node?.whatsappMessages,
          status: activeJobCandidateObj?.node?.status,
          emailMessages: { edges: activeJobCandidateObj?.node?.emailMessages?.edges },
          candidateReminders: {
            edges: activeJobCandidateObj?.node?.candidateReminders?.edges,
          },
        };
        return candidateProfileObj;
      } else {
        console.log('No active candidate found.');
        return allDataObjects.emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty get Candidate Information candidate profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }

  async fetchQuestionsByJobId(jobId: string, apiToken:string): Promise<{ questionIdArray: { questionId: string; question: string }[]; questionArray: string[] }> {
    console.log("Going to fetch questions for job id:", jobId)
    const data = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyQuestionsByJobId, variables: { filter: { jobsId: { in: [`${jobId}`] } }, orderBy: { position: 'DescNullsFirst' } } });
    const response = await axios.request({
      method: 'post',
      url: process.env.GRAPHQL_URL,
      headers: { authorization: 'Bearer ' + apiToken, 'content-type': 'application/json' },
      data: data,
    });
    const questionsArray: string[] = response?.data?.data?.questions?.edges.map((val: { node: { name: string } }) => val.node.name);
    const questionIdArray = response?.data?.data?.questions?.edges?.map((val: { node: { id: string; name: string } }) => {
      return { questionId: val.node.id, question: val.node.name };
    });
    return { questionArray: questionsArray, questionIdArray: questionIdArray };
  }

  async createAndUpdateWhatsappMessage(candidateProfileObj: allDataObjects.CandidateNode, userMessage: allDataObjects.candidateChatMessageType, apiToken:string) {
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
      console.log("GRAPHQL WITH WHATSAPP MESSAGE:", createNewWhatsappMessageUpdateVariables?.input?.message);
      // console.log("GRAPHQL WITH createNewWhatsappMessageUpdateVariables:", createNewWhatsappMessageUpdateVariables);
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementStatus(candidateProfileObj: allDataObjects.CandidateNode, whatappUpdateMessageObj: allDataObjects.candidateChatMessageType,apiToken:string) {
    const candidateEngagementStatus = whatappUpdateMessageObj.messageType !== 'botMessage';
    console.log('GOING TO UPDATE CANDIDATE ENGAGEMENT STATUS BECAUES OF THIS WHATSAPP MESSAGE OBJ::', candidateEngagementStatus);
    const updateCandidateObjectVariables = { 
      idToUpdate: candidateProfileObj?.id, 
      input: { 
        engagementStatus: candidateEngagementStatus,
        lastEngagementChatControl: whatappUpdateMessageObj.lastEngagementChatControl // Store which chat control set this status
      } 
    };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Candidate engagement status updated successfully');
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }

  async setCandidateEngagementStatusToFalse(candidateProfileObj: allDataObjects.CandidateNode,apiToken:string) {
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { engagementStatus: false } };
    console.log('This is the value of updatecandidateobject variables::0', updateCandidateObjectVariables);
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Response from axios update request:', response.data);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }


  async updateCandidateAnswer(candidateProfileObj: allDataObjects.CandidateNode, AnswerMessageObj: allDataObjects.AnswerMessageObj,apiToken:string) {
    const updateCandidateObjectVariables = { input: { ...AnswerMessageObj } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneAnswer, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
  async scheduleCandidateInterview(candidateProfileObj: allDataObjects.CandidateNode, scheduleInterviewObj: allDataObjects.candidateChatMessageType,apiToken:string) {
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { scheduleInterviewObj: scheduleInterviewObj } };
    const graphqlQueryObj = JSON.stringify({ query: {}, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async removeChatsByPhoneNumber(phoneNumberFrom: string, apiToken:string) {
    const personObj: allDataObjects.PersonNode = await this.getPersonDetailsByPhoneNumber(phoneNumberFrom,apiToken);
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    const messagesList = personCandidateNode?.whatsappMessages?.edges;
    const messageIDs = messagesList?.map(message => message?.node?.id);
    this.removeChatsByMessageIDs(messageIDs, apiToken);
  }

  async removeChatsByMessageIDs(messageIDs: string[], apiToken:string) {
    const graphQLVariables = { filter: { id: { in: messageIDs } } };
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToRemoveMessages,
      variables: graphQLVariables,
    });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('REsponse status:', response.status);
    return response;
  }

  async getCandidateDetailsByPhoneNumber(phoneNumber: string, apiToken:string): Promise<allDataObjects.CandidateNode> {
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumber + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('This is the response from getCandidate Information FROM PHONENUMBER in getPersonDetailsByPhoneNumber', response.data.data);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      return candidateDataObjs;
    } catch (error) {
      console.log('Getting an error and returning empty candidate profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }
  async getPersonDetailsByPersonId(personID: string, apiToken:string): Promise<allDataObjects.PersonNode> {
    const graphVariables = { filter: { id: { eq: personID } }, orderBy: { position: 'AscNullsFirst' } };
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('This is the response from getCandidate Information FROM personID in getPersoneDetailsByPhoneNumber', response.data.data);
      const personDataObjs = response.data?.data.people.edges[0]?.node;
      console.log("personDataobjs:", personDataObjs);
      return personDataObjs;
  }

  async updateCandidateProfileStatus(candidateProfileObj: allDataObjects.CandidateNode, updateCandidateMessageObj: allDataObjects.candidateChatMessageType, apiToken:string) {
    const candidateStatus = updateCandidateMessageObj.messageType;
    console.log('Updating the candidate status::', candidateStatus);
    const candidateId = candidateProfileObj?.id;
    console.log('This is the candidateID for which we are trying to update the status:', candidateId);
    const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { status: candidateStatus } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateStatus, variables: updateCandidateObjectVariables });
    console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log("REsponse from updating candidate status:", response.status)
      return 'Updated the candidate profile with the status.';
    } catch {
      console.log('Error in updating candidate profile status');
    }
  }

  async updateEngagementStatusBeforeRunningEngageCandidates(candidateId: string, apiToken:string) {
    
    const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { engagementStatus: false } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Candidate engagement status updated successfully');
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }
}
