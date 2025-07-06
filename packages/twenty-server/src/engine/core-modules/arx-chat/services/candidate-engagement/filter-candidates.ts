import {
  CandidateFieldEdge,
  CandidateNode,
  CandidatesEdge,
  ChatControlsObjType,
  ChatHistoryItem,
  chatMessageType,
  ClientInterviewEdge,
  ClientInterviewNode,
  ClientMeetingEdge,
  emptyCandidateProfileObj,
  graphqlQueryToFindManyCandidateFields,
  graphqlQueryToFindManyPeople,
  graphqlQueryToFindScheduledClientMeetings,
  graphqlQueryToFindVideoInterviewTemplatesByJobId,
  graphqlToFetchAllCandidateData,
  graphQlToFetchWhatsappMessages,
  graphqlToFindManyJobs,
  Job,
  MessageNode,
  PageInfo,
  PersonEdge,
  PersonNode,
  whatappUpdateMessageObjType,
  WhatsAppMessagesEdge
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';


import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { RecruiterProfileService } from '../recruiter-profile';

export class FilterCandidates {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async updateChatHistoryObjCreateWhatsappMessageObj(
    wamId: string,
    candidate: CandidateNode,
    chatHistory: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<whatappUpdateMessageObjType> {
    const candidateJob: Job = candidate?.jobs as Job;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );

    console.log("This is the candidate node in undate chat hisotry object create whatsapp message obj:", candidate)

    let phoneNumberTo:string = candidate?.phoneNumber?.primaryPhoneNumber.length == 10
    ? '91' + candidate?.phoneNumber?.primaryPhoneNumber
    : candidate?.phoneNumber?.primaryPhoneNumber;
    
    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberTo = candidate?.linkedinUrl?.primaryLinkUrl || '';
    }
    else{
      phoneNumberTo = candidate?.phoneNumber?.primaryPhoneNumber.length == 10
          ? '91' + candidate?.phoneNumber?.primaryPhoneNumber
          : candidate?.phoneNumber?.primaryPhoneNumber
    }

    let phoneNumberFrom:string = recruiterProfile.phoneNumber;
    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberFrom = recruiterProfile.linkedinUrl || '';
    }
    else{
      phoneNumberFrom = recruiterProfile.phoneNumber
    }
  

    console.log("This is the person node messaging Channel:", candidate?.messagingChannel)
    console.log("This is the candiadte node messaging Channel:", candidate?.messagingChannel)
    console.log("This is the candiadte node whatsapp provider:", candidate?.whatsappProvider)
    console.log("This is the candiadte whatsappMessageId:", wamId)
    const updatedChatHistoryObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      messageObj: chatHistory,
      candidateProfile: candidate,
      candidateFirstName: candidate.name,
      phoneNumberFrom: phoneNumberFrom,
      phoneNumberTo: phoneNumberTo,
      lastEngagementChatControl: chatControl.chatControlType,
      messages: chatHistory.slice(-1),
      messageType: 'botMessage',
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: wamId,
      whatsappMessageType: '',
      typeOfMessage: candidate?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
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

  async fetchJobById(jobId: string, apiToken: string): Promise<Job | null> { 
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobs, { filter: { id: { eq: jobId } } }, apiToken);
    return response?.data?.data?.jobs as Job | null;
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
    const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindScheduledClientMeetings, { filter: { jobId: { in: [job_id] } } }, apiToken);

    console.log(
      'This is the response from fetchScheduledClientMeetings:',
      response.data.data,
    );

    return response?.data?.data?.clientMeetings as {
      edges: ClientMeetingEdge[];
      pageInfo: PageInfo;
    } | undefined;
  }

  async fetchCandidateByCandidateId(
    candidateId: string,
    apiToken: string,
  ): Promise<CandidateNode> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { id: { eq: candidateId } } }, apiToken);

      const candidates = response?.data?.data?.candidates as { 
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;  

      console.log('Fetched candidate by candidate ID:', response?.data);
      console.log(
        'Number of candidates with candidate ID:',
        candidates?.edges?.length,
      );
      const candidateObj = candidates?.edges[0]?.node;

      return candidateObj as CandidateNode;
    } catch (error) {
      console.log('Error in fetching candidate by candidate ID:', error);

      return emptyCandidateProfileObj;
    }
  }

  async fetchAllPeopleByPeopleIds(
    peopleIds: string[],
    apiToken: string,
  ): Promise<PersonNode[]> {
    let allPeople: PersonNode[] = [];
    let lastCursor: string | null = null;
    let hasMoreResults = true;
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    if (peopleIds.length > 0) {
      let hasNextPage = true;
      while (hasNextPage) {
        const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, { filter: { id: { in: peopleIds } }, limit: 400, lastCursor }, apiToken);
        const people = response?.data?.data?.people as { 
          edges: PersonEdge[];
          pageInfo: PageInfo;
        } | undefined;
        const edges = people?.edges;

        if (!edges || edges?.length === 0) {
          hasNextPage = false;
          break;
        }

        allPeople = allPeople.concat(edges.map((edge: any) => edge?.node));
        lastCursor = people?.pageInfo?.endCursor;
        // lastCursor = edges[edges.length - 1].lastCursor;
        hasNextPage = people?.pageInfo?.hasNextPage || false;
        console.log("lastCursor::", lastCursor, "number of people fetched::", allPeople.length);
      }
      console.log(
        'Number of people fetched in fetchAllPeopleBy CandidatePeopleIds:',
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
    let lastCursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        const response = await this.staticGraphQLService.executeGraphQL(graphQlToFetchWhatsappMessages, {
          limit: 400,
          lastCursor: lastCursor,
          filter: { candidateId: { in: [candidateId] } },
          orderBy: [{ position: 'DescNullsFirst' }],
        }, apiToken);
        
        const whatsappMessages = response?.data?.data?.whatsappMessages as { 
          edges: WhatsAppMessagesEdge[];
          pageInfo: PageInfo;
        } | undefined;

        if (!whatsappMessages || whatsappMessages.edges.length === 0) {
          console.log('No more data to fetch.');
          break;
        }

        const newWhatsappMessages = whatsappMessages.edges.map(
          (edge) => edge.node
        );

        allWhatsappMessages = allWhatsappMessages.concat(newWhatsappMessages);
        lastCursor = whatsappMessages.pageInfo.endCursor;
        hasNextPage = whatsappMessages.pageInfo.hasNextPage;
        
        console.log(
          "lastCursor::",
          lastCursor,
          "number of whatsapp messages fetched::",
          allWhatsappMessages.length
        );

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
      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindVideoInterviewTemplatesByJobId, {
        filter: { jobId: { in: [jobId] } },
        orderBy: [{ position: 'AscNullsFirst' }],
      }, apiToken);

      console.log('This is the response data:', response.data);
      console.log('This is the responsedata.data:', response.data.data);
      console.log(
        'This is the videoInterviewTemplates:',
        response?.data?.data?.videoInterviewTemplates as { 
          edges: ClientInterviewEdge[];
          pageInfo: PageInfo;
        } | undefined,
      );
      const videoInterviewTemplates = response?.data?.data?.videoInterviewTemplates as { 
        edges: ClientInterviewEdge[];
        pageInfo: PageInfo;
      } | undefined;
      const interviewObj =
        videoInterviewTemplates?.edges[0]?.node as ClientInterviewNode | undefined;

      return interviewObj;
    } catch (error) {
      console.log('Error in fetching interviews:: ', error);
    }
  }




  async getCandidateDetailsById(candidateId: string, apiToken: string) {
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { id: { eq: candidateId } } }, apiToken);
    const candidateNode = response?.data?.data?.candidates?.edges[0]?.node as CandidateNode;
    return candidateNode;
  }

  async getPersonDetailsByPhoneNumber(phoneNumber: string, apiToken: string) {
    console.log('Trying to get person details by phone number:', phoneNumber);

    if (!phoneNumber || phoneNumber === '') {
      console.log('Phone number is empty and no candidate found');
      return ;
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

      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, graphVariables, apiToken);
      const people = response?.data?.data?.people as { 
        edges: PersonEdge[];
        pageInfo: PageInfo;
      } | undefined;
      const personObj = people?.edges[0]?.node;

      if (personObj) {
        console.log(
          'Personobj:',
          personObj?.name?.firstName || '' + ' ' + personObj?.name?.lastName,
        ) + '';

        return personObj;
      } else {
        console.log('Person not found in get person details by phone number');
        return ;
      }
    } catch (error) {
      console.log(
        'Getting an error and returning empty candidate person profile objeect:',
        error,
      );

      return ;
    }
  }

  async getCandidateDetailsByPhoneNumber(phoneNumber: string, apiToken: string) {
    console.log('Trying to get candidate details by phone number:', phoneNumber);

    if (!phoneNumber || phoneNumber === '') {
      console.log('Phone number is empty and no candidate found');
      return ;
    }
    if (phoneNumber.length > 10 && !phoneNumber.includes("linkedin")) {
      console.log( 'Phone number is more than 10 digits will slice:', phoneNumber );
      phoneNumber = phoneNumber.slice(-10);
    }
    console.log('Phone number to search is :', phoneNumber);

    let graphVariables: any;

    graphVariables = {
      filter: {
        phoneNumber: { primaryPhoneNumber: { ilike: '%' + phoneNumber + '%' } },
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
      console.log('Going to get candidate details by phone number');

      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, graphVariables, apiToken);
      const candidates = response?.data?.data?.candidates as { 
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;

      if (candidates) {
        // console.log(
        //   'Candidateobj:',
        //   candidateObj?.name,
        // ) + '';

        return candidates;
      } else {
        console.log('Person not found in get person details by phone number');
        return ;
      }
    } catch (error) {
      console.log(
        'Getting an error and returning empty candidate person profile objeect:',
        error,
      );

    }
  }


  async getCandidateInformation(
    userMessage: chatMessageType,
    apiToken: string,
  ) {
    console.log('This is the phoneNumberFrom', userMessage?.phoneNumberFrom);
    let phoneNumberToSearch: string;

    console.log("API Token received for candidate information::", apiToken)
    if (userMessage.phoneNumberFrom === '') {
      console.log('Phone number from is empty, returning empty candidate profile object');
      return emptyCandidateProfileObj;
    }
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
    
    try {
      console.log('going to get candidate information');
      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, graphVariables, apiToken);
      const people = response?.data?.data?.people as { 
        edges: PersonEdge[];
        pageInfo: PageInfo;
      } | undefined;
      const peopleEdges = people?.edges || [];
      
      console.log("Number of people fetched::", peopleEdges.length);

      // Flatten all candidates from all people into single array
      const candidateDataObjs = peopleEdges.flatMap(person => 
        person?.node?.candidates?.edges || []
      );

      console.log('Number of candidates in candidateDataObjs::', candidateDataObjs.length);

      // Find most recently updated candidate with startChat enabled
      const activeJobCandidateObj = candidateDataObjs
        .filter((edge: CandidatesEdge) => {
          const isActive = edge?.node?.jobs?.isActive;
          const hasStartChat = edge?.node?.startChat;
          return isActive && hasStartChat;
        })
        .sort((a, b) => {
          const aTime = a?.node?.updatedAt ? new Date(a.node.updatedAt).getTime() : 0;
          const bTime = b?.node?.updatedAt ? new Date(b.node.updatedAt).getTime() : 0;
          return bTime - aTime; // Sort descending
        })[0];

      console.log(
        'Active job candidate found:', 
        activeJobCandidateObj?.node?.name || 'None',
        'with updatedAt:',
        'with id:',
        activeJobCandidateObj?.node?.id || 'No id',
        activeJobCandidateObj?.node?.updatedAt || 'No date'
      );

      if (activeJobCandidateObj) {
        const personWithActiveJob = peopleEdges.find(
          (person: PersonEdge) =>
            person?.node?.candidates?.edges?.some(
              (candidate) => candidate?.node?.jobs?.isActive,
            ),
        );

        const activeJobCandidate: CandidateNode = activeJobCandidateObj?.node;
        const activeJob: Job = activeJobCandidate?.jobs as Job;
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
          phoneNumber: personWithActiveJob?.node?.phones?.primaryPhoneNumber?.length == 10
            ? {
              primaryPhoneNumber: '91' + personWithActiveJob?.node?.phones?.primaryPhoneNumber
            }
            : {
              primaryPhoneNumber: personWithActiveJob?.node?.phones?.primaryPhoneNumber || ''
            },
          email: {
            primaryEmail: personWithActiveJob?.node?.emails?.primaryEmail || ''
          },
          input: userMessage?.messages[0]?.content,
          startChat: activeJobCandidate?.startChat,
          startMeetingSchedulingChat: activeJobCandidate?.startMeetingSchedulingChat,
          startVideoInterviewChat: activeJobCandidate?.startVideoInterviewChat,
          stopChat: activeJobCandidate?.stopChat,
          candidateFieldValues: activeJobCandidate?.candidateFieldValues,
          whatsappMessages: activeJobCandidate?.whatsappMessages,
          status: activeJobCandidate?.status,
          messagingChannel: activeJobCandidate?.messagingChannel,
          emailMessages: { edges: activeJobCandidate?.emailMessages?.edges },
          candidateReminders: {
            edges: activeJobCandidate?.candidateReminders?.edges,
          },
          updatedAt: activeJobCandidate.updatedAt,
          people: personWithActiveJob?.node as PersonNode,
          chatCount: activeJobCandidate.chatCount
        };

        return candidateProfileObj;
      } else {
        console.log('No active candidate found with startChat enabled');
        return emptyCandidateProfileObj;
      }
    } catch (error) {
      console.error(
        'Error getting candidate information:',
        error
      );
      return emptyCandidateProfileObj;
    }
  }

  async fetchQuestionsByJobId(
    jobId: string,
    apiToken: string,
  ): Promise<{
    questionIdArray: { questionId: string; question: string }[] | undefined;
    questionArray: string[];
  }> {
    console.log('Going to fetch questions for job id:', jobId);
    // const data = JSON.stringify({
    //   query: graphqlQueryToFindManyCandidateFields,
    //   variables: {
    //     filter: { jobsId: { in: [`${jobId}`] } },
    //     orderBy: { position: 'DescNullsFirst' },
    //   },
    // });

    const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyCandidateFields, {
      filter: { jobsId: { in: [`${jobId}`] } },
      orderBy: { position: 'DescNullsFirst' },
    }, apiToken);

    console.log('This is the response from fetchQuestionsByJobId:', response.data);
    const candidateFields = response?.data?.data?.candidateFields;

    if (!candidateFields) {
      return { questionArray: [], questionIdArray: [] };
    }

    const candidateFieldsEdges = candidateFields as {
      edges: CandidateFieldEdge[];
      pageInfo: PageInfo;
    } | undefined;

    const questionsArray: string[] = candidateFieldsEdges?.edges.map(
      (val: { node: { name: string } }) => val.node.name,
    ) || [];
    const questionIdArray = candidateFieldsEdges?.edges.map(
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

    }
    const graphVariables = {
      filter: { id: { eq: candidateId } },
      orderBy: { position: 'AscNullsFirst' },
    };

    try {

      const candidateObjresponse = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        graphVariables,
        apiToken,
      );
      const candidateObj = candidateObjresponse?.data?.data as {
        candidates: {
          edges: CandidatesEdge[];
          pageInfo: PageInfo;
        } | undefined;
      } | undefined;

      console.log('candidate objk1:', candidateObj);

      const candidateNode =
      candidateObj?.candidates?.edges?.filter(
          (edge) => edge.node.id === candidateId,
        )[0]?.node as CandidateNode;

      if (!candidateNode) {
        console.log('Candidate not found');

        return ;
      }

      const person = candidateNode?.people;

      if (!person) {
        console.log('Person ID not found');

        return ;
      }

      if (person) {
        console.log(
          'Personobj:',
          person?.name?.firstName || '' + ' ' + person?.name?.lastName,
        ) + '';

        return person;
      } else {
        console.log('Person not found');

      }
    } catch (error) {
      console.log(
        'Getting an error and returning empty candidate person profile objeect:',
        error,
      );

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

    const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFindManyPeople, graphVariables, apiToken);

    console.log(
      'This is the response from getCandidate Information FROM personID in getPersoneDetailsByPhoneNumber',
      response.data.data,
    );
    const personDataObjs = response?.data?.data?.people as {
      edges: PersonEdge[];
      pageInfo: PageInfo;
    } | undefined;
        // const personDataObjs = personDataObjs?.edges[0]?.node as PersonNode | undefined;

    console.log('personDataobjs:', personDataObjs);

    return personDataObjs?.edges[0]?.node as PersonNode;
  }
}
