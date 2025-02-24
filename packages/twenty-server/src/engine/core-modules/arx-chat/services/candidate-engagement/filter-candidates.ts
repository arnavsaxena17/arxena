import axios from 'axios';
import { workspacesWithOlderSchema } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { CandidateNode, CandidatesEdge, ChatControlsObjType, ChatHistoryItem, chatMessageType, emptyCandidateProfileObj, graphqlQueryToFindInterviewsByJobId, graphqlQueryToFindManyPeople, graphqlQueryToFindManyPeopleEngagedCandidatesOlderSchema, graphqlQueryToFindManyQuestionsByJobId, graphqlQueryToFindScheduledClientMeetings, graphqlToFetchAllCandidateData, graphQlToFetchWhatsappMessages, graphqlToFindManyJobs, Jobs, MessageNode, PersonEdge, PersonNode, whatappUpdateMessageObjType } from 'twenty-shared';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import { getRecruiterProfileByJob } from '../recruiter-profile';

export class FilterCandidates {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async updateChatHistoryObjCreateWhatsappMessageObj(
    wamId: string,
    personNode: PersonNode,
    candidateNode: CandidateNode,
    chatHistory: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken:string
  ): Promise<whatappUpdateMessageObjType> {


    const candidateJob:Jobs = candidateNode?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(candidateJob, apiToken) 



    const updatedChatHistoryObj: whatappUpdateMessageObjType = {
      messageObj: chatHistory,
      candidateProfile: candidateNode,
      candidateFirstName: personNode.name?.firstName,
      phoneNumberFrom: recruiterProfile?.phoneNumber,
      phoneNumberTo: personNode.phones.primaryPhoneNumber,
      lastEngagementChatControl: chatControl.chatControlType,
      messages: chatHistory.slice(-1),
      messageType: 'botMessage',
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: wamId,
      whatsappMessageType: '',
    };
    return updatedChatHistoryObj;
  }
  async updateMostRecentMessagesBasedOnNewSystemPrompt(mostRecentMessageArr: ChatHistoryItem[], newSystemPrompt: string): Promise<ChatHistoryItem[]> {
    mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
    return mostRecentMessageArr;
  }

  async fetchJobById(jobId: string, apiToken: string): Promise<Jobs | null> {
    const graphqlQueryObj = JSON.stringify({
      query: graphqlToFindManyJobs,
      variables: { filter: { id: { eq: jobId } } },
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
    return response?.data?.data?.jobs.edges[0].node || null;
  }

  getMostRecentMessageFromMessagesList(messagesList: MessageNode[]) {
    let mostRecentMessageArr: ChatHistoryItem[] = [];
    if (messagesList) {
      messagesList.sort((a, b) => new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime());
      mostRecentMessageArr = messagesList[0]?.messageObj;
    }
    return mostRecentMessageArr.filter(message => 'content' in message);
  }

  async getJobIdsFromCandidateIds(candidateIds: string[], apiToken: string): Promise<string[]> {
    console.log('Getting job ids from candidate ids:', candidateIds);
    return Promise.all(candidateIds.map(candidateId => this.fetchCandidateByCandidateId(candidateId, apiToken).then(candidate => candidate?.jobs?.id)));
  }

  // private async getJobIdsFromCandidateIds(candidateIds: string[], apiToken: string) {
  //   console.log("Fetching job IDs for candidate IDs:", candidateIds);
  //   const graphqlQuery = JSON.stringify({
  //     query: graphqlToFetchAllCandidateData,
  //     variables: { filter: { id: { in: candidateIds } } }
  //   });

  //   const response = await axiosRequest(graphqlQuery, apiToken);
  //   console.log("Number of candidates fetched:", response?.data?.data?.candidates?.edges.length);
  //   const jobIds = response?.data?.data?.candidates?.edges.map((edge: { node?: { jobs?: { id: string } } }) => edge?.node?.jobs?.id)
  //   return jobIds;
  // }

  async fetchScheduledClientMeetings(job_id: string, apiToken: string) {
    const graphqlQueryObj = JSON.stringify({ query: graphqlQueryToFindScheduledClientMeetings, variables: { filter: { jobId: { in: [job_id] } } } });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('This is the response from fetchScheduledClientMeetings:', response.data.data);
    return response.data.data;
  }

  async fetchCandidateByCandidateId(candidateId: string, apiToken: string): Promise<CandidateNode> {
    try {
      const graphqlQueryObj = JSON.stringify({ query: graphqlToFetchAllCandidateData, variables: { filter: { id: { eq: candidateId } } } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('Fetched candidate by candidate ID:', response?.data);
      console.log('Number of candidates with candidate ID:', response?.data?.data?.candidates?.edges?.length);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      return candidateObj;
    } catch (error) {
      console.log('Error in fetching candidate by candidate ID:', error);
      return emptyCandidateProfileObj;
    }
  }
  async fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds: string[], apiToken: string): Promise<PersonNode[]> {
    let allPeople: PersonNode[] = [];
    let lastCursor: string | null = null;
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    let graphqlQueryObjToFetchAllPeopleForChats = '';
    if (workspacesWithOlderSchema.includes(workspaceId)) {
      graphqlQueryObjToFetchAllPeopleForChats = graphqlQueryToFindManyPeopleEngagedCandidatesOlderSchema;
    } else {
      graphqlQueryObjToFetchAllPeopleForChats = graphqlQueryToFindManyPeople;
    }
    if (candidatePeopleIds.length > 0) {
      while (true) {
      const graphqlQueryObj = JSON.stringify({ query: graphqlQueryObjToFetchAllPeopleForChats, variables: { filter: { id: { in: candidatePeopleIds } }, lastCursor } });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const edges = response?.data?.data?.people?.edges;
      if (!edges || edges?.length === 0) break;
      allPeople = allPeople.concat(edges.map((edge: any) => edge?.node));
      lastCursor = edges[edges.length - 1].cursor;
      }
      console.log('Number of people fetched in fetchAllPeopleByCandidatePeopleIds:', allPeople?.length);
    }
    return allPeople;
  }

  async fetchAllWhatsappMessages(candidateId: string, apiToken: string): Promise<MessageNode[]> {
    let allWhatsappMessages: MessageNode[] = [];
    let lastCursor = null;
    while (true) {
      try {
        const graphqlQueryObj = JSON.stringify({
          query: graphQlToFetchWhatsappMessages,
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
    console.log('Number of whatsapp messages fetched for candidate Id::', candidateId, ' is ::', allWhatsappMessages?.length);
    return allWhatsappMessages;
  }

  async getInterviewByJobId(jobId: string, apiToken: string) {
    try {
      console.log('jobId::', jobId);
      const graphqlQueryObj = JSON.stringify({ query: graphqlQueryToFindInterviewsByJobId, variables: { filter: { jobId: { in: [jobId] } }, orderBy: [{ position: 'AscNullsFirst' }] } });
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

  async getCandidateDetailsByPhoneNumber(phoneNumber: string, apiToken: string): Promise<CandidateNode> {
    const graphVariables = { filter: { phones: { primaryPhoneNumber: { ilike: '%' + phoneNumber + '%' } } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: graphqlQueryToFindManyPeople, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log('This is the response from getCandidate Information FROM PHONENUMBER in getPersonDetailsByPhoneNumber', response.data.data);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      return candidateDataObjs;
    } catch (error) {
      console.log('Getting an error and returning empty candidate profile objeect:', error);
      return emptyCandidateProfileObj;
    }
  }

  async getPersonDetailsByPhoneNumber(phoneNumber: string, apiToken: string) {
    console.log('Trying to get person details by phone number:', phoneNumber);

    if (!phoneNumber || phoneNumber === '') {
      console.log('Phone number is empty and no candidate found');
      return emptyCandidateProfileObj;
    }
    const graphVariables = { filter: { phones: { primaryPhoneNumber: { ilike: '%' + phoneNumber + '%' } } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: graphqlQueryToFindManyPeople, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const personObj = response.data?.data?.people?.edges[0]?.node;
      if (personObj) {
        console.log('Personobj:', personObj?.name?.firstName || '' + ' ' + personObj?.name?.lastName) + '';
        return personObj;
      } else {
        console.log('Person not found');
        return emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty candidate person profile objeect:', error);
      return emptyCandidateProfileObj;
    }
  }

  async getCandidateInformation(userMessage: chatMessageType, apiToken: string) {
    console.log('This is the phoneNumberFrom', userMessage?.phoneNumberFrom);
    let phoneNumberToSearch: string;
    if (userMessage.messageType === 'messageFromSelf') {
      phoneNumberToSearch = userMessage.phoneNumberTo.replace('+', '');
    } else {
      phoneNumberToSearch = userMessage.phoneNumberFrom.replace('+', '');
    }

    // Ignore if phoneNumberToSearch is not a valid number
    if (isNaN(Number(phoneNumberToSearch))) {
      console.log('Phone number is not valid, ignoring:', phoneNumberToSearch);
      return emptyCandidateProfileObj;
    }

    console.log('Phone number to search is :', phoneNumberToSearch);
    const graphVariables = { filter: { phones: { primaryPhoneNumber: { ilike: '%' + phoneNumberToSearch + '%' } } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      console.log('going to get candidate information');
      const graphqlQueryObj = JSON.stringify({ query: graphqlQueryToFindManyPeople, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      const maxCreatedAt = candidateDataObjs.length > 0 ? Math.max(...candidateDataObjs.map(e => new Date(e.node.jobs.createdAt).getTime())) : 0;
      const activeJobCandidateObj = candidateDataObjs?.find((edge: CandidatesEdge) => edge?.node?.jobs?.isActive && edge?.node?.jobs?.createdAt && new Date(edge?.node?.jobs?.createdAt).getTime() === maxCreatedAt);
      console.log('This is the number of candidates', candidateDataObjs?.length);
      // console.log('This is the number of most recent active candidate for whom we can do active job', candidateDataObjs);
      console.log('This is the activeJobCandidateObj who got called', activeJobCandidateObj?.node?.name || '');
      if (activeJobCandidateObj) {
        const personWithActiveJob = response?.data?.data?.people?.edges?.find((person: PersonEdge) => person?.node?.candidates?.edges?.some(candidate => candidate?.node?.jobs?.isActive));
        const activeJobCandidate: CandidateNode = activeJobCandidateObj?.node;
        const activeJob: Jobs = activeJobCandidate?.jobs;
        const activeCompany = activeJob?.company;
        const candidateProfileObj: CandidateNode = {
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
          updatedAt: activeJobCandidate.updatedAt,
          person: personWithActiveJob?.node,
        };
        return candidateProfileObj;
      } else {
        console.log('No active candidate found.');
        return emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty get Candidate Information candidate profile objeect:', error);
      return emptyCandidateProfileObj;
    }
  }

  async fetchQuestionsByJobId(jobId: string, apiToken: string): Promise<{ questionIdArray: { questionId: string; question: string }[]; questionArray: string[] }> {
    console.log('Going to fetch questions for job id:', jobId);
    const data = JSON.stringify({ query: graphqlQueryToFindManyQuestionsByJobId, variables: { filter: { jobsId: { in: [`${jobId}`] } }, orderBy: { position: 'DescNullsFirst' } } });
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
      return emptyCandidateProfileObj;
    }
    const graphVariables = { filter: { id: { eq: candidateId } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: graphqlToFetchAllCandidateData, variables: graphVariables });
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
        return emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log('Getting an error and returning empty candidate person profile objeect:', error);
      return emptyCandidateProfileObj;
    }
  }

  async getPersonDetailsByPersonId(personID: string, apiToken: string): Promise<PersonNode> {
    const graphVariables = { filter: { id: { eq: personID } }, orderBy: { position: 'AscNullsFirst' } };
    const graphqlQueryObj = JSON.stringify({ query: graphqlQueryToFindManyPeople, variables: graphVariables });
    const response = await axiosRequest(graphqlQueryObj, apiToken);
    console.log('This is the response from getCandidate Information FROM personID in getPersoneDetailsByPhoneNumber', response.data.data);
    const personDataObjs = response.data?.data.people.edges[0]?.node;
    console.log('personDataobjs:', personDataObjs);
    return personDataObjs;
  }
}
