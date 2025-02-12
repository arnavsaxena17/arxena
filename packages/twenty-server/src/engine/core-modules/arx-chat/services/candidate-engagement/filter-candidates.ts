import { WorkspaceQueryService } from "src/engine/core-modules/workspace-modifications/workspace-modifications.service";
import * as allDataObjects from '../../services/data-model-objects';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import { axiosRequest } from "../../utils/arx-chat-agent-utils";
import { workspacesWithOlderSchema } from "src/engine/core-modules/candidate-sourcing/graphql-queries";
import axios from "axios";

export class FilterCandidates {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async updateChatHistoryObjCreateWhatsappMessageObj(
    wamId: string,
    personNode: allDataObjects.PersonNode,
    candidateNode: allDataObjects.CandidateNode,
    chatHistory: allDataObjects.ChatHistoryItem[],
    chatControl: allDataObjects.chatControls,
    
  ): Promise<allDataObjects.whatappUpdateMessageObjType> {
      const updatedChatHistoryObj: allDataObjects.whatappUpdateMessageObjType = {
        messageObj: chatHistory,
        candidateProfile: candidateNode,
        candidateFirstName: personNode.name?.firstName,
        phoneNumberFrom: allDataObjects.recruiterProfile?.phone,
        phoneNumberTo: personNode.phone,
        lastEngagementChatControl: chatControl.chatControlType,
        messages: chatHistory.slice(-1),
        messageType: 'botMessage',
        whatsappDeliveryStatus: 'created',
        whatsappMessageId: wamId,
        whatsappMessageType: ''
      };
      return updatedChatHistoryObj;
  }
  async updateMostRecentMessagesBasedOnNewSystemPrompt(
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    newSystemPrompt: string
  ): Promise<allDataObjects.ChatHistoryItem[]> {
    mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
    return mostRecentMessageArr;
  }

    async fetchJobById(jobId: string, apiToken: string): Promise<allDataObjects.Jobs | null> {
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphqlToFetchActiveJob,
        variables:  { "filter": { "id": {"eq":jobId} } },
      });
  
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      return response?.data?.data?.jobs.edges[0].node || null;
    }

    getMostRecentMessageFromMessagesList(messagesList: allDataObjects.MessageNode[]) {
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = [];
      if (messagesList) {
        messagesList.sort((a, b) => new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime());
        mostRecentMessageArr = messagesList[0]?.messageObj;
      }
      return mostRecentMessageArr;
    }

  async getJobIdsFromCandidateIds(candidateIds: string[], apiToken: string): Promise<string[]> {
    console.log('Getting job ids from candidate ids:', candidateIds);
    return Promise.all(candidateIds.map(candidateId => this.fetchCandidateByCandidateId(candidateId, apiToken).then(candidate => candidate?.jobs?.id)));
  }

  async fetchScheduledClientMeetings(job_id:string, apiToken: string){
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindScheduledClientMeetings, variables: { filter: { jobId: { in: [job_id] } } } });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('This is the response from fetchScheduledClientMeetings:', response.data.data);
    return response.data.data;

  }

  async fetchCandidateByCandidateId(candidateId: string, apiToken: string): Promise<allDataObjects.CandidateNode> {
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToManyCandidateById, variables: { filter: { id: { eq: candidateId } } } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Fetched candidate by candidate ID:', response?.data);
      console.log('Number of candidates with candidate ID:', response?.data?.data?.candidates?.edges?.length);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      return candidateObj;
    } catch (error) {
      console.log('Error in fetching candidate by candidate ID:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }
  async fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds: string[], apiToken: string): Promise<allDataObjects.PersonNode[]> {
    let allPeople: allDataObjects.PersonNode[] = [];
    let lastCursor: string | null = null;
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    let graphqlQueryObjToFetchAllPeopleForChats = '';
    if (workspacesWithOlderSchema.includes(workspaceId)) {
      graphqlQueryObjToFetchAllPeopleForChats = allGraphQLQueries.graphqlQueryToFindManyPeopleEngagedCandidatesOlderSchema;
    }
    else{
      graphqlQueryObjToFetchAllPeopleForChats = allGraphQLQueries.graphqlQueryToFindManyPeopleEngagedCandidates;
    }

    while (true) {
      const graphqlQueryObj = JSON.stringify({ query: graphqlQueryObjToFetchAllPeopleForChats, variables: { filter: { id: { in: candidatePeopleIds } }, lastCursor } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const edges = response?.data?.data?.people?.edges;
      if (!edges || edges?.length === 0) break;
      allPeople = allPeople.concat(edges.map((edge: any) => edge?.node));
      lastCursor = edges[edges.length - 1].cursor;
    }
    console.log('Number of people fetched in fetchAllPeopleByCandidatePeopleIds:', allPeople?.length);
    return allPeople;
  }

  
  async fetchAllWhatsappMessages(candidateId: string, apiToken: string): Promise<allDataObjects.MessageNode[]> {
    let allWhatsappMessages: allDataObjects.MessageNode[] = [];
    let lastCursor = null;
    while (true) {
      try {
        const graphqlQueryObj = JSON.stringify({
          query: allGraphQLQueries.graphQlToFetchWhatsappMessages,
          variables: { limit: 30, lastCursor: lastCursor, filter: { candidateId: { in: [candidateId] } }, orderBy: [{ position: 'DescNullsFirst' }] },
        });
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        const whatsappMessages = response?.data?.data?.whatsappMessages;
        if (!whatsappMessages || whatsappMessages?.edges?.length === 0) {
          console.log('No more data to fetch.');
          break;
        }
        const newWhatsappMessages = whatsappMessages.edges.map(edge => edge.node);
        allWhatsappMessages = allWhatsappMessages.concat(newWhatsappMessages);
        lastCursor = whatsappMessages.edges[whatsappMessages.edges.length - 1].cursor;
        if (newWhatsappMessages.length < 30) {
          console.log('Reached the last page.');
          break;
        }
      } catch (error) {
        console.error('Error fetching whatsappmessages:', error);
        break;
      }
    }
    console.log('Number of whatsapp messages fetched for candidate Id::', candidateId," is ::",  allWhatsappMessages?.length);
    return allWhatsappMessages;
  }

  async getInterviewByJobId(jobId: string, apiToken: string) {
    try {
      console.log('jobId::', jobId);
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindInterviewsByJobId, variables: { filter: { jobId: { in: [jobId] } }, orderBy: [{ position: 'AscNullsFirst' }] } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('This is the response data:', response.data);
      console.log('This is the responsedata.data:', response.data.data);
      console.log('This is the videoInterviewTemplates:', response.data.data.videoInterviewTemplates);
      const interviewObj = response?.data?.data?.videoInterviewTemplates.edges[0].node;
      return interviewObj;
    } catch (error) {
      console.log('Error in fetching interviews:: ', error);
    }
  }


    async getCandidateDetailsByPhoneNumber(phoneNumber: string, apiToken: string): Promise<allDataObjects.CandidateNode> {
      const graphVariables = { filter: { phone: { ilike: '%' + phoneNumber + '%' } }, orderBy: { position: 'AscNullsFirst' } };
      try {
        const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyPeople, variables: graphVariables });
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        console.log('This is the response from getCandidate Information FROM PHONENUMBER in getPersonDetailsByPhoneNumber', response.data.data);
        const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
        return candidateDataObjs;
      } catch (error) {
        console.log('Getting an error and returning empty candidate profile objeect:', error);
        return allDataObjects.emptyCandidateProfileObj;
      }
    }
  
  
  async getPersonDetailsByPhoneNumber(phoneNumber: string, apiToken: string) {
    console.log('Trying to get person details by phone number:', phoneNumber);

    if (!phoneNumber || phoneNumber === '') {
      console.log('Phone number is empty and no candidate found');
      return allDataObjects.emptyCandidateProfileObj;
    }
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumber + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyPeople, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const personObj = response.data?.data?.people?.edges[0]?.node;
      if (personObj) {
        console.log('Personobj:', personObj?.name?.firstName || '' + ' ' + personObj?.name?.lastName) + '';
        return personObj;
      } else {
        console.log('Person not found');
        return allDataObjects.emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty candidate person profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }

async getCandidateInformation(userMessage: allDataObjects.chatMessageType, apiToken: string) {
    console.log('This is the phoneNumberFrom', userMessage.phoneNumberFrom);
    let phoneNumberToSearch: string;
    if (userMessage.messageType === 'messageFromSelf') {
      phoneNumberToSearch = userMessage.phoneNumberTo.replace('+', '');
    } else {
      phoneNumberToSearch = userMessage.phoneNumberFrom.replace('+', '');
    }

    // Ignore if phoneNumberToSearch is not a valid number
    if (isNaN(Number(phoneNumberToSearch))) {
      console.log('Phone number is not valid, ignoring:', phoneNumberToSearch);
      return allDataObjects.emptyCandidateProfileObj;
    }

    console.log('Phone number to search is :', phoneNumberToSearch);
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumberToSearch + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      console.log('going to get candidate information');
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyPeople, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      const maxCreatedAt = candidateDataObjs.length > 0 ? Math.max(...candidateDataObjs.map(e => new Date(e.node.jobs.createdAt).getTime())) : 0;
      const activeJobCandidateObj = candidateDataObjs?.find((edge: allDataObjects.CandidatesEdge) => edge?.node?.jobs?.isActive && edge?.node?.jobs?.createdAt && new Date(edge?.node?.jobs?.createdAt).getTime() === maxCreatedAt);
      console.log('This is the number of candidates', candidateDataObjs?.length);
      // console.log('This is the number of most recent active candidate for whom we can do active job', candidateDataObjs);
      console.log('This is the activeJobCandidateObj who got called', activeJobCandidateObj?.node?.name || '');
      if (activeJobCandidateObj) {
        const personWithActiveJob = response?.data?.data?.people?.edges?.find((person: allDataObjects.PersonEdge) => person?.node?.candidates?.edges?.some(candidate => candidate?.node?.jobs?.isActive));
        const activeJobCandidate: allDataObjects.CandidateNode = activeJobCandidateObj?.node;
        const activeJob: allDataObjects.Jobs = activeJobCandidate?.jobs;
        const activeCompany = activeJob?.company;
        const candidateProfileObj: allDataObjects.CandidateNode = {
          name: personWithActiveJob?.node?.name?.firstName || '',
          id: activeJobCandidate?.id,
          whatsappProvider: activeJobCandidate?.whatsappProvider,
          jobs: {
            name: activeJob?.name || '',
            id: activeJob?.id,
            recruiterId: activeJob?.recruiterId,
            jobCode: activeJob?.jobCode,
            isActive: activeJob?.isActive,
            company: {
              name: activeCompany?.name || '',
              companyId: activeCompany?.companyId,
              domainName: activeCompany?.domainName,
              descriptionOneliner: activeCompany?.descriptionOneliner,
            },
            jobLocation: activeJob?.jobLocation,
            whatsappMessages: activeJob?.whatsappMessages,
          },
          videoInterview: activeJobCandidate?.videoInterview,
          engagementStatus: activeJobCandidate?.engagementStatus,
          lastEngagementChatControl: activeJobCandidate?.lastEngagementChatControl,
          phoneNumber: personWithActiveJob?.node?.phone,
          email: personWithActiveJob?.node?.email,
          input: userMessage?.messages[0]?.content,
          startChat: activeJobCandidate?.startChat,
          startMeetingSchedulingChat: activeJobCandidate?.startMeetingSchedulingChat,
          startVideoInterviewChat: activeJobCandidate?.startVideoInterviewChat,
          stopChat: activeJobCandidate?.stopChat,
          whatsappMessages: activeJobCandidate?.whatsappMessages,
          status: activeJobCandidate?.status,
          emailMessages: { edges: activeJobCandidate?.emailMessages?.edges },
          candidateReminders: {
            edges: activeJobCandidate?.candidateReminders?.edges,
          },
          updatedAt: activeJobCandidate.updatedAt
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

  async fetchQuestionsByJobId(jobId: string, apiToken: string): Promise<{ questionIdArray: { questionId: string; question: string }[]; questionArray: string[] }> {
    console.log('Going to fetch questions for job id:', jobId);
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
    console.log('This is the questions array:', questionsArray);
    return { questionArray: questionsArray, questionIdArray: questionIdArray };
  }

  async getPersonDetailsByCandidateId(candidateId: string, apiToken: string) {
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
      console.log('candidate objk1:', candidateObj);

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

      if (person) {
        console.log('Personobj:', person?.name?.firstName || '' + ' ' + person?.name?.lastName) + '';
        return person;
      } else {
        console.log('Person not found');
        return allDataObjects.emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty candidate person profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }



  async getPersonDetailsByPersonId(personID: string, apiToken: string): Promise<allDataObjects.PersonNode> {
    const graphVariables = { filter: { id: { eq: personID } }, orderBy: { position: 'AscNullsFirst' } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyPeople, variables: graphVariables });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('This is the response from getCandidate Information FROM personID in getPersoneDetailsByPhoneNumber', response.data.data);
    const personDataObjs = response.data?.data.people.edges[0]?.node;
    console.log('personDataobjs:', personDataObjs);
    return personDataObjs;
  }

}