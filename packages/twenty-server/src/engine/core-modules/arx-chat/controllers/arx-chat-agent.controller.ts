import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import axios from 'axios';
import {
  ChatControlsObjType,
  ChatHistoryItem,
  ChatRequestBody,
  graphqlMutationToDeleteManyCandidates,
  graphqlMutationToDeleteManyPeople,
  graphqlQueryToFindManyPeople,
  graphqlToCreateOnePrompt,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  graphqlToUpdateWhatsappMessageId,
  Jobs,
  MessageNode,
  mutations,
  PersonNode,
  queries,
  whatappUpdateMessageObjType
} from 'twenty-shared';

import CandidateEngagementArx from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { OpenAIArxMultiStepClient } from 'src/engine/core-modules/arx-chat/services/llm-agents/arx-multi-step-client';
import { HumanLikeLLM } from 'src/engine/core-modules/arx-chat/services/llm-agents/human-or-bot-classification';
import { ToolCallsProcessing } from 'src/engine/core-modules/arx-chat/services/llm-agents/tool-calls-processing';
import { getRecruiterProfileByJob } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { FacebookWhatsappChatApi } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import {
  axiosRequest,
  formatChat,
} from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { prompts } from 'src/engine/core-modules/workspace-modifications/object-apis/data/prompts';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('arx-chat')
export class ArxChatEndpoint {
  constructor(
    private readonly candidateService: CandidateService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  @Post('start-chat')
  @UseGuards(JwtAuthGuard)
  async startChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };
    const response = await new CandidateEngagementArx(
      this.workspaceQueryService,
    ).createChatControl(request.body.candidateId, chatControl, apiToken);

    console.log('Response from create start-Chat api', response);
  }

  @Post('get-queries-and-mutations')
  async getQueriesAndMutations(): Promise<object> {
    console.log('Getting all queries and mutations');
    const allQueries = {
      queries: queries,
      mutations: mutations,
    };

    return allQueries;
  }

  // @Post('start-chats-by-job-candidate-ids')
  // async startChatsByJobCandidateIds(@Req() request: any): Promise<object> {
  //   const apiToken = request.headers.authorization.split(' ')[1];
  //   const jobCandidateIds = request.body.jobCandidateIds;
  //   const currentViewWithCombinedFiltersAndSorts = request.body.currentViewWithCombinedFiltersAndSorts;
  //   const objectNameSingular = request.body.objectNameSingular;
  //   console.log('jobCandidateIds::', jobCandidateIds);
  //   console.log('objectNameSingular::', objectNameSingular);
  //   const path_position = request?.body?.objectNameSingular.replace('JobCandidate', '');
  //   const allDataObjects = await new CreateMetaDataStructure(this.workspaceQueryService).fetchAllObjects(apiToken);

  //   const allJobCandidates = await this.candidateService.findManyJobCandidatesWithCursor(path_position, apiToken);
  //   console.log('All Job Candidates:', allJobCandidates?.length);
  //   const filteredCandidateIds = await this.candidateService.filterCandidatesBasedOnView(allJobCandidates, currentViewWithCombinedFiltersAndSorts, allDataObjects);
  //   console.log('This is the filteredCandidates, ', filteredCandidateIds);
  //   console.log('Got a total of filteredCandidates length, ', filteredCandidateIds.length);
  //   console.log('Starting chat for , ', filteredCandidateIds.length, ' candidates');
  //   for (const candidateId of filteredCandidateIds) {
  //     const chatControl: ChatControlsObjType = { chatControlType: 'startChat' };
  //     await await new CandidateEngagementArx(this.workspaceQueryService).createChatControl(candidateId, chatControl, apiToken);
  //   }
  //   return { status: 'Success' };
  // }

  @Post('start-chats-by-candidate-ids')
  async startChatsByCandidateIds(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateIds = request.body.candidateIds;
    console.log( 'candidateIds', candidateIds, );
    console.log( 'Number of candidate Ids to start chats', candidateIds.length, );
    for (const candidateId of candidateIds) {
      const chatControl: ChatControlsObjType = {
        chatControlType: 'startChat',
      };
      await await new CandidateEngagementArx(
        this.workspaceQueryService,
      ).createChatControl(candidateId, chatControl, apiToken);
    }
    return { status: 'Success' };
  }

  @Post('stop-chat')
  @UseGuards(JwtAuthGuard)
  async stopChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token

    const graphqlVariables = {
      idToUpdate: request.body.candidateId,
      input: {
        stopChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  @UseGuards(JwtAuthGuard)
  async fetchCandidateByPhoneNumber(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const phoneNumber = request.body.phoneNumber;

    console.log('called fetchCandidateByPhoneNumber for phone:', phoneNumber);
    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj, apiToken);

    console.log(
      'Response from create fetch-candidate-by-phone-number-start::',
      response.data,
    );

    return response.data;
  }

  @Post('retrieve-chat-response')
  @UseGuards(JwtAuthGuard)
  async retrieve(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom, apiToken);

    try {
      const personCandidateNode = personObj?.candidates?.edges[0]?.node;
      const candidateJob = personCandidateNode?.jobs;
      // const messagesList = personCandidateNode?.whatsappMessages?.edges;
      const messagesList: MessageNode[] = await new FilterCandidates(
        this.workspaceQueryService,
      ).fetchAllWhatsappMessages(personCandidateNode.id, apiToken);
      let mostRecentMessageArr: ChatHistoryItem[] = new FilterCandidates(
        this.workspaceQueryService,
      ).getMostRecentMessageFromMessagesList(messagesList);
      const isChatEnabled = false;

      if (mostRecentMessageArr?.length > 0) {
        const chatAgent: OpenAIArxMultiStepClient =
          new OpenAIArxMultiStepClient(personObj, this.workspaceQueryService);
        const chatControl: ChatControlsObjType = {
          chatControlType: 'startChat',
        };

        mostRecentMessageArr =
          (await chatAgent.createCompletion(
            mostRecentMessageArr,
            candidateJob,
            chatControl,
            apiToken,
            isChatEnabled,
          )) || [];

        return mostRecentMessageArr;
      }
    } catch (err) {
      return { status: err };
    }

    return { status: 'Failed' };
  }

  @Post('start-interim-chat-prompt')
  @UseGuards(JwtAuthGuard)
  async startInterimChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const interimChat = request.body.interimChat;
    const phoneNumber = request.body.phoneNumber;

    console.log('called interimChat:', interimChat);
    await new UpdateChat(this.workspaceQueryService).createInterimChat(
      interimChat,
      phoneNumber,
      apiToken,
    );

    return;
  }
  @Post('reset-messages-from-whatsapp')
  @UseGuards(JwtAuthGuard)
  async resetMessagesFromWhatsapp(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const candidateIds = request.body.candidateIds;

    console.log('called resetMessagesFromWhatsapp:', candidateIds);
    for (const candidateId of candidateIds) {
    await new UpdateChat(this.workspaceQueryService).resetMessagesFromWhatsapp(
      candidateId,
      apiToken,
    ); 
  }

    return;
  }

  @Post('send-chat')
  @UseGuards(JwtAuthGuard)
  async SendChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    const messageToSend = request?.body?.messageToSend;
    const phoneNumber = request.body.phoneNumberTo;

    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);

    console.log('This is the chat reply:', messageToSend);
    const candidateJob: Jobs = personObj.candidates?.edges[0]?.node?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );

    console.log('Recruiter profile', recruiterProfile);
    const chatMessages =
      personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.whatsappMessages?.edges;
    let chatHistory = chatMessages[0]?.node?.messageObj || [];
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };

    chatHistory =
      personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.whatsappMessages?.edges[0]?.node
        ?.messageObj;


    let phoneNumberTo:string = personObj.phones.primaryPhoneNumber.length == 10
    ? '91' + personObj.phones.primaryPhoneNumber
    : personObj.phones.primaryPhoneNumber;
    if (personObj?.candidates?.edges[0]?.node?.messagingChannel == 'linkedin') {
      phoneNumberTo = personObj?.linkedinLink?.primaryLinkUrl || '';
    }
    else{
      phoneNumberTo = personObj.phones.primaryPhoneNumber.length == 10
          ? '91' + personObj.phones.primaryPhoneNumber
          : personObj.phones.primaryPhoneNumber
    }
      
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      candidateProfile: personObj?.candidates?.edges[0]?.node,
      candidateFirstName: personObj?.name?.firstName || '',
      phoneNumberFrom: recruiterProfile.phoneNumber,
      whatsappMessageType:
        personObj?.candidates?.edges.filter(
          (candidate) => candidate.node.jobs.id == candidateJob.id,
        )[0]?.node.whatsappProvider ||
        'application03',
      phoneNumberTo:phoneNumberTo,
      messages: [{ content: request?.body?.messageToSend }],
      messageType: 'recruiterMessage',
      messageObj: chatHistory,
      lastEngagementChatControl: chatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
    };

    const messageObj: ChatRequestBody = {
      phoneNumberFrom: recruiterProfile.phoneNumber,
      phoneNumberTo:
        personObj.phones.primaryPhoneNumber.length == 10
          ? '91' + personObj.phones.primaryPhoneNumber
          : personObj.phones.primaryPhoneNumber,
      messages: messageToSend,
    };
    const sendMessageResponse = await new FacebookWhatsappChatApi(
      this.workspaceQueryService,
    ).sendWhatsappTextMessage(messageObj, apiToken);

    whatappUpdateMessageObj.whatsappMessageId =
      sendMessageResponse?.data?.messages[0]?.id;
    whatappUpdateMessageObj.whatsappDeliveryStatus = 'sent';
    await new UpdateChat(
      this.workspaceQueryService,
    ).createAndUpdateWhatsappMessage(
      personObj.candidates.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0].node,
      whatappUpdateMessageObj,
      apiToken,
    );

    return { status: 'success' };
  }

  @Post('get-all-messages-by-candidate-id')
  @UseGuards(JwtAuthGuard)
  async getWhatsappMessagessByCandidateId(
    @Req() request: any,
  ): Promise<object[]> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateId = request.body.candidateId;
    const allWhatsappMessages = await new FilterCandidates(
      this.workspaceQueryService,
    ).fetchAllWhatsappMessages(candidateId, apiToken);

    return allWhatsappMessages;
  }

  @Post('get-all-messages-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getAllMessagesByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log(
      'Going to get all messages by phone Number for :',
      request.body.phoneNumber,
    );
    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id;
    const allWhatsappMessages = await new FilterCandidates(
      this.workspaceQueryService,
    ).fetchAllWhatsappMessages(candidateId, apiToken);
    const formattedMessages = await formatChat(allWhatsappMessages);

    console.log(
      'All messages length:',
      allWhatsappMessages?.length,
      'for phone number:',
      request.body.phoneNumber,
    );

    return { formattedMessages: formattedMessages };
  }

  @Post('get-candidate-status-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateStatusByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log(
      'Going to get candidate status by phone Number for :',
      request.body.phoneNumber,
    );
    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateStatus =
      personObj?.candidates?.edges[0]?.node?.status || 'Unknown';

    console.log(
      'Candidate satus:',
      candidateStatus,
      'for phone number:',
      request.body.phoneNumber,
    );

    return { status: candidateStatus };
  }

  @Post('get-candidate-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByPhoneNumbers(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log(
      'Going to get candidate by phone Number for :',
      request.body.phoneNumber,
    );
    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId = personObj?.candidates?.edges[0]?.node?.id;

    console.log(
      'candidateId to fetch all candidateby phonenumber:',
      candidateId,
    );

    return { candidateId: candidateId };
  }

  @Post('get-candidate-id-by-hiring-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByHiringNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      console.log(
        'Going to get candidate by hiring-naukri-url :',
        request?.body?.hiringNaukriUrl,
      );
      const hiringNaukriUrl = request.body.hiringNaukriUrl;
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: {
          filter: { hiringNaukriUrl: { url: { eq: hiringNaukriUrl } } },
        },
      });
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('Fetched candidate by candidate ID:', response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;

      console.log('Fetched candidate by candidate OB:', candidateObj);
      const candidateId = candidateObj?.id;

      console.log(
        'candidateId to fetch all candidateby hiring-naukri:',
        candidateId,
      );

      return { candidateId };
    } catch (err) {
      console.log('Error in fetching candidate by hiring-naukri-url :', err);

      return { candidateId: null };
    }
  }

  @Post('get-candidate-id-by-resdex-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdsByResdexNaukriURL(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      console.log(
        'Going to get candidate esdex-naukri-ur :',
        request.body.resdexNaukriUrl,
      );
      const resdexNaukriUrl = request.body.resdexNaukriUrl;
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: {
          filter: { resdexNaukriUrl: { url: { eq: resdexNaukriUrl } } },
        },
      });
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('Fetched candidate by candidate ID:', response?.data);
      const candidateObj = response?.data?.data?.candidates?.edges[0]?.node;

      console.log('Fetched candidate by candidate Obj ID:', candidateObj);
      const candidateId = candidateObj?.id;

      console.log(
        'candidateId to fetch all candidateby resdex-naukri:',
        candidateId,
      );

      return { candidateId };
    } catch (err) {
      console.log('Error in fetching candidate by resdex-naukri-url:', err);

      return { candidateId: null };
    }
  }

  @Post('get-id-by-unique-string-key')
  @UseGuards(JwtAuthGuard)
  async getCandidateByUniqueStringKey(
    @Req() request: any,
  ): Promise<{ candidateId: string | null }> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      const graphqlQuery = JSON.stringify({
        query: graphqlQueryToFindManyPeople,
        variables: {
          filter: { uniqueStringKey: { eq: request.body.uniqueStringKey } },
          limit: 1,
        },
      });

      const response = await axiosRequest(graphqlQuery, apiToken);
      const candidateId =
        response?.data?.data?.people?.edges[0]?.node?.candidates?.edges[0]?.node
          ?.id || null;

      return { candidateId };
    } catch (err) {
      console.error('Error in getCandidateByUniqueStringKey:', err);

      return { candidateId: null };
    }
  }

  @Post('refresh-chat-status-by-candidates')
  @UseGuards(JwtAuthGuard)
  async countChats(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const { candidateIds } = request.body;

      console.log('going to refresh chats');
      console.log('Fetching job IDs for candidates:', candidateIds);
      // const graphqlQuery = JSON.stringify({
      //   query: graphqlToFetchAllCandidateData,
      //   variables: { filter: { id: { in: candidateIds } } }
      // });

      // const response = await axiosRequest(graphqlQuery, apiToken);
      // console.log("Number of candidates fetched:", response?.data?.data?.candidates?.edges.length);
      // const jobIds = response?.data?.data?.candidates?.edges.map((edge: { node?: { jobs?: { id: string } } }) => edge?.node?.jobs?.id)
      // console.log("Found job IDs:", jobIds);
      const jobIds = await new FilterCandidates(
        this.workspaceQueryService,
      ).getJobIdsFromCandidateIds(candidateIds, apiToken);
      const results = await new UpdateChat(
        this.workspaceQueryService,
      ).processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds);

      console.log(
        'Have received results and will try and update the sheets also from the controlelr',
      );
      await new GoogleSheetsService().updateGoogleSheetsWithChatData(
        results,
        apiToken,
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in countChats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('refresh-chat-counts-by-candidates')
  @UseGuards(JwtAuthGuard)
  async refreshChats(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];

    try {
      const { candidateIds } = request.body;

      console.log('going to refresh chat counts by candidate Ids');
      await new UpdateChat(
        this.workspaceQueryService,
      ).updateCandidatesWithChatCount(candidateIds, apiToken);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh-chat-counts-by-candi chats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('create-shortlist-document')
  @UseGuards(JwtAuthGuard)
  async createShortlistDocument(@Req() request: any): Promise<object> {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];

      console.log(
        'going to refresh chat counts by candidate Ids',
        candidateIds,
      );
      await new UpdateChat(this.workspaceQueryService).createShortlistDocument(
        candidateIds,
        apiToken,
      );
      console.log(
        'This is the response in create createShortlistDocument shortlist',
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in create_gmail_draft_shortlist chats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      console.log('going to test arxena connection');
      await new UpdateChat(this.workspaceQueryService).testArxenaConnection(
        apiToken,
      );
      console.log(
        'This is the response in create testArxenaConnection testArxenaConnection',
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in testArxenaConnection chats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('chat-based-shortlist-delivery')
  @UseGuards(JwtAuthGuard)
  async chatBasedShortlistDelivery(@Req() request: any): Promise<object> {
    try {
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];
      const origin = request.body.origin;
      console.log(
        'going to refresh chat counts by candidate Ids',
        candidateIds,
      );
      await new UpdateChat(
        this.workspaceQueryService,
      ).createChatBasedShortlistDelivery(candidateIds, origin, apiToken);
      console.log(
        'This is the response in create chatBasedShortlistDelivery shortlist',
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in create_gmail_draft_shortlist chats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('create-gmail-draft-shortlist')
  @UseGuards(JwtAuthGuard)
  async chatGmailDraftShortlist(@Req() request: any): Promise<object> {
    try {
      const { candidateIds } = request.body;
      const origin = request.body.origin;
      const apiToken = request.headers.authorization.split(' ')[1];
      console.log( 'going to refresh chat counts by candidate Ids', candidateIds, );
      console.log( 'Number of candidate Ids', candidateIds.length, );
      const createGmailBasedShortlist = await new UpdateChat( this.workspaceQueryService, ).createGmailDraftShortlist(candidateIds, origin, apiToken);
      console.log( 'This is the response in create chatGmailDraftShortlist shortlist', createGmailBasedShortlist );
      return { status: 'Success', results: createGmailBasedShortlist };
    } catch (err) {
      console.error('Error in create gmail_ raft shortlist chats:', err);
      return { status: 'Failed', error: err };
    }
  }

  @Post('create-shortlist')
  @UseGuards(JwtAuthGuard)
  async createShortlist(@Req() request: any): Promise<object> {
    try {
      console.log('Create shortlist called');
      const { candidateIds } = request.body;
      const apiToken = request.headers.authorization.split(' ')[1];

      await new UpdateChat(this.workspaceQueryService).createShortlist(
        candidateIds,
        apiToken,
      );

      return { status: 'Success' };
    } catch (err) {
      console.error('Error creating shortlist:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('create-interview-videos')
  @UseGuards(JwtAuthGuard)
  async createInterviewVideos(@Req() request: any): Promise<object> {
    try {
      console.log('Create video interview called');
      const apiToken = request.headers.authorization.split(' ')[1];
      const jobId = request.body.jobId;

      await new UpdateChat(this.workspaceQueryService).createInterviewVideos(
        jobId,
        apiToken,
      );

      return { status: 'Success' };
    } catch (err) {
      console.log('Error creating interview videos:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('get-id-by-naukri-url')
  @UseGuards(JwtAuthGuard)
  async getCandidateIdByNaukriURL(
    @Req() request: any,
  ): Promise<{ candidateId: string | null }> {
    const apiToken = request.headers.authorization.split(' ')[1];

    try {
      const url =
        request.body[
          request.body.resdexNaukriUrl ? 'resdexNaukriUrl' : 'hiringNaukriUrl'
        ];
      const type = request.body.resdexNaukriUrl ? 'resdex' : 'hiring';

      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: {
          filter: {
            [`${type}NaukriUrl`]: { url: { eq: url } },
          },
        },
      });

      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const candidateId =
        response?.data?.data?.candidates?.edges[0]?.node?.id || null;

      console.log(`Fetched candidateId for ${type}: ${candidateId}`);

      return { candidateId };
    } catch (err) {
      console.error(
        `Error fetching candidate by ${request.body.resdexNaukriUrl ? 'resdex' : 'hiring'}-naukri-url:`,
        err,
      );

      return { candidateId: null };
    }
  }

  @Get('get-candidates-and-chats')
  @UseGuards(JwtAuthGuard)
  async getCandidatesAndChats(@Req() request: any): Promise<object> {
    console.log('Going to get all candidates and chats');
    const apiToken = request?.headers?.authorization?.split(' ')[1];
    const chatControl: ChatControlsObjType = {
      chatControlType: 'allStartedAndStoppedChats',
    };
    const { people, candidateJob } = await new CandidateEngagementArx(
      this.workspaceQueryService,
    ).fetchSpecificPeopleToEngageAcrossAllChatControls(chatControl, apiToken);

    console.log('All people length:', people?.length);

    return people;
  }

  @Post('get-candidates-by-job-id')
  @UseGuards(JwtAuthGuard)
  async getCandidatesByJobId(@Req() request: any): Promise<object> {
    console.log('Going to get all candidates by job id');
    const { jobId } = request.body;
    console.log('jobId in getCandidatesByJobId:', jobId);
    const apiToken = request?.headers?.authorization?.split(' ')[1];
    const candidates = await new CandidateEngagementArx(
      this.workspaceQueryService,
    ).fetchAllCandidatesWithAllChatControlsByJobId(jobId, apiToken);

    console.log('All candidates length:', candidates?.length);

    return candidates;
  }

  @Get('get-person-chat')
  @UseGuards(JwtAuthGuard)
  async getCandidateAndChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const candidateId = request.query.candidateId;
    const person = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByCandidateId(candidateId, apiToken);
    const chatControl: ChatControlsObjType = {
      chatControlType: 'allStartedAndStoppedChats',
    };
    const allPeople = await new FilterCandidates(
      this.workspaceQueryService,
    ).fetchAllPeopleByCandidatePeopleIds([person.id], apiToken);

    console.log('All people length:', allPeople?.length);

    return allPeople;
  }

  @Post('delete-people-and-candidates-from-candidate-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromCandidateIds(@Req() request: any): Promise<object> {
    console.log("Received request to delete people and candidates from candidate id:", request.body);
    const candidateId = request.body.candidateId;
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('candidateId to create video-interview:', candidateId);
    const graphqlQueryObjToFetchCandidate = JSON.stringify({
      query: graphqlToFetchAllCandidateData,
      variables: { filter: { id: { eq: candidateId } } },
    });
    const candidateObjresponse = await axiosRequest(
      graphqlQueryObjToFetchCandidate,
      apiToken,
    );
    const candidateObj = candidateObjresponse?.data?.data;

    console.log('candidate objk1:', candidateObj);

    const candidateNode =
      candidateObjresponse?.data?.data?.candidates?.edges[0]?.node;

    if (!candidateNode) {
      console.log('Candidate not found');

      return { status: 'Failed', message: 'Candidate not found' };
    }
    const personId = candidateNode?.people?.id;

    if (!personId) {
      console.log('Person ID not found');

      return { status: 'Failed', message: 'Person ID not found' };
    }

    const graphqlQueryObj = JSON.stringify({
      query: graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });

    console.log('Going to try and delete candidate');
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log(
        'Error deleting candidate:',
        err.response?.data || err.message,
      );

      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });

    console.log('Going to try and delete person');
    try {
      const response = await axiosRequest(
        graphqlQueryObjToDeletePerson,
        apiToken,
      );

      console.log('Deleted person:', response.data);

      return { status: 'Success' };
    } catch (err) {
      console.log('Error deleting person:', err.response?.data || err.message);

      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-from-person-id')
  @UseGuards(JwtAuthGuard)
  async deletePeopleFromPersonIds(@Req() request: any): Promise<object> {
    const personId = request.body.personId;
    const apiToken = request.headers.authorization.split(' ')[1];

    console.log('personId to delete:', personId);
    const graphqlQueryObjToFetchPerson = JSON.stringify({
      query: graphqlQueryToFindManyPeople,
      variables: { filter: { id: { eq: personId } } },
    });
    const personresponse = await axiosRequest(
      graphqlQueryObjToFetchPerson,
      apiToken,
    );
    const personObj = personresponse?.data?.data;

    console.log('personresponse objk1:', personObj);
    const personNode = personresponse?.data?.data?.people?.edges[0]?.node;

    if (!personNode) {
      console.log(
        'Person not found so cant do things in dlete peopel from person ids',
      );

      return { status: 'Failed', message: 'Candidate not found' };
    }
    const candidateId = personNode?.candidates?.edges[0].node.id;

    console.log('personNode:', personNode);
    console.log('candidateId:', candidateId);
    if (!candidateId) {
      console.log('candidateId ID not found');

      return { status: 'Failed', message: 'candidateId ID not found' };
    }
    console.log('candidateId ID:', candidateId);
    const graphqlQueryObj = JSON.stringify({
      query: graphqlMutationToDeleteManyCandidates,
      variables: { filter: { id: { in: [candidateId] } } },
    });

    console.log('Going to try and delete candidate');
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('Deleted candidate:', response.data);
    } catch (err) {
      console.log(
        'Error deleting candidate:',
        err.response?.data || err.message,
      );

      return { status: 'Failed', message: 'Error deleting candidate' };
    }
    const graphqlQueryObjToDeletePerson = JSON.stringify({
      query: graphqlMutationToDeleteManyPeople,
      variables: { filter: { id: { in: [personId] } } },
    });

    console.log('Going to try and delete person');
    try {
      const response = await axiosRequest(
        graphqlQueryObjToDeletePerson,
        apiToken,
      );

      console.log('Deleted person:', response.data);

      return { status: 'Success' };
    } catch (err) {
      console.log('Error deleting person:', err.response?.data || err.message);

      return { status: 'Failed', message: 'Error deleting person' };
    }
  }

  @Post('delete-people-and-candidates-bulk')
  @UseGuards(JwtAuthGuard)
  async deletePeopleAndCandidatesBulk(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const { candidateIds, personIds } = request.body;
    console.log("Received request to delete people and candidates from bulk:", request.body);

    const BATCH_SIZE = 100;
    const SUB_BATCH_SIZE = 50;
    const results: { succeeded: string[]; failed: string[] } = {
      succeeded: [],
      failed: [],
    };

    const workspaceName =
      await this.workspaceQueryService.getWorkspaceNameFromToken(apiToken);
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const dataSourceSchema =
      this.workspaceQueryService.getDataSourceSchema(workspaceId);

    console.log('dataSourceSchema:', dataSourceSchema);
    console.log('workspaceName:', workspaceName);
    console.log('workspaceId:', workspaceId);

    // Helper function to process arrays in batches
    const processBatch = async <T>(
      items: T[],
      batchSize: number,
      processor: (batch: T[]) => Promise<void>
    ): Promise<void> => {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await processor(batch);
      }
    };

    // Helper function to delete field values in smaller sub-batches
    const deleteFieldValuesInBatches = async (candidateIds: string[]): Promise<void> => {
      for (let i = 0; i < candidateIds.length; i += SUB_BATCH_SIZE) {
        const subBatch = candidateIds.slice(i, i + SUB_BATCH_SIZE);
        const candidateIdsStr = subBatch.map(id => `'${id}'`).join(',');
        const deleteFieldValuesQuery = `DELETE FROM ${dataSourceSchema}."_candidateFieldValue" WHERE "candidateId" IN (${candidateIdsStr})`;
        
        try {
          await this.workspaceQueryService.executeRawQuery(
            deleteFieldValuesQuery,
            [],
            workspaceId,
          );
          console.log(`Successfully deleted field values for ${subBatch.length} candidates`);
        } catch (error) {
          console.error(`Error deleting field values for batch: ${error.message}`);
          // Continue with next batch even if this one fails
        }
      }
    };

    if (candidateIds?.length) {
      // Process candidates in batches
      await processBatch<string>(candidateIds as string[], BATCH_SIZE, async (batchCandidateIds) => {
        try {
          // First fetch all candidate information to get associated person IDs for this batch
          const graphqlQueryObjToFetchCandidates = JSON.stringify({
            query: graphqlToFetchAllCandidateData,
            variables: { filter: { id: { in: batchCandidateIds } } },
          });

          const candidatesResponse = await axiosRequest(
            graphqlQueryObjToFetchCandidates,
            apiToken,
          );
          const candidateNodes =
            candidatesResponse?.data?.data?.candidates?.edges || [];

          // Collect all person IDs associated with these candidates
          const personIdsFromCandidates = candidateNodes
            .map((edge: { node: { people: { id: any; }; }; }) => edge.node?.people?.id)
            .filter((id: any) => id);

          // Delete field values in smaller sub-batches
          await deleteFieldValuesInBatches(batchCandidateIds);

          // Delete candidates in this batch
          const graphqlQueryObjDeleteCandidates = JSON.stringify({
            query: graphqlMutationToDeleteManyCandidates,
            variables: { filter: { id: { in: batchCandidateIds } } },
          });

          await axiosRequest(graphqlQueryObjDeleteCandidates, apiToken);

          // Delete associated people in this batch
          if (personIdsFromCandidates.length > 0) {
            const graphqlQueryObjDeletePeople = JSON.stringify({
              query: graphqlMutationToDeleteManyPeople,
              variables: { filter: { id: { in: personIdsFromCandidates } } },
            });
            await axiosRequest(graphqlQueryObjDeletePeople, apiToken);
          }

          results.succeeded.push(...batchCandidateIds);
        } catch (err) {
          console.error('Error in candidate batch deletion:', err);
          results.failed.push(...batchCandidateIds);
        }
      });
    }

    if (personIds?.length) {
      // Process people in batches
      await processBatch<string>(personIds as string[], BATCH_SIZE, async (batchPersonIds) => {
        try {
          // First fetch all person information to get associated candidate IDs for this batch
          const graphqlQueryObjToFetchPeople = JSON.stringify({
            query: graphqlQueryToFindManyPeople,
            variables: { filter: { id: { in: batchPersonIds } } },
          });

          const peopleResponse = await axiosRequest(
            graphqlQueryObjToFetchPeople,
            apiToken,
          );
          const peopleNodes = peopleResponse?.data?.data?.people?.edges || [];

          // Collect all candidate IDs associated with these people
          const candidateIdsFromPeople = peopleNodes
            .flatMap((edge) => edge.node?.candidates?.edges || [])
            .map((edge) => edge?.node?.id)
            .filter((id) => id);

          // Delete field values in smaller sub-batches
          if (candidateIdsFromPeople.length > 0) {
            await deleteFieldValuesInBatches(candidateIdsFromPeople);

            // Delete candidates for this batch
            const graphqlQueryObjDeleteCandidates = JSON.stringify({
              query: graphqlMutationToDeleteManyCandidates,
              variables: { filter: { id: { in: candidateIdsFromPeople } } },
            });

            await axiosRequest(graphqlQueryObjDeleteCandidates, apiToken);
          }

          // Delete people in this batch
          const graphqlQueryObjDeletePeople = JSON.stringify({
            query: graphqlMutationToDeleteManyPeople,
            variables: { filter: { id: { in: batchPersonIds } } },
          });

          await axiosRequest(graphqlQueryObjDeletePeople, apiToken);

          results.succeeded.push(...batchPersonIds);
        } catch (err) {
          console.error('Error in people batch deletion:', err);
          results.failed.push(...batchPersonIds);
        }
      });
    }

    if (results.failed.length > 0) {
      return {
        status: 'Partial',
        message: `Successfully deleted ${results.succeeded.length} items, failed to delete ${results.failed.length} items`,
        results,
      };
    }

    return {
      status: 'Success',
      message: `Successfully deleted ${results.succeeded.length} items`,
      results,
    };
  }

  @Post('remove-chats')
  async removeChats(@Req() request: any): Promise<object> {
    return { status: 'Success' };
  }

  @Post('check-human-like')
  @UseGuards(JwtAuthGuard)
  async checkHumanLike(@Req() request: any): Promise<object> {
    console.log('This is the request body', request.body);
    try {
      const apiToken = request.headers.authorization.split(' ')[1];

      const personObj: PersonNode = await new FilterCandidates(
        this.workspaceQueryService,
      ).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom, apiToken);

      console.log('Person object receiveed::', personObj);
      const checkHumanLike = await new HumanLikeLLM(
        this.workspaceQueryService,
      ).checkIfResponseMessageSoundsHumanLike(
        request.body.contentObj,
        apiToken,
      );

      console.log('checkHumanLike:', checkHumanLike);

      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }

  @Post('update-whatsapp-delivery-status')
  @UseGuards(JwtAuthGuard)
  async updateDeliveryStatus(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1];
    const listOfMessagesIds: string[] = request.body.listOfMessagesIds;

    try {
      for (const id of listOfMessagesIds) {
        const variablesToUpdateDeliveryStatus = {
          idToUpdate: id,
          input: {
            whatsappDeliveryStatus: 'readByRecruiter',
          },
        };
        // debugger
        const graphqlQueryObjForUpdationForDeliveryStatus = JSON.stringify({
          query: graphqlToUpdateWhatsappMessageId,
          variables: variablesToUpdateDeliveryStatus,
        });

        const responseOfDeliveryStatus = await axiosRequest(
          graphqlQueryObjForUpdationForDeliveryStatus,
          apiToken,
        );

        console.log(
          'responseOfDeliveryStatus::',
          responseOfDeliveryStatus?.data,
        );
        // console.log('Res:::', responseOfDeliveryStatus?.data, "for wamid::", responseOfDeliveryStatus?.data);
        console.log(
          '---------------DELIVERY STATUS UPDATE DONE-----------------------',
        );
      }

      return { status: 'Success' };
    } catch (err) {
      return { status: err };
    }
  }

  @Post('upload-jd')
  @UseGuards(JwtAuthGuard)
  async uploadJD(@Req() request: any) {
    try {
      const { jobId, attachmentUrl } = request.body;

      console.log('jobId:', jobId);
      console.log('attachmentUrl:', attachmentUrl);
      console.log(
        'request.headers.authorization:',
        request.headers.authorization,
      );
      if (!jobId || !attachmentUrl) {
        throw new HttpException(
          'Missing jobId or attachmentUrl',
          HttpStatus.BAD_REQUEST,
        );
      }

      const arxenaSiteBaseUrl =
        process.env.ARXENA_SITE_BASE_URL || 'http://localhost:5050';

      console.log('arxenaSiteBaseUrl:', arxenaSiteBaseUrl);
      const processResponse = await axios.post(
        `${arxenaSiteBaseUrl}/upload-jd`,
        { jobId, attachmentUrl, },
        { headers: { Authorization: `Bearer ${request.headers.authorization.split(' ')[1]}`, 'Content-Type': 'application/json' }, },
      );

      console.log('Received processed jd uploaded ::', processResponse.data);

      return processResponse.data;
    } catch (error) {
      console.log('Error in uploadJD servers side:', error);
      throw new HttpException(
        error.message || 'Failed to process JD',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-prompts')
  @UseGuards(JwtAuthGuard)
  async createPrompts(@Req() request: any): Promise<object> {
    try {
      console.log('request.body: to create new prompts::', request.body);
      const apiToken = request.headers.authorization.split(' ')[1];
      const jobId = request.body.jobId;

      console.log('jobId::', jobId);

      for (const prompt of prompts) {
        const createResponse = await axiosRequest(
          JSON.stringify({
            variables: {
              input: {
                name: prompt.name,
                prompt: prompt.prompt,
                position: 'first',
                jobId: jobId,
              },
            },
            query: graphqlToCreateOnePrompt,
          }),
          apiToken,
        );

        console.log(
          `\${prompt.name} created successfully`,
          createResponse.data,
        );
      }
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create prompts',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { status: 'Success' };
  }

  @Post('share-jd-to-candidate')
  @UseGuards(JwtAuthGuard)
  async shareJDToCandidate(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1];
      const { candidateId } = request.body;

      if (!candidateId) {
        throw new HttpException('Missing candidateId', HttpStatus.BAD_REQUEST);
      }

      // Fetch candidate details using graphql
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { eq: candidateId } } },
      });

      const candidateResponse = await axiosRequest(graphqlQueryObj, apiToken);
      const candidateNode =
        candidateResponse?.data?.data?.candidates?.edges.filter(
          (edge) => edge.node.id === candidateId,
        )[0]?.node;

      if (!candidateNode) {
        throw new HttpException('Candidate not found', HttpStatus.NOT_FOUND);
      }
      const personId = candidateNode?.people?.id;

      console.log('personId:', personId);
      console.log('candidateNode:', candidateNode);
      const personObj = await new FilterCandidates(
        this.workspaceQueryService,
      ).getPersonDetailsByPersonId(personId, apiToken);

      console.log('personObj:', personObj);
      
      if (!personObj) {
        throw new HttpException(
          'Person details not found',
          HttpStatus.NOT_FOUND,
        );
      }

      console.log('personObj:', personObj);
      const chatControl: ChatControlsObjType = {
        chatControlType: 'startChat',
      };

      await new ToolCallsProcessing(
        this.workspaceQueryService,
      ).shareJDtoCandidate(
        personObj,
        candidateNode.jobs,
        chatControl,
        apiToken,
      );

      return { status: 'Success', message: 'JD shared successfully' };
    } catch (error) {
      console.error('Error sharing JD:', error);
      throw new HttpException(
        error.message || 'Failed to share JD',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
