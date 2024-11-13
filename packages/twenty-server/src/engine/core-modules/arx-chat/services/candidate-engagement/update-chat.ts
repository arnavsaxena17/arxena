import * as allDataObjects from '../../services/data-model-objects';
import * as allGraphQLQueries from '../../services/candidate-engagement/graphql-queries-chatbot';
import { v4 } from 'uuid';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import axios from 'axios';
import { last } from 'rxjs';
import { MicroserviceHealthIndicator } from '@nestjs/terminus';
export class FetchAndUpdateCandidatesChatsWhatsapps {
  async fetchSpecificPeopleToEngageBasedOnChatControl(chatControl: allDataObjects.chatControls): Promise<allDataObjects.PersonNode[]> {
    try {
      console.log('Fetching candidates to engage');
      const candidates = await this.fetchAllCandidatesWithSpecificChatControl(chatControl);
      console.log("Fetched", candidates?.length, " candidates with chatControl", chatControl);
      const candidatePeopleIds = candidates?.filter(c => c?.people?.id).map(c => c?.people?.id);
      console.log("Got a total of ", candidatePeopleIds?.length, "candidate ids", "for chatControl", chatControl);
      const people = await this.fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds);
      console.log("Fetched", people?.length ,"people in fetch all People", "with chatControl", chatControl);
      return people;
    } catch (error) {
      console.log("This is the error in fetchPeopleToEngageByCheckingOnlyStartChat", error);
      console.error('An error occurred:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }
  async fetchAllCandidatesWithSpecificChatControl(chatControl:allDataObjects.chatControls): Promise<allDataObjects.Candidate[]> {
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
      const response = await axiosRequest(graphqlQueryObj);
      if (response.data.errors) {
        console.log("Errors in response:", response.data.errors);
      }
      const edges = response?.data?.data?.candidates?.edges || [];
      if (!edges || edges?.length === 0) break;
      allCandidates = allCandidates?.concat(edges.map((edge: any) => edge.node));
      lastCursor = edges[edges.length - 1].cursor;
    }
    console.log("Number of candidates from fetchedcandidates:", allCandidates?.length, "for chatControl", chatControl)
    return allCandidates;
  }
  async fetchCandidateByCandidateId(candidateId: string): Promise<allDataObjects.CandidateNode> {
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindOneCandidateById, variables: { filter: { id: { eq: candidateId } } } });
      const response = await axiosRequest(graphqlQueryObj);
      console.log("Fetched candidate by candidate ID:", response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;
      return candidateObj;
    } catch (error) {
      console.log('Error in fetching candidate by candidate ID:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }
  async fetchAllPeopleByCandidatePeopleIds(candidatePeopleIds: string[]): Promise<allDataObjects.PersonNode[]> {
    let allPeople: allDataObjects.PersonNode[] = [];
    let lastCursor: string | null = null;
    while (true) {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyPeopleEngagedCandidates, variables: {filter: {id: {in: candidatePeopleIds}}, lastCursor}});
      const response = await axiosRequest(graphqlQueryObj);
      const edges = response?.data?.data?.people?.edges;
      if (!edges || edges?.length === 0) break;
      allPeople = allPeople.concat(edges.map((edge: any) => edge?.node));
      lastCursor = edges[edges.length - 1].cursor;
    }
    console.log("Number of people fetched in fetchAllPeopleByCandidatePeopleIds:", allPeople?.length);
    return allPeople;
  }
  
  async fetchAllWhatsappMessages(candidateId: string): Promise<allDataObjects.MessageNode[]> {
    // console.log("Fetching all whatsapp messages for candidate ID:", candidateId);
    let allWhatsappMessages: allDataObjects.MessageNode[] = [];
    let lastCursor = null;
    while (true) {
      try {
        const graphqlQueryObj = JSON.stringify({
          query: allGraphQLQueries.graphQlToFetchWhatsappMessages,
          variables: { "limit": 30, "lastCursor": lastCursor, "filter": { "candidateId": { "in": [candidateId] } }, "orderBy": [{ "position": "DescNullsFirst" }] } });
        const response = await axiosRequest(graphqlQueryObj);
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
    return allWhatsappMessages;
  }

  async getInterviewByJobId(jobId: string){
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindInterviewsByJobId, variables: { "filter": { "jobId": { "in": [ jobId ] } }, "orderBy": [ { "position": "AscNullsFirst" } ] } });
      const response = await axiosRequest(graphqlQueryObj);
      const interviewObj = response?.data?.data?.aIInterviews.edges[0].node;
      return interviewObj;
    } catch (error) {
      console.log('Error in fetching interviews:', error);
    }
  }
  async createVideoInterviewForCandidate(candidateId : string){
    try {
      const candidateObj:allDataObjects.CandidateNode = await this.fetchCandidateByCandidateId(candidateId);
      const jobId = candidateObj?.jobs?.id;
      const interviewObj = await this.getInterviewByJobId(jobId);
      const interviewStatusId = v4();
      const graphqlQueryObj = JSON.stringify({
        query: allGraphQLQueries.graphqlQueryToCreateVideoInterview,
        variables: {
        input: {
          id: interviewStatusId,
          candidateId: candidateObj?.id,
          name: "Interview - "+ candidateObj.name + " for "+ candidateObj?.jobs?.name,
          aIInterviewId: interviewObj?.id,
          interviewStarted:false,
          interviewCompleted:false,
          interviewLink:{
            url:"/video-interview/"+interviewStatusId,
            label: "/video-interview/"+interviewStatusId,
          },
          cameraOn:false,
          micOn:false,
          position: "first"
        }
        }
      });
    
      const response = await axiosRequest(graphqlQueryObj);
      if (response.data.errors) {
        console.log("Errors in response:", response.data.errors);
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
  
  
  async getPersonDetailsByPhoneNumber(phoneNumber: string) {
    console.log('Trying to get person details by phone number:', phoneNumber);
    if (!phoneNumber || phoneNumber === '') {
      console.log('Phone number is empty and no candidate found');
      return allDataObjects.emptyCandidateProfileObj;
    }
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumber + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj);
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

  async getCandidateInformation(userMessage: allDataObjects.chatMessageType) {
    console.log('This is the phoneNumberFrom', userMessage.phoneNumberFrom);
    let phoneNumberToSearch: string;
    if (userMessage.messageType === 'messageFromSelf') {
      phoneNumberToSearch = userMessage.phoneNumberTo.replace("+","");
    } else {
      phoneNumberToSearch = userMessage.phoneNumberFrom.replace("+","");
    }
    console.log("Phone number to search is :", phoneNumberToSearch)
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumberToSearch + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      console.log('going to get candidate information');
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj);
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
            companies: {
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

  async fetchQuestionsByJobId(jobId: string): Promise<{ questionIdArray: { questionId: string; question: string }[]; questionArray: string[] }> {
    console.log("Going to fetch questions for job id:", jobId)
    const data = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindManyQuestionsByJobId, variables: { filter: { jobsId: { in: [`${jobId}`] } }, orderBy: { position: 'DescNullsFirst' } } });
    const response = await axios.request({
      method: 'post',
      url: process.env.GRAPHQL_URL,
      headers: { authorization: 'Bearer ' + process.env.TWENTY_JWT_SECRET, 'content-type': 'application/json' },
      data: data,
    });
    const questionsArray: string[] = response?.data?.data?.questions?.edges.map((val: { node: { name: string } }) => val.node.name);
    const questionIdArray = response?.data?.data?.questions?.edges?.map((val: { node: { id: string; name: string } }) => {
      return { questionId: val.node.id, question: val.node.name };
    });
    return { questionArray: questionsArray, questionIdArray: questionIdArray };
  }

  async createAndUpdateWhatsappMessage(candidateProfileObj: allDataObjects.CandidateNode, userMessage: allDataObjects.candidateChatMessageType) {
    console.log('This is the message being updated in the database ', userMessage?.messages[0]?.content);
    const createNewWhatsappMessageUpdateVariables = {
      input: {
        position: 'first',
        id: v4(),
        candidateId: candidateProfileObj?.id,
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
      const response = await axiosRequest(graphqlQueryObj);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementStatus(candidateProfileObj: allDataObjects.CandidateNode, whatappUpdateMessageObj: allDataObjects.candidateChatMessageType) {
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
      const response = await axiosRequest(graphqlQueryObj);
      console.log('Candidate engagement status updated successfully');
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }

  async setCandidateEngagementStatusToFalse(candidateProfileObj: allDataObjects.CandidateNode) {
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { engagementStatus: false } };
    console.log('This is the value of updatecandidateobject variables::0', updateCandidateObjectVariables);
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj);
      console.log('Response from axios update request:', response.data);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
  async updateCandidateAnswer(candidateProfileObj: allDataObjects.CandidateNode, AnswerMessageObj: allDataObjects.AnswerMessageObj) {
    const updateCandidateObjectVariables = { input: { ...AnswerMessageObj } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneAnswer, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
  async scheduleCandidateInterview(candidateProfileObj: allDataObjects.CandidateNode, scheduleInterviewObj: allDataObjects.candidateChatMessageType) {
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { scheduleInterviewObj: scheduleInterviewObj } };
    const graphqlQueryObj = JSON.stringify({ query: {}, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async removeChatsByPhoneNumber(phoneNumberFrom: string) {
    const personObj: allDataObjects.PersonNode = await this.getPersonDetailsByPhoneNumber(phoneNumberFrom);
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    const messagesList = personCandidateNode?.whatsappMessages?.edges;
    const messageIDs = messagesList?.map(message => message?.node?.id);
    this.removeChatsByMessageIDs(messageIDs);
  }

  async removeChatsByMessageIDs(messageIDs: string[]) {
    const graphQLVariables = { filter: { id: { in: messageIDs } } };
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToRemoveMessages,
      variables: graphQLVariables,
    });
    const response = await axiosRequest(graphqlQueryObj);
    console.log('REsponse status:', response.status);
    return response;
  }

  async getCandidateDetailsByPhoneNumber(phoneNumber: string): Promise<allDataObjects.CandidateNode> {
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumber + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj);
      console.log('This is the response from getCandidate Information FROM PHONENUMBER in getCandidateDetailsByPhoneNumber', response.data.data);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      return candidateDataObjs;
    } catch (error) {
      console.log('Getting an error and returning empty candidate profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }

  async updateCandidateProfileStatus(candidateProfileObj: allDataObjects.CandidateNode, updateCandidateMessageObj: allDataObjects.candidateChatMessageType) {
    const candidateStatus = updateCandidateMessageObj.messageType;
    console.log('Updating the candidate status::', candidateStatus);
    const candidateId = candidateProfileObj?.id;
    console.log('This is the candidateID for which we are trying to update the status:', candidateId);
    const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { status: candidateStatus } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateStatus, variables: updateCandidateObjectVariables });
    console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      console.log("REsponse from updating candidate status:", response.status)
      return 'Updated the candidate profile with the status.';
    } catch {
      console.log('Error in updating candidate profile status');
    }
  }

  async updateEngagementStatusBeforeRunningEngageCandidates(candidateId: string) {
    
    const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { engagementStatus: false } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    try {
      const response = await axiosRequest(graphqlQueryObj);
      console.log('Candidate engagement status updated successfully');
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }
}
