import * as allDataObjects from '../../services/data-model-objects';
import * as allGraphQLQueries from '../../services/candidate-engagement/graphql-queries-chatbot';
import { v4 } from 'uuid';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
import axios from 'axios';
export class FetchAndUpdateCandidatesChatsWhatsapps {
  async fetchPeopleToEngageByCheckingOnlyStartChat(){
    try {
      console.log('Fetching candidates to engage');
      const candidates = await this.fetchAllCandidatesWithStartChatTrue();
      console.log(`Fetched ${candidates?.length} candidates`); 
      const candidateIds = candidates?.map(c => c.people.id);
      console.log("CandidateIds:", candidateIds);
      const people = await this.fetchAllPeople(candidateIds);
      console.log(`Fetched ${people?.length} people`);
      console.log(people);
      return people
    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

  async fetchAllCandidatesWithStartChatTrue(): Promise<allDataObjects.Candidate[]> {
    let allCandidates: allDataObjects.Candidate[] = [];
    let lastCursor: string | null = null;
    while (true) {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlToFetchAllCandidatesByStartChat, variables: {lastCursor, limit: 30, filter: {startChat: {eq: true},stopChat: { eq: false }}}});
      const response = await axiosRequest(graphqlQueryObj);
      const edges = response?.data?.data?.candidates?.edges;
      console.log("Number of candidate edges:", edges?.length)
      if (!edges || edges?.length === 0) break;
      allCandidates = allCandidates.concat(edges.map((edge: any) => edge.node));
      lastCursor = edges[edges.length - 1].cursor;
    }
    return allCandidates;
  }
  async fetchAllPeople(candidateIds: string[]): Promise<allDataObjects.PersonNode[]> {
    let allPeople: allDataObjects.PersonNode[] = [];
    let lastCursor: string | null = null;
    while (true) {
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindEngagedCandidates, variables: {filter: {id: {in: candidateIds}}, lastCursor}});
      const response = await axiosRequest(graphqlQueryObj);
      const edges = response?.data?.data?.people?.edges;
      if (!edges || edges?.length === 0) break;
      allPeople = allPeople.concat(edges.map((edge: any) => edge.node));
      lastCursor = edges[edges.length - 1].cursor;
    }
    return allPeople;
  }
  async fetchCandidatesToEngage(limit: number) {
    console.log("Limit:", limit)
    let allCandidates = new Map();
    let lastCursor = null;
    let hasNextPage = true;
    let numberLoops = 0;
    while (allCandidates.size < limit && hasNextPage) {
      numberLoops++;
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindEngagedCandidates, variables: {limit: 60, lastCursor: lastCursor, orderBy: { position: "DescNullsFirst" }, } });
      // console.log("GrahqlQueryObj:", graphqlQueryObj)
      try {
        const response = await axiosRequest(graphqlQueryObj);
        // console.log("Pringint :", response.data.data)
        const data = response.data.data.people;
        console.log("fetchCandidatesToEngage Data edges length:", data.edges.length)
        data.edges.forEach(edge => {
          const candidate = edge.node;
          if (!allCandidates.has(candidate.id)) {
            allCandidates.set(candidate.id, candidate);
          }
        });
        // console.log("In this case the size of allCandidates is:", data.edges.length);
        lastCursor = data.edges[data.edges.length - 1]?.cursor;
        hasNextPage = data.edges.length === 30;
      } catch (error) {
        console.log("There is an erorr in fetchCandidatesToEngage::", error, "data::");
      }
    }
    console.log("Number of loops:", numberLoops);
    console.log("Number of candidates:", allCandidates.size);
    return Array.from(allCandidates.values()).slice(0, limit);  // Ensure we only return the requested number of results
  }

  async getPersonDetailsByPhoneNumber(phoneNumber: string) {
    console.log('Trying to get person details by phone number:', phoneNumber);
    const graphVariables = { filter: { phone: { ilike: '%' + phoneNumber + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      // console.log('going to get candidate information');
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj);
      console.log('This is the response from getCandidate Information FROM PHONENUMBER', response.data.data);
      const personObj = response.data?.data?.people?.edges[0].node;
      console.log('Personobj:', personObj);
      return personObj;
    } catch (error) {
      console.log('Getting an error and returning empty candidate profile objeect:', error);
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
      console.log('This is the response from getCandidate Information', response.data.data);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      console.log('This is the candidate data::', candidateDataObjs);
      const activeJobCandidateObj = candidateDataObjs?.find((edge: any) => edge?.node?.jobs?.isActive);
      console.log('This is the number of candidates', candidateDataObjs?.length);
      console.log('This is the activeJobCandidateObj', activeJobCandidateObj);
      if (activeJobCandidateObj) {
        const personWithActiveJob = response?.data?.data?.people?.edges?.find((person: { node: { candidates: { edges: any[] } } }) => person?.node?.candidates?.edges?.some(candidate => candidate?.node?.jobs?.isActive));
        const candidateProfileObj: allDataObjects.CandidateNode = {
          name: personWithActiveJob?.node?.name?.firstName,
          id: activeJobCandidateObj?.node?.id,
          jobs: {
            name: activeJobCandidateObj?.node?.jobs?.name,
            id: activeJobCandidateObj?.node?.jobs?.id,
            recruiterId: activeJobCandidateObj?.node?.jobs?.recruiterId,
            companies: {
              name: activeJobCandidateObj?.node?.jobs?.companies?.name,
              companyId: activeJobCandidateObj?.node?.jobs?.companies?.id,
              domainName: activeJobCandidateObj?.node?.jobs?.companies?.domainName,
              descriptionOneliner: activeJobCandidateObj?.node?.jobs?.companies?.descriptionOneliner,
            },
            jobLocation: activeJobCandidateObj?.node?.jobs?.jobLocation,
            whatsappMessages: activeJobCandidateObj?.node?.jobs?.whatsappMessages,
          },
          engagementStatus: activeJobCandidateObj?.node?.engagementStatus,
          phoneNumber: personWithActiveJob?.node?.phone,
          email: personWithActiveJob?.node?.email,
          input: userMessage?.messages[0]?.content,
          startChat: activeJobCandidateObj?.node?.startChat,
          whatsappMessages: activeJobCandidateObj?.node?.whatsappMessages,

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
      console.log('Getting an error and returning empty candidate profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }

  async getCandidateInformationToSendMessageTo(userMessage: allDataObjects.chatMessageType) {
    // Get the candidate information from the user message
    // console.log("This is the userMessage Content", userMessage.messages[0].content);
    // console.log("This is the candidate userMessage", userMessage);
    console.log('This is the phoneNumberTo', userMessage.phoneNumberTo);
    // console.log("This is the phoneNumberTo", userMessage.phoneNumberTo);
    // console.log("This is the messageType", userMessage.messageType);
    const graphVariables = { filter: { phone: { ilike: '%' + userMessage.phoneNumberTo + '%' } }, orderBy: { position: 'AscNullsFirst' } };
    try {
      // console.log('going to get candidate information');
      // console.log("going to get process.env.TWENTY_JWT_SECRET",process.env.TWENTY_JWT_SECRET)
      // console.log("going to get process.env.GRAPHQL_URL", process.env.GRAPHQL_URL)
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj);
      // console.log('This is the response from getCandidate Information', response.data.data);
      const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges;
      // console.log('This is the candidate data::', candidateDataObjs);
      //   const activeJobCandidateObj = candidateDataObjs?.find(
      //     (edge: any) => edge?.node?.jobs?.isActive
      //   );
      console.log('This is the number of candidates', candidateDataObjs?.length);
      const personWithActiveJob = response?.data?.data?.people?.edges?.find((person: { node: { candidates: { edges: any[] } } }) => person?.node?.candidates?.edges?.some(candidate => candidate?.node?.jobs?.isActive));
      const candidateProfileObj: allDataObjects.CandidateNode = {
        name: personWithActiveJob?.node?.name?.firstName,
        id: candidateDataObjs?.node?.id,
        jobs: {
          name: candidateDataObjs?.node?.jobs?.name,
          id: candidateDataObjs?.node?.jobs?.id,
          recruiterId: candidateDataObjs?.node?.jobs?.recruiterId,
          companies: {
            name: candidateDataObjs?.node?.jobs?.companies?.name,
            companyId: candidateDataObjs?.node?.jobs?.companies?.id,
            domainName: candidateDataObjs?.node?.jobs?.companies?.domainName,
            descriptionOneliner: candidateDataObjs?.node?.jobs?.companies?.descriptionOneliner,
          },
          jobLocation: candidateDataObjs?.node?.jobs?.jobLocation,
          whatsappMessages: candidateDataObjs?.node?.jobs?.whatsappMessages,
        },
        engagementStatus: candidateDataObjs?.node?.engagementStatus,
        phoneNumber: personWithActiveJob?.node?.phone,
        email: personWithActiveJob?.node?.email,
        input: userMessage?.messages[0]?.content,
        startChat: candidateDataObjs?.node?.startChat,
        whatsappMessages: candidateDataObjs?.node?.whatsappMessages,
        // *! TO CHECK LATER
        emailMessages: {
          edges: candidateDataObjs?.node?.emailMessages?.edges,
        },
        candidateReminders: {
          edges: candidateDataObjs?.node?.candidateReminders?.edges,
        },
      };
      return candidateProfileObj;
    } catch (error) {
      console.log('Getting an error and returning empty candidate profile objeect:', error);
      return allDataObjects.emptyCandidateProfileObj;
    }
  }

  async fetchQuestionsByJobId(jobId: string): Promise<{ questionIdArray: { questionId: string; question: string }[]; questionArray: string[] }> {
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
    // console.log('This is the candidate profile object', JSON.stringify(candidateProfileObj));
    // console.log("This is the user message for updateWhtsappMessage in createAnd UpdateWhatsappMessage", userMessage);
    // console.log('This is the user messageObj for updateWhtsappMessage', userMessage?.messageObj);
    // console.log('This is the number of messages in  updateWhtsappMessage', userMessage?.messageObj.length);
    // console.log("This is the message being published ", userMessage?.messages[0]?.text);
    console.log('This is the message being updated in the database ', userMessage?.messages[0]?.content);
    // debugger
    // console.log("This is the user message phoneNumberTo", userMessage?.phoneNumberTo);
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
        messageObj: userMessage?.messageObj,
        whatsappDeliveryStatus: userMessage.whatsappDeliveryStatus,
        whatsappMessageId: userMessage?.whatsappMessageId,
        typeOfMessage: userMessage?.type,
        audioFilePath: userMessage?.databaseFilePath,
      },
    };
    // console.log('These are the graphvsariables:', JSON.stringify(createNewWhatsappMessageUpdateVariables));
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneNewWhatsappMessage, variables: createNewWhatsappMessageUpdateVariables });
    // console.log("This is the user message", userMessage);
    // console.log("These are graph config data", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      // console.log('This is the response from the axios request in createAndUpdateWhatsappMessage::', response.data);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementStatus(candidateProfileObj: allDataObjects.CandidateNode, whatappUpdateMessageObj: allDataObjects.candidateChatMessageType) {
    // debugger
    // console.log("Updating candidate's status", candidateProfileObj, whatappUpdateMessageObj);
    // debugger
    const candidateEngagementStatus = whatappUpdateMessageObj.messageType !== 'botMessage';
    console.log('GOING TO UPDATE CANDIDATE ENGAGEMENT STATUS BECAUES OF THIS WHATSAPP MESSAGE OBJ::', candidateEngagementStatus);
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { engagementStatus: candidateEngagementStatus } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    // console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      // console.log("Response from axios update request:", response.data);
      console.log('Candidate engagement status updated successfully');
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }
  async updateCandidateReminderStatus(reminderObj: allDataObjects.ReminderObject) {
    const candidateReminderStatus = false;
    const reminderObjectVariables = { idToUpdate: reminderObj?.id, input: { isReminderActive: candidateReminderStatus } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: reminderObjectVariables });
    // console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      // console.log("Response from axios update request:", response.data);
      console.log('Candidate reminder status updated successfully');
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
    // console.log("Updating candidate's status", candidateProfileObj, JSON.stringify(AnswerMessageObj));
    const updateCandidateObjectVariables = { input: { ...AnswerMessageObj } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneAnswer, variables: updateCandidateObjectVariables });
    // console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      // console.log("Response from axios update request:", response.data);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
  async scheduleCandidateInterview(candidateProfileObj: allDataObjects.CandidateNode, scheduleInterviewObj: allDataObjects.candidateChatMessageType) {
    // console.log("Updating candidate's status", candidateProfileObj, JSON.stringify(scheduleInterviewObj));
    const candidateEngagementStatus = scheduleInterviewObj.messageType !== 'botMessage';
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { scheduleInterviewObj: scheduleInterviewObj } };
    const graphqlQueryObj = JSON.stringify({ query: {}, variables: updateCandidateObjectVariables });
    // console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      // console.log("Response from axios update request:", response.data);
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async removeChatsByPhoneNumber(phoneNumberFrom: string) {
    const personObj: allDataObjects.PersonNode = await this.getPersonDetailsByPhoneNumber(phoneNumberFrom);
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    const messagesList = personCandidateNode?.whatsappMessages?.edges;
    // console.log('Current Messages list:', messagesList);
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
      // console.log('going to get candidate information');
      // console.log("going to get process.env.TWENTY_JWT_SECRET",process.env.TWENTY_JWT_SECRET)
      // console.log("going to get process.env.GRAPHQL_URL", process.env.GRAPHQL_URL)
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber, variables: graphVariables });
      const response = await axiosRequest(graphqlQueryObj);
      console.log('This is the response from getCandidate Information FROM PHONENUMBER', response.data.data);
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
    const updateCandidateObjectVariables = { idToUpdate: candidateProfileObj?.id, input: { status: candidateStatus } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateStatus, variables: updateCandidateObjectVariables });
    console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      return 'Updated the candidate profile with the status.';
    } catch {
      console.log('Error in updating candidate profile status');
    }
  }

  async updateEngagementStatusBeforeRunningEngageCandidates(candidateId: string) {
    const updateCandidateObjectVariables = { idToUpdate: candidateId, input: { engagementStatus: false } };
    const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateCandidateEngagementStatus, variables: updateCandidateObjectVariables });
    // console.log("GraphQL query to update candidate status:", graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj);
      // console.log("Response from axios update request:", response.data);
      console.log('Candidate engagement status updated successfully');
      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }
}
