import {
  CandidateNode,
  CandidatesEdge,
  ChatControlsObjType,
  ChatHistoryItem,
  chatMessageType,
  emptyCandidateProfileObj,
  graphqlQueryToFindManyCandidateFields,
  graphqlQueryToFindManyPeople,
  graphqlQueryToFindManyPeopleEngagedCandidatesOlderSchema,
  graphqlQueryToFindScheduledClientMeetings,
  graphqlQueryToFindVideoInterviewTemplatesByJobId,
  graphqlToFetchAllCandidateData,
  graphQlToFetchWhatsappMessages,
  graphqlToFindManyJobs,
  Jobs,
  MessageNode,
  PersonEdge,
  PersonNode,
  whatappUpdateMessageObjType,
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';


import { workspacesWithOlderSchema } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { getRecruiterProfileByJob } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { axiosRequest } from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export class FilterCandidates {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async updateChatHistoryObjCreateWhatsappMessageObj(
    wamId: string,
    personNode: PersonNode,
    candidateNode: CandidateNode,
    chatHistory: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<whatappUpdateMessageObjType> {
    const candidateJob: Jobs = candidateNode?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );

    console.log("This is the candidate node in undate chat hisotry object create whatsapp message obj:", candidateNode)

    let phoneNumberTo:string = personNode.phones.primaryPhoneNumber.length == 10
    ? '91' + personNode.phones.primaryPhoneNumber
    : personNode.phones.primaryPhoneNumber;
    
    if (personNode?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob.id,
    )[0]?.node?.messagingChannel == 'linkedin') {
      phoneNumberTo = personNode?.linkedinLink?.primaryLinkUrl || '';
    }
    else{
      phoneNumberTo = personNode.phones.primaryPhoneNumber.length == 10
          ? '91' + personNode.phones.primaryPhoneNumber
          : personNode.phones.primaryPhoneNumber
    }

    let phoneNumberFrom:string = recruiterProfile.phoneNumber;
    if (personNode?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob.id,
    )[0]?.node?.messagingChannel == 'linkedin') {
      phoneNumberFrom = recruiterProfile.linkedinUrl || '';
    }
    else{
      phoneNumberFrom = recruiterProfile.phoneNumber
    }
  

    console.log("This is the person node messaging Channel:", personNode?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob.id,
    )[0]?.node.messagingChannel)
    console.log("This is the candiadte node messaging Channel:", candidateNode?.messagingChannel)
    console.log("This is the candiadte node whatsapp provider:", candidateNode?.whatsappProvider)
    const updatedChatHistoryObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      messageObj: chatHistory,
      candidateProfile: candidateNode,
      candidateFirstName: personNode.name?.firstName,
      phoneNumberFrom: phoneNumberFrom,
      phoneNumberTo: phoneNumberTo,
      lastEngagementChatControl: chatControl.chatControlType,
      messages: chatHistory.slice(-1),
      messageType: 'botMessage',
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: wamId,
      whatsappMessageType: '',
      typeOfMessage: personNode?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node.messagingChannel || 'whatsapp-web',
    };

    return updatedChatHistoryObj;
  }

  async updateMostRecentMessagesBasedOnNewSystemPrompt(
    mostRecentMessageArr: ChatHistoryItem[],
    newSystemPrompt: string,
  ): Promise<ChatHistoryItem[]> {
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
      messagesList.sort(
        (a, b) =>
          new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime(),
      );
      mostRecentMessageArr = messagesList[0]?.messageObj;
    }

    return mostRecentMessageArr.filter((message) => 'content' in message);
  }

  async getJobIdsFromCandidateIds(
    candidateIds: string[],
    apiToken: string,
  ): Promise<string[]> {
    console.log('Getting job ids from candidate ids:', candidateIds);

    return Promise.all(
      candidateIds.map((candidateId) =>
        this.fetchCandidateByCandidateId(candidateId, apiToken).then(
          (candidate) => candidate?.jobs?.id,
        ),
      ),
    );
  }

  async fetchScheduledClientMeetings(job_id: string, apiToken: string) {
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToFindScheduledClientMeetings,
      variables: { filter: { jobId: { in: [job_id] } } },
    });
    const response = await axiosRequest(graphqlQueryObj, apiToken);

    console.log(
      'This is the response from fetchScheduledClientMeetings:',
      response.data.data,
    );

    return response.data.data;
  }

  async fetchCandidateByCandidateId(
    candidateId: string,
    apiToken: string,
  ): Promise<CandidateNode> {
    try {
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { eq: candidateId } } },
      });
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('Fetched candidate by candidate ID:', response?.data);
      console.log(
        'Number of candidates with candidate ID:',
        response?.data?.data?.candidates?.edges?.length,
      );
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;

      return candidateObj;
    } catch (error) {
      console.log('Error in fetching candidate by candidate ID:', error);

      return emptyCandidateProfileObj;
    }
  }

  async fetchAllPeopleByCandidatePeopleIds(
    candidatePeopleIds: string[],
    apiToken: string,
  ): Promise<PersonNode[]> {
    let allPeople: PersonNode[] = [];
    let lastCursor: string | null = null;
    let hasMoreResults = true;
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    let graphqlQueryObjToFetchAllPeopleForChats = '';

    if (workspacesWithOlderSchema.includes(workspaceId)) {
      graphqlQueryObjToFetchAllPeopleForChats =
        graphqlQueryToFindManyPeopleEngagedCandidatesOlderSchema;
    } else {
      graphqlQueryObjToFetchAllPeopleForChats = graphqlQueryToFindManyPeople;
    }




    if (candidatePeopleIds.length > 0) {
      let hasNextPage = true;
      while (hasNextPage) {
        const graphqlQueryObj = JSON.stringify({
          query: graphqlQueryObjToFetchAllPeopleForChats,
          variables: { filter: { id: { in: candidatePeopleIds } }, limit: 400, lastCursor },
        });
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        const edges = response?.data?.data?.people?.edges;

        if (!edges || edges?.length === 0) {
          hasNextPage = false;
          break;
        }

        allPeople = allPeople.concat(edges.map((edge: any) => edge?.node));
        lastCursor = edges[edges.length - 1].cursor;
        hasNextPage = response?.data?.data?.people?.pageInfo?.hasNextPage || false;
      }
      console.log(
        'Number of people fetched in fetchAllPeopleByCandidatePeopleIds:',
        allPeople?.length,
      );
    }

    return allPeople;
  }

  async fetchAllWhatsappMessages(
    candidateId: string,
    apiToken: string,
  ): Promise<MessageNode[]> {
    let allWhatsappMessages: MessageNode[] = [];
    let lastCursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const graphqlQueryObj = JSON.stringify({
          query: graphQlToFetchWhatsappMessages,
          variables: {
            limit: 400,
            lastCursor: lastCursor,
            filter: { candidateId: { in: [candidateId] } },
            orderBy: [{ position: 'DescNullsFirst' }],
          },
        });
        const response = await axiosRequest(graphqlQueryObj, apiToken);
        const whatsappMessages = response?.data?.data?.whatsappMessages;

        if (!whatsappMessages || whatsappMessages?.edges?.length === 0) {
          console.log('No more data to fetch.');
          break;
        }
        const newWhatsappMessages = whatsappMessages.edges.map(
          (edge) => edge.node,
        );

        allWhatsappMessages = allWhatsappMessages.concat(newWhatsappMessages);
        lastCursor =
          whatsappMessages.edges[whatsappMessages.edges.length - 1].cursor;
        hasNextPage = newWhatsappMessages.length === 400;
      } catch (error) {
        hasNextPage = false;
        console.error('Error fetching whatsappmessages:', error);
      }
    }
    console.log(
      'Number of whatsapp messages fetched for candidate Id::',
      candidateId,
      ' is ::',
      allWhatsappMessages?.length,
    );

    return allWhatsappMessages;
  }

  async getInterviewByJobId(jobId: string, apiToken: string) {
    try {
      console.log('jobId::', jobId);
      const graphqlQueryObj = JSON.stringify({
        query: graphqlQueryToFindVideoInterviewTemplatesByJobId,
        variables: {
          filter: { jobId: { in: [jobId] } },
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('This is the response data:', response.data);
      console.log('This is the responsedata.data:', response.data.data);
      console.log(
        'This is the videoInterviewTemplates:',
        response.data.data.videoInterviewTemplates,
      );
      const interviewObj =
        response?.data?.data?.videoInterviewTemplates.edges[0].node;

      return interviewObj;
    } catch (error) {
      console.log('Error in fetching interviews:: ', error);
    }
  }
  async getPersonDetailsByPhoneNumber(phoneNumber: string, apiToken: string) {
    console.log('Trying to get person details by phone number:', phoneNumber);

    if (!phoneNumber || phoneNumber === '') {
      console.log('Phone number is empty and no candidate found');

      return emptyCandidateProfileObj;
    }
    if (phoneNumber.length > 10 && !phoneNumber.includes("linkedin")) {
      console.log( 'Phone number is more than 10 digits will slice:', phoneNumber );
      phoneNumber = phoneNumber.slice(-10);
    }
    console.log('Phone number to search is :', phoneNumber);

    let graphVariables: any;

    graphVariables = {
      filter: {
        phones: { primaryPhoneNumber: { ilike: '%' + phoneNumber + '%' } },
      },
      orderBy: { position: 'AscNullsFirst' },
    };


    if (phoneNumber.includes("linkedin")) {
      graphVariables = {
        linkedinLink: {
          primaryLinkUrl: { like: '%' + phoneNumber + '%' },
        },
      }
    }

    try {
      console.log('Going to get person details by phone number');

      const graphqlQueryObj = JSON.stringify({
        query: graphqlQueryToFindManyPeople,
        variables: graphVariables,
      });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const personObj = response.data?.data?.people?.edges[0]?.node;

      if (personObj) {
        console.log(
          'Personobj:',
          personObj?.name?.firstName || '' + ' ' + personObj?.name?.lastName,
        ) + '';

        return personObj;
      } else {
        console.log('Person not found in get person details by phone number');

        return emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log(
        'Getting an error and returning empty candidate person profile objeect:',
        error,
      );

      return emptyCandidateProfileObj;
    }
  }

  async getCandidateInformation(
    userMessage: chatMessageType,
    apiToken: string,
  ) {
    console.log('This is the phoneNumberFrom', userMessage?.phoneNumberFrom);
    let phoneNumberToSearch: string;

    if (userMessage.messageType === 'messageFromSelf') {
      phoneNumberToSearch = userMessage.phoneNumberTo.replace('+', '');
    } else {
      phoneNumberToSearch = userMessage.phoneNumberFrom.replace('+', '');
    }

    if (phoneNumberToSearch.length > 10 && !phoneNumberToSearch.includes("linkedin")) {
      console.log( 'Phone number is more than 10 digits will slice:', phoneNumberToSearch );
      phoneNumberToSearch = phoneNumberToSearch.slice(-10);
    }

    console.log('phoneNumberToSearch::', phoneNumberToSearch);
    // Ignore if phoneNumberToSearch is not a valid number
    // if (isNaN(Number(phoneNumberToSearch))) {
    //   console.log('Phone number is not valid, ignoring:', phoneNumberToSearch);
    //   return emptyCandidateProfileObj;
    // }

    console.log('Phone number to search is :', phoneNumberToSearch);
    
    let graphVariables : any;
    graphVariables = {
      filter: {
        phones: {
          primaryPhoneNumber: { ilike: '%' + phoneNumberToSearch + '%' },
        },
      },
      orderBy: { position: 'AscNullsFirst' },
    };

    if (phoneNumberToSearch.includes("linkedin")) {
      graphVariables = {
        filter:{
          linkedinLink: {
          primaryLinkUrl: { like: '%' + phoneNumberToSearch + '%' },
        }
        },
      }
    }
    
    console.log("graphVariables::", graphVariables);
    
    try {
      console.log('going to get candidate information');
      const graphqlQueryObj = JSON.stringify({
        query: graphqlQueryToFindManyPeople,
        variables: graphVariables,
      });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      console.log("Number of people fetched::", response.data?.data?.people?.edges.length)
      console.log(
        'Number of candidates fetched::',
        response.data?.data?.people?.edges[0]?.node?.candidates?.edges.length,
        'for phone number:',
        phoneNumberToSearch,
      );
      // const candidateDataObjs = response.data?.data?.people?.edges[0]?.node?.candidates?.edges || [];
      const candidateDataObjs = response.data?.data?.people?.edges?.flatMap(person => person?.node?.candidates?.edges || []) || [];
      // console.log('candidateDataObjs::', candidateDataObjs);
      console.log('Number of candidates in candidateDataObjs::', candidateDataObjs.length);
      const maxUpdatedAt =
        candidateDataObjs?.length > 0
          ? Math.max(
              ...candidateDataObjs.map((e) =>
                e?.node?.updatedAt
                  ? new Date(e?.node?.updatedAt).getTime()
                  : 0,
              ),
            )
          : 0;
      
      console.log('maxUpdatedAt::', maxUpdatedAt ? new Date(maxUpdatedAt).toLocaleString() : 'No date');
      console.log('Candidate updatedAt timestamps:');
      candidateDataObjs.forEach((candidateEdge, index) => {
        console.log(
          `Candidate ${index + 1} updatedAt:`,
          candidateEdge?.node?.updatedAt
            ? new Date(candidateEdge.node.updatedAt).toLocaleString()
            : 'No updatedAt date',
        );
      });

      const activeJobCandidateObj = candidateDataObjs?.find(
        (edge: CandidatesEdge) =>
          edge?.node?.jobs?.isActive &&
          edge?.node?.startChat &&
          edge?.node?.updatedAt &&
          new Date(edge?.node?.updatedAt).getTime() === maxUpdatedAt,
      );
      console.log( 'This is the number of candidates', candidateDataObjs?.length, );
      console.log( 'This is the activeJobCandidateObj who got called', activeJobCandidateObj?.node?.name || '', );
      if (activeJobCandidateObj) {
        const personWithActiveJob = response?.data?.data?.people?.edges?.find(
          (person: PersonEdge) =>
            person?.node?.candidates?.edges?.some(
              (candidate) => candidate?.node?.jobs?.isActive,
            ),
        );

        console.log('personWithActiveJob::', personWithActiveJob);
        const activeJobCandidate: CandidateNode = activeJobCandidateObj?.node;
        const activeJob: Jobs = activeJobCandidate?.jobs;
        const activeCompany = activeJob?.company;

        const candidateProfileObj: CandidateNode = {
          name: personWithActiveJob?.node?.name?.firstName || '',
          id: activeJobCandidate?.id,
          attachments: activeJobCandidate?.attachments,
          whatsappProvider: activeJobCandidate?.whatsappProvider,
          jobs: {
            name: activeJob?.name || '',
            id: activeJob?.id,
            recruiterId: activeJob?.recruiterId,
            jobCode: activeJob?.jobCode,
            isActive: activeJob?.isActive,
            company: {
              name: activeCompany?.name || '',
              id: activeCompany?.companyId || '',
              companyId: activeCompany?.companyId || '',
              domainName: activeCompany?.domainName,
              descriptionOneliner: activeCompany?.descriptionOneliner,
            },
            jobLocation: activeJob?.jobLocation,
            whatsappMessages: activeJob?.whatsappMessages,
          },
          createdAt: activeJobCandidate?.createdAt,
          videoInterview: activeJobCandidate?.videoInterview,
          engagementStatus: activeJobCandidate?.engagementStatus,
          lastEngagementChatControl: activeJobCandidate?.lastEngagementChatControl,
          phoneNumber: personWithActiveJob?.node?.phones.primaryPhoneNumber.length == 10
            ? '91' + personWithActiveJob?.node?.phones.primaryPhoneNumber
            : personWithActiveJob?.node?.phones.primaryPhoneNumber,
          email: personWithActiveJob?.node?.emails.primaryEmail,
          input: userMessage?.messages[0]?.content,
          startChat: activeJobCandidate?.startChat,
          startMeetingSchedulingChat: activeJobCandidate?.startMeetingSchedulingChat,
          startVideoInterviewChat: activeJobCandidate?.startVideoInterviewChat,
          stopChat: activeJobCandidate?.stopChat,
          candidateFieldValues: activeJobCandidate?.candidateFieldValues,
          whatsappMessages: activeJobCandidate?.whatsappMessages,
          status: activeJobCandidate?.status,
          emailMessages: { edges: activeJobCandidate?.emailMessages?.edges },
          candidateReminders: {
            edges: activeJobCandidate?.candidateReminders?.edges,
          },
          updatedAt: activeJobCandidate.updatedAt,
          people: personWithActiveJob?.node,
          chatCount: activeJobCandidate.chatCount
        };

        return candidateProfileObj;
        // return activeJobCandidate;
      } else {
        console.log('No active candidate found.');

        return emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log(
        'Getting an error and returning empty get Candidate Information candidate profile objeect:',
        error,
      );

      return emptyCandidateProfileObj;
    }
  }

  async fetchQuestionsByJobId(
    jobId: string,
    apiToken: string,
  ): Promise<{
    questionIdArray: { questionId: string; question: string }[];
    questionArray: string[];
  }> {
    console.log('Going to fetch questions for job id:', jobId);
    const data = JSON.stringify({
      query: graphqlQueryToFindManyCandidateFields,
      variables: {
        filter: { jobsId: { in: [`${jobId}`] } },
        orderBy: { position: 'DescNullsFirst' },
      },
    });
    const response = await axiosRequest(data, apiToken);
    const questionsArray: string[] = response?.data?.data?.candidateFields?.edges.map(
      (val: { node: { name: string } }) => val.node.name,
    );
    const questionIdArray = response?.data?.data?.candidateFields?.edges?.map(
      (val: { node: { id: string; name: string } }) => {
        return { questionId: val.node.id, question: val.node.name };
      },
    );

    console.log('This is the questions array:', questionsArray);
    return { questionArray: questionsArray, questionIdArray: questionIdArray };
  }

  async getPersonDetailsByCandidateId(candidateId: string, apiToken: string) {
    console.log('Trying to get person details by candidateId:', candidateId);
    if (!candidateId || candidateId === '') {
      console.log('Phone number is empty and no candidate found');

      return emptyCandidateProfileObj;
    }
    const graphVariables = {
      filter: { id: { eq: candidateId } },
      orderBy: { position: 'AscNullsFirst' },
    };

    try {
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: graphVariables,
      });
      const candidateObjresponse = await axiosRequest(
        graphqlQueryObj,
        apiToken,
      );
      const candidateObj = candidateObjresponse?.data?.data;

      console.log('candidate objk1:', candidateObj);

      const candidateNode =
        candidateObjresponse?.data?.data?.candidates?.edges.filter(
          (edge) => edge.node.id === candidateId,
        )[0]?.node;

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
        console.log(
          'Personobj:',
          person?.name?.firstName || '' + ' ' + person?.name?.lastName,
        ) + '';

        return person;
      } else {
        console.log('Person not found');

        return emptyCandidateProfileObj;
      }
    } catch (error) {
      console.log(
        'Getting an error and returning empty candidate person profile objeect:',
        error,
      );

      return emptyCandidateProfileObj;
    }
  }

  async getPersonDetailsByPersonId(
    personId: string,
    apiToken: string,
  ): Promise<PersonNode> {
    const graphVariables = {
      filter: { id: { eq: personId } },
      orderBy: { position: 'AscNullsFirst' },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToFindManyPeople,
      variables: graphVariables,
    });
    const response = await axiosRequest(graphqlQueryObj, apiToken);

    console.log(
      'This is the response from getCandidate Information FROM personID in getPersoneDetailsByPhoneNumber',
      response.data.data,
    );
    const personDataObjs = response.data?.data.people.edges[0]?.node;

    console.log('personDataobjs:', personDataObjs);

    return personDataObjs;
  }
}
