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
    FindOneJob,
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
    questionTextToKey,
    whatappUpdateMessageObjType,
    WhatsAppMessagesEdge
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';


import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { RecruiterProfileService } from '../recruiter-profile';

export class FilterCandidates {
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}
  async getCandidateDetailsById(candidateId: string, apiToken: string) {
    const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { id: { eq: candidateId } } }, apiToken);
    const candidateNode = response?.data?.data?.candidates?.edges[0]?.node as CandidateNode;
    return candidateNode;
  }
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
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    let phoneNumberTo: string = '';
    
    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberTo = candidate?.linkedinUrl?.primaryLinkUrl || '';
    } else if (candidate?.phoneNumber?.primaryPhoneNumber) {
      phoneNumberTo = candidate.phoneNumber.primaryPhoneNumber.length == 10
          ? '91' + candidate.phoneNumber.primaryPhoneNumber
          : candidate.phoneNumber.primaryPhoneNumber;
    } else {
      console.warn('No phone number found for candidate, using empty string');
    }

    let phoneNumberFrom:string = recruiterProfile.phoneNumber;
    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberFrom = recruiterProfile.linkedinUrl || '';
    }
    else{
      phoneNumberFrom = recruiterProfile.phoneNumber
    }
  

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
    // If the first message is already a system prompt, just update its content
    if (mostRecentMessageArr.length > 0 && mostRecentMessageArr[0].role === 'system') {
      mostRecentMessageArr[0] = { role: 'system', content: newSystemPrompt };
      return mostRecentMessageArr;
    }
    
    // Otherwise, replace the first message with the system prompt
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

    return mostRecentMessageArr?.filter((message) => 'content' in message) || [];
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

    console.log( 'This is the response from fetchScheduledClientMeetings:', response.data.data, );
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
    let pageCount = 0;
    const maxPages = 50; // Safety limit to prevent infinite loops
    const processedCursors = new Set<string>(); // Track processed cursors to prevent loops

    while (hasNextPage && pageCount < maxPages) {
      try {
        // Check if we've already processed this cursor (infinite loop prevention)
        if (lastCursor && processedCursors.has(lastCursor)) {
          console.warn(`Detected infinite loop with cursor: ${lastCursor}. Breaking pagination.`);
          break;
        }

        if (lastCursor) {
          processedCursors.add(lastCursor);
        }

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
        
        // Validate pageInfo before using it
        if (!whatsappMessages.pageInfo) {
          console.warn('No pageInfo in response, breaking pagination');
          break;
        }

        const newCursor = whatsappMessages.pageInfo.endCursor;
        const newHasNextPage = whatsappMessages.pageInfo.hasNextPage;

        // Check if cursor has changed
        if (newCursor === lastCursor) {
          console.warn('Cursor has not changed, breaking pagination to prevent infinite loop');
          break;
        }

        lastCursor = newCursor;
        hasNextPage = newHasNextPage;
        pageCount++;
        
      } catch (error) {
        hasNextPage = false;
        console.error('Error fetching whatsappmessages:', error);
      }
    }

    if (pageCount >= maxPages) {
      console.warn(`Reached maximum page limit (${maxPages}) for candidate: ${candidateId}`);
    }

    console.log(`Completed fetching WhatsApp messages for candidate: ${candidateId}, total messages: ${allWhatsappMessages.length}`);
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
        filter: {
          linkedinUrl: {
            primaryLinkUrl: { like: '%' + phoneNumber + '%' },
          },
        },
        orderBy: { position: 'AscNullsFirst' },
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

  async getCandidateInformation(
    userMessage: chatMessageType,
    apiToken: string,
  ) {
    console.log('This is the messageFrom', userMessage?.phoneNumberFrom);
    let messageIdentifierToSearch: string;

    console.log("API Token received for candidate information::")
    if (userMessage.phoneNumberFrom === '') {
      console.log('Message from is empty, returning empty candidate profile object');
      return emptyCandidateProfileObj;
    }
    if (userMessage.messageType === 'messageFromSelf') {
      messageIdentifierToSearch = userMessage.phoneNumberTo.replace('+', '');
    } else {
      messageIdentifierToSearch = userMessage.phoneNumberFrom.replace('+', '');
    }

    if (messageIdentifierToSearch.length > 10 && !messageIdentifierToSearch.includes("linkedin")) {
      console.log( 'Message identifier is more than 10 digits will slice:', messageIdentifierToSearch );
      if (messageIdentifierToSearch.includes("@s.whatsapp.net")) {
        messageIdentifierToSearch = messageIdentifierToSearch.split("@s.whatsapp.net")[0];
      } else{
        messageIdentifierToSearch = messageIdentifierToSearch.slice(-10);
      }
    }

    console.log('messageIdentifierToSearch::', messageIdentifierToSearch);
    
    let graphVariables : any;
    graphVariables = {
      filter: { phones: { primaryPhoneNumber: { ilike: '%' + messageIdentifierToSearch + '%' } } },
      orderBy: { position: 'AscNullsFirst' },
    };

    if (userMessage.messageType === 'linkedin' || messageIdentifierToSearch.includes("linkedin")) {
      // For LinkedIn, we need to search both by full URL and by profile ID
      // Since we standardize LinkedIn URLs to https://linkedin.com/in/ format, we only need to search for that format
      
      // Normalize the LinkedIn URL first
      const normalizedUrl = normalizeLinkedInUrl(messageIdentifierToSearch);
      
      // Extract profile ID from LinkedIn URL if it's a full URL
      let profileId = messageIdentifierToSearch;
      if (messageIdentifierToSearch.includes('linkedin.com/in/')) {
        profileId = messageIdentifierToSearch.split('linkedin.com/in/')[1];
      }
      
      console.log('LinkedIn search - Original URL:', messageIdentifierToSearch);
      console.log('LinkedIn search - Normalized URL:', normalizedUrl);
      console.log('LinkedIn search - Profile ID:', profileId);
      
      graphVariables = {
        filter: {
          or: [
            {
              linkedinLink: {
                primaryLinkUrl: { ilike: '%' + messageIdentifierToSearch + '%' },
              }
            },
            {
              linkedinLink: {
                primaryLinkUrl: { ilike: '%' + normalizedUrl + '%' },
              }
            },
            {
              linkedinLink: {
                primaryLinkUrl: { ilike: '%' + profileId + '%' },
              }
            }
          ]
        },
        orderBy: { position: 'AscNullsFirst' },
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
      
      // Debug: Log the LinkedIn URLs of found people
      if (peopleEdges.length > 0) {
        console.log('Found people with LinkedIn URLs:');
        peopleEdges.forEach((person, index) => {
          const linkedinUrl = person?.node?.linkedinLink?.primaryLinkUrl;
          console.log(`Person ${index + 1}: ${linkedinUrl || 'No LinkedIn URL'}`);
        });
      }

      // Flatten all candidates from all people into single array
      const candidateDataObjs = peopleEdges.flatMap(person => 
        person?.node?.candidates?.edges || []
      );


      // Find most recently updated candidate with active job
      // For incoming messages, we should be more permissive and not require startChat to be true
      // because incoming messages should trigger engagement even if startChat is not initially enabled
      const activeJobCandidateObj = candidateDataObjs
        .filter((edge: CandidatesEdge) => {
          const isActive = edge?.node?.jobs?.isActive;
          const hasStartChat = edge?.node?.startChat;
          const isStopped = edge?.node?.stopChat;
          console.log(`Filtering candidate ${edge?.node?.id}: isActive=${isActive}, hasStartChat=${hasStartChat}, isStopped=${isStopped}`);
          
          // For incoming messages, we should process candidates with active jobs
          // even if startChat is not enabled, but we should skip if stopChat is true
          return isActive && !isStopped;
        })
        .sort((a, b) => {
          const aTime = a?.node?.updatedAt ? new Date(a.node.updatedAt).getTime() : 0;
          const bTime = b?.node?.updatedAt ? new Date(b.node.updatedAt).getTime() : 0;
          return bTime - aTime; // Sort descending
        })[0];



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
          phoneNumber: {
            primaryPhoneNumber: personWithActiveJob?.node?.phones?.primaryPhoneNumber?.length == 10
              ? '91' + personWithActiveJob?.node?.phones?.primaryPhoneNumber
              : personWithActiveJob?.node?.phones?.primaryPhoneNumber || '',
          },
          email: {
            primaryEmail: personWithActiveJob?.node?.emails?.primaryEmail || '',
          },
          peopleId: personWithActiveJob?.node?.id || '',
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
        console.log('No active candidate found (job not active or chat stopped)');
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
    questionIdArray: { questionId: string; question: string; questionKey: string }[] | undefined;
    questionArray: string[];
  }> {
    console.log('Going to fetch questions for job id:', jobId);

    const jobResponse = await this.staticGraphQLService.executeGraphQL(
      FindOneJob,
      { objectRecordId: jobId },
      apiToken,
    );

    const chatQuestions = Array.isArray(jobResponse?.data?.data?.job?.chatQuestions)
      ? jobResponse.data.data.job.chatQuestions.filter((question: string) => question?.trim())
      : [];

    if (chatQuestions.length > 0) {
      const questionIdArray = chatQuestions.map((question: string) => ({
        questionId: questionTextToKey(question),
        question,
        questionKey: questionTextToKey(question),
      }));

      return { questionArray: chatQuestions, questionIdArray };
    }

    const legacyResponse = await this.staticGraphQLService.executeGraphQL(
      graphqlQueryToFindManyCandidateFields,
      {
        filter: { jobsId: { in: [`${jobId}`] } },
        orderBy: { position: 'DescNullsFirst' },
      },
      apiToken,
    );

    const candidateFields = legacyResponse?.data?.data?.candidateFields;

    if (!candidateFields) {
      return { questionArray: [], questionIdArray: [] };
    }

    const candidateFieldsEdges = candidateFields as {
      edges: CandidateFieldEdge[];
      pageInfo: PageInfo;
    } | undefined;

    const questionsArray: string[] =
      candidateFieldsEdges?.edges.map(
        (val: { node: { name: string } }) => val.node.name,
      ) || [];
    const questionIdArray = candidateFieldsEdges?.edges.map(
      (val: { node: { id: string; name: string } }) => ({
        questionId: val.node.id,
        question: val.node.name,
        questionKey: questionTextToKey(val.node.name),
      }),
    );

    console.log('This is the questions array:', questionsArray);
    return { questionArray: questionsArray, questionIdArray: questionIdArray };
  }

  async getPersonDetailsByCandidateId(candidateId: string, apiToken: string) {
    console.log('Trying to get person details by candidateId:', candidateId);
    if (!candidateId || candidateId === '') {
      console.log('Phone number is empty and no candidate found');
      return ;
    }
    const graphVariables = {
      filter: { id: { eq: candidateId } },
      orderBy: { position: 'AscNullsFirst' },
    };
    try {
      const candidateObjresponse = await this.staticGraphQLService.executeGraphQL( graphqlToFetchAllCandidateData, graphVariables, apiToken );
      const candidateObj = candidateObjresponse?.data?.data as {
        candidates: {
          edges: CandidatesEdge[];
          pageInfo: PageInfo;
        } | undefined;
      } | undefined;
      console.log('candidate objk1:', candidateObj);
      const candidateNode = candidateObj?.candidates?.edges?.filter( (edge) => edge.node.id === candidateId, )[0]?.node as CandidateNode;
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
        console.log( 'Personobj:', person?.name?.firstName || '' + ' ' + person?.name?.lastName, ) + '';
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
    console.log( 'This is the response from getCandidate Information FROM personID in getPersoneDetailsByPhoneNumber', response.data.data, );
    const personDataObjs = response?.data?.data?.people as {
      edges: PersonEdge[];
      pageInfo: PageInfo;
    } | undefined;
    console.log('personDataobjs:', personDataObjs);
    return personDataObjs?.edges[0]?.node as PersonNode;
  }
}
