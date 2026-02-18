import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import {
  CandidateEdge,
  CandidateNode,
  ChatControlsObjType,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  graphqlToUpdateWhatsappMessageId,
  Job,
  MessageNode,
  PersonNode,
  whatappUpdateMessageObjType
} from 'twenty-shared';

import { PageInfo } from 'cloudflare/core';
import { CandidateEngagementArx } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { EngagedCandidateQueueService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/engaged-candidate-queue.service';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { HumanLikeLLM } from 'src/engine/core-modules/arx-chat/services/llm-agents/human-or-bot-classification';
import { ToolCallsProcessing } from 'src/engine/core-modules/arx-chat/services/llm-agents/tool-calls-processing';
import { MessagingControls } from 'src/engine/core-modules/arx-chat/services/messaging-controls';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import {
  formatChat
} from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('arx-chat')
export class ArxChatEndpoint {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly candidateEngagementArx: CandidateEngagementArx,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly engagedCandidateQueueService: EngagedCandidateQueueService,
    private readonly updateChat: UpdateChat,
    private readonly messagingControls: MessagingControls,
  ) {}

  @Post('start-chat')
  @UseGuards(JwtAuthGuard)
  async startChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const candidateId = request.body.candidateId;
    
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };
    
    // Step 1: Set startChat to true
    const response = await this.candidateEngagementArx.createChatControl(
      candidateId,
      chatControl,
      apiToken
    );

    console.log('Response from create start-Chat api', response);

    // Step 2: Create an incoming message to set engagementStatus to true
    // This simulates the candidate sending a message like "Hi" to start the engagement
    try {
      await this.updateChat.createInterimChatQueue(
        'startChat', // Simple greeting to start the conversation
        candidateId,
        apiToken
      );
      
      console.log('Successfully created interim chat message for candidate', candidateId);
    } catch (error) {
      console.error('Error creating interim chat message:', error);
      // Don't throw here as the main startChat operation was successful
    }

    return { status: 'Success', message: 'Chat started and engagement enabled' };
  }

  @Post('start-chat-queue')
  @UseGuards(JwtAuthGuard)
  async startChatQueue(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const candidateId = request.body.candidateId;
    
    // Queue the candidate for engagement processing with all operations moved to worker
    // This includes createChatControl and createInterimChat operations
    try {
      await this.updateChat.createInterimChatQueue(
        'startChat', // Simple greeting to start the conversation
        candidateId,
        apiToken
      );
      
      console.log('Successfully queued candidate for start chat processing', candidateId);
    } catch (error) {
      console.error('Error queuing candidate for start chat processing:', error);
      throw error;
    }

    return { status: 'Success', message: 'Candidate queued for start chat processing' };
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
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateIds = request.body.candidateIds;
    console.log('candidateIds', candidateIds);
    console.log('Number of candidate Ids to start chats', candidateIds.length);
    
    // Collect candidate data for Google Contacts creation
    const candidateDataForGoogleContacts: any[] = [];
    let candidateJob: Job | null = null;
    
    for (const candidateId of candidateIds) {
      try {
        // Step 1: Set startChat to true
        const chatControl: ChatControlsObjType = {
          chatControlType: 'startChat',
        };
        await this.candidateEngagementArx.createChatControl(
          candidateId,
          chatControl,
          apiToken
        );

        // Step 2: Create an incoming message to set engagementStatus to true
        await this.updateChat.createInterimChatQueue(
          'startChat', // Simple greeting to start the conversation
          candidateId,
          apiToken
        );
        
        // Step 3: Collect candidate data for Google Contacts (if not already collected)
        if (candidateDataForGoogleContacts.length === 0) {
          try {
            const candidateData = await new FilterCandidates(
              this.workspaceQueryService,
              this.staticGraphQLService,
            ).getCandidateDetailsById(candidateId, apiToken);
            
            if (candidateData) {
              candidateJob = candidateData.jobs;
              candidateDataForGoogleContacts.push(candidateData);
            }
          } catch (error) {
            console.warn(`Failed to fetch candidate data for Google Contacts: ${candidateId}`, error);
          }
        }
        
        console.log('Successfully started chat and engagement for candidate', candidateId);
      } catch (error) {
        console.error(`Error starting chat for candidate ${candidateId}:`, error);
        // Continue with next candidate even if this one fails
      }
    }
    
    // Step 4: Queue candidates for Google Contacts creation
    if (candidateDataForGoogleContacts.length > 0 && candidateJob) {
      try {
        await this.engagedCandidateQueueService.queueCandidatesForGoogleContacts(
          candidateDataForGoogleContacts,
          candidateJob,
          apiToken
        );
        console.log(`Queued ${candidateDataForGoogleContacts.length} candidates for Google Contacts creation`);
      } catch (error) {
        console.error('Failed to queue candidates for Google Contacts creation:', error);
        // Don't fail the entire operation if Google Contacts creation fails
      }
    }
    
    return { status: 'Success', message: `Processed ${candidateIds.length} candidates` };
  }

  @Post('start-chats-queue-by-candidate-ids')
  async startChatsQueueByCandidateIds(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateIds = request.body.candidateIds;
    console.log('candidateIds', candidateIds);
    console.log('Number of candidate Ids to start chats queue', candidateIds.length);
    
    // Collect candidate data for Google Contacts creation
    const candidateDataForGoogleContacts: any[] = [];
    let candidateJob: Job | null = null;
    
    for (const candidateId of candidateIds) {
      try {
        // Queue the candidate for engagement processing with all operations moved to worker
        // This includes createChatControl and createInterimChat operations
        await this.updateChat.createInterimChatQueue(
          'startChat', // Simple greeting to start the conversation
          candidateId,
          apiToken
        );
        
        // Collect candidate data for Google Contacts (if not already collected)
        if (candidateDataForGoogleContacts.length === 0) {
          try {
            const candidateData = await new FilterCandidates(
              this.workspaceQueryService,
              this.staticGraphQLService,
            ).getCandidateDetailsById(candidateId, apiToken);
            
            if (candidateData) {
              candidateJob = candidateData.jobs;
              candidateDataForGoogleContacts.push(candidateData);
            }
          } catch (error) {
            console.warn(`Failed to fetch candidate data for Google Contacts: ${candidateId}`, error);
          }
        }
        
        console.log('Successfully queued chat and engagement for candidate', candidateId);
      } catch (error) {
        console.error(`Error queuing chat for candidate ${candidateId}:`, error);
        // Continue with next candidate even if this one fails
      }
    }
    
    // Queue candidates for Google Contacts creation
    if (candidateDataForGoogleContacts.length > 0 && candidateJob) {
      try {
        await this.engagedCandidateQueueService.queueCandidatesForGoogleContacts(
          candidateDataForGoogleContacts,
          candidateJob,
          apiToken
        );
        console.log(`Queued ${candidateDataForGoogleContacts.length} candidates for Google Contacts creation`);
      } catch (error) {
        console.error('Failed to queue candidates for Google Contacts creation:', error);
        // Don't fail the entire operation if Google Contacts creation fails
      }
    }
    
    return { status: 'Success', message: `Queued ${candidateIds.length} candidates for engagement processing` };
  }

  @Post('stop-chat')
  @UseGuards(JwtAuthGuard)
  async stopChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token

    const graphqlVariables = {
      idToUpdate: request.body.candidateId,
      input: {
        stopChat: true,
      },
    };


    const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariables, apiToken);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  @UseGuards(JwtAuthGuard)
  async fetchCandidateByPhoneNumber(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const phoneNumber = request.body.phoneNumber;

    console.log('called fetchCandidateByPhoneNumber for phone:', phoneNumber);
    const personObj : PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
      ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    const candidateId = personObj?.candidates?.edges?.[0]?.node?.id;
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

    const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariables, apiToken);

    console.log(
      'Response from create fetch-candidate-by-phone-number-start::',
      response.data,
    );

    return response.data;
  }

  // @Post('retrieve-chat-response')
  // @UseGuards(JwtAuthGuard)
  // async retrieve(@Req() request: any): Promise<object> {
  //   const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

  //   const personObj: PersonNode | undefined = await new FilterCandidates(
  //     this.workspaceQueryService,
  //     this.staticGraphQLService,
  //       ).getPersonDetailsByPhoneNumber(request.body.phoneNumberFrom, apiToken);

  //   try {
  //     const personCandidateNode = personObj?.candidates?.edges[0]?.node;
  //     const candidateJob = personCandidateNode?.jobs;
  //     // const messagesList = personCandidateNode?.whatsappMessages?.edges;
  //     const messagesList: MessageNode[] = await new FilterCandidates(
  //       this.workspaceQueryService,
  //       this.staticGraphQLService,
  //     ).fetchAllWhatsappMessages(personCandidateNode?.id as string, apiToken);
  //     let mostRecentMessageArr: ChatHistoryItem[] = new FilterCandidates(
  //       this.workspaceQueryService,
  //       this.staticGraphQLService,
  //     ).getMostRecentMessageFromMessagesList(messagesList);
  //     const isChatEnabled = false;

  //     if (mostRecentMessageArr?.length > 0) {
  //       const chatAgent: OpenAIArxMultiStepClient =
  //         new OpenAIArxMultiStepClient(personObj as PersonNode, this.workspaceQueryService, this.staticGraphQLService);
  //       const chatControl: ChatControlsObjType = {
  //         chatControlType: 'startChat',
  //       };

  //       mostRecentMessageArr =
  //         (await chatAgent.createCompletion(
  //           mostRecentMessageArr,
  //           candidateJob as Job,
  //           chatControl,
  //           apiToken,
  //           isChatEnabled,
  //         )) || [];

  //       return mostRecentMessageArr;
  //     }
  //   } catch (err) {
  //     return { status: err };
  //   }

  //   return { status: 'Failed' };
  // }

  @Post('start-interim-chat-prompt')
  @UseGuards(JwtAuthGuard)
  async startInterimChat(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const interimChat = request.body.interimChat;
    const candidateId = request.body.candidateId;

    console.log('called interimChat:', interimChat);
    await this.updateChat.createInterimChatQueue(
      interimChat,
      candidateId,
      apiToken,
    );

    return;
  }
  @Post('reset-messages-from-whatsapp')
  @UseGuards(JwtAuthGuard)
  async resetMessagesFromWhatsapp(@Req() request: any) {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, ''); // Assuming Bearer token
    const candidateIds = request.body.candidateIds;

    console.log('called resetMessagesFromWhatsapp:', candidateIds);
    for (const candidateId of candidateIds) {
    await this.updateChat.resetMessagesFromWhatsapp(
      candidateId,
      apiToken,
    ); 

    const graphqlVariablesStopChat = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
        engagementStatus: false,
      },
    };
    const responseStopChat = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariablesStopChat, apiToken);

    const graphqlVariablesStartChat = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
        engagementStatus: false,
      },
    };
    const responseStartChat = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, graphqlVariablesStartChat, apiToken);
    }


    return;
  }

  @Post('send-chat')
  @UseGuards(JwtAuthGuard)
  async sendChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    const messageToSend = request?.body?.messageToSend;
    const phoneNumber = request.body.phoneNumberTo;

    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);

    console.log('This is the chat reply:', messageToSend);
    const candidateJob: Job | undefined = personObj?.candidates?.edges[0]?.node?.jobs;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob as Job,
      apiToken,
    );

    console.log('Recruiter profile', recruiterProfile);
    const chatMessages =
      personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node?.whatsappMessages?.edges;
    let chatHistory = chatMessages?.[0]?.node?.messageObj || [];
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };
    chatHistory =
      personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    let messageTo:string = personObj?.phones?.primaryPhoneNumber?.length == 10
      ? '91' + personObj?.phones?.primaryPhoneNumber
    : personObj?.phones?.primaryPhoneNumber || '';
    if (personObj?.candidates?.edges[0]?.node?.messagingChannel == 'linkedin') {
      messageTo = personObj?.linkedinLink?.primaryLinkUrl || '';
    }
    else{
      messageTo = personObj?.phones?.primaryPhoneNumber?.length == 10
          ? '91' + personObj?.phones?.primaryPhoneNumber
          : personObj?.phones?.primaryPhoneNumber || '';
    }
    console.log("This is the messaging channel ::", personObj?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob?.id,
    )[0]?.node.messagingChannel)
    console.log("This is the whatsapp provider ::", personObj?.candidates?.edges.filter(
      (candidate) => candidate.node.jobs.id == candidateJob?.id,
    )[0]?.node.whatsappProvider)
      
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: personObj?.candidates?.edges?.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node as CandidateNode,
      candidateFirstName: personObj?.name?.firstName || '',
      phoneNumberFrom: recruiterProfile.phoneNumber,
      whatsappMessageType:
        personObj?.candidates?.edges.filter(
          (candidate) => candidate.node.jobs.id == candidateJob?.id,
        )[0]?.node.whatsappProvider ||
        'application03',
      phoneNumberTo: messageTo,
      messages: [{ content: request?.body?.messageToSend }],
      messageType: 'recruiterMessage',
      messageObj: chatHistory,
      lastEngagementChatControl: chatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
      typeOfMessage: personObj?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob?.id,
      )[0]?.node.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };

    // Use MessagingControls to send the message (handles all messaging channels)
    const candidateNode = personObj?.candidates?.edges?.filter(
      (candidate) => candidate.node.jobs.id == candidateJob?.id,
    )[0]?.node as CandidateNode;
    
    const candidateChatHistory = candidateNode?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    const candidateChatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };

    // Create a simple message object for MessagingControls
    const whatappUpdateMessageObjForSending: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: candidateNode,
      candidateFirstName: personObj?.name?.firstName || '',
      phoneNumberFrom: recruiterProfile.phoneNumber,
      whatsappMessageType: candidateNode?.whatsappProvider || 'application03',
      phoneNumberTo: messageTo,
      messages: [{ content: messageToSend }],
      messageType: 'botMessage',
      messageObj: candidateChatHistory,
      lastEngagementChatControl: candidateChatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
      typeOfMessage: candidateNode?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };

    // Use MessagingControls to send the message
    const sendResult = await new MessagingControls(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).sendWhatsappMessage(
      whatappUpdateMessageObjForSending,
      candidateNode,
      candidateJob as Job,
      candidateChatHistory,
      candidateChatControl,
      apiToken,
    );

    if (sendResult.status === 'failed') {
      return { status: 'failed', message: sendResult.message || 'Failed to send message' };
    }

    return { status: 'success' };
  }

  @Post('get-all-messages-by-candidate-id')
  @UseGuards(JwtAuthGuard)
  async getWhatsappMessagessByCandidateId(
    @Req() request: any,
  ): Promise<object[]> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateId = request.body.candidateId;
    const allWhatsappMessages = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllWhatsappMessages(candidateId, apiToken);

    return allWhatsappMessages;
  }

  @Post('get-all-messages-by-phone-number')
  @UseGuards(JwtAuthGuard)
  async getAllMessagesByPhoneNumber(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    console.log(
      'Going to get all messages by phone Number for :',
      request.body.phoneNumber,
    );
    const personObj: PersonNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByPhoneNumber(request.body.phoneNumber, apiToken);
    const candidateId: string | undefined = personObj?.candidates?.edges[0]?.node?.id;
    const allWhatsappMessages: MessageNode[] = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllWhatsappMessages(candidateId as string, apiToken);
    const formattedMessages = await formatChat(allWhatsappMessages);

    console.log(
      'All messages length:',
      allWhatsappMessages?.length,
      'for phone number:',
      request.body.phoneNumber,
    );

    return { formattedMessages: formattedMessages };
  }

  @Post('refresh-chat-status-by-candidates')
  @UseGuards(JwtAuthGuard)
  async countChats(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { candidateIds } = request.body;

      console.log('going to refresh chats');
      console.log('Fetching job IDs for candidates:', candidateIds);

      const jobIds = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).getJobIdsFromCandidateIds(candidateIds, apiToken);
      const results = await this.updateChat.processCandidatesChatsGetStatuses(apiToken, jobIds, candidateIds, "countChats");

      console.log(
        'Have received results and will try and update the sheets also from the controlelr',
      );
      await new GoogleSheetsService(
        this.staticGraphQLService,
      ).updateGoogleSheetsWithChatData(
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
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

    try {
      const { candidateIds } = request.body;

      console.log('going to refresh chat counts by candidate Ids');
      await this.updateChat.updateCandidatesWithChatCount(candidateIds, apiToken);

      return { status: 'Success' };
    } catch (err) {
      console.error('Error in refresh-chat-counts-by-candi chats:', err);

      return { status: 'Failed', error: err };
    }
  }

  @Post('test-arxena-connection')
  @UseGuards(JwtAuthGuard)
  async testArxenaConnection(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      console.log('going to test arxena connection');
      await this.updateChat.testArxenaConnection(
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



  @Get('get-person-chat')
  @UseGuards(JwtAuthGuard)
  async getCandidateAndChat(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateId = request.query.candidateId;
    const person: PersonNode | undefined  = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getPersonDetailsByCandidateId(candidateId, apiToken);
    const chatControl: ChatControlsObjType = {
      chatControlType: 'allStartedAndStoppedChats',
    };
    const allPeople: PersonNode[] | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
      ).fetchAllPeopleByPeopleIds([person?.id as string], apiToken);

    console.log('All people length:', allPeople?.length);

    return allPeople;
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
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');

      const personObj: PersonNode | undefined = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
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
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
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

        const responseOfDeliveryStatus = await this.staticGraphQLService.executeGraphQL(graphqlToUpdateWhatsappMessageId, variablesToUpdateDeliveryStatus, apiToken);

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

  @Post('share-jd-to-candidate')
  @UseGuards(JwtAuthGuard)
  async shareJDToCandidate(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const { candidateId } = request.body;

      if (!candidateId) {
        throw new HttpException('Missing candidateId', HttpStatus.BAD_REQUEST);
      }

      // Fetch candidate details using graphql
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { eq: candidateId } } },
      });

      const candidateResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, {
        filter: { id: { eq: candidateId } },
      }, apiToken);

      const candidates = candidateResponse?.data?.data?.candidates as {   
        edges: CandidateEdge[];
        pageInfo: PageInfo;
      } | undefined;

      const candidateNode =
        candidates?.edges[0]?.node;

      if (!candidateNode) {
        throw new HttpException('Candidate not found', HttpStatus.NOT_FOUND);
      }
      const personId = candidateNode?.people?.id;

      console.log('personId:', personId);
      console.log('candidateNode:', candidateNode);
      const personObj = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
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
        this.staticGraphQLService, 
      ).shareJDtoCandidate(
        candidateNode,
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

  @Post('send-baileys-message-to-self')
  @UseGuards(JwtAuthGuard)
  async sendBaileysMessageToSelf(@Req() request: any): Promise<object> {
    try {
      const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
      const origin = request.headers.origin;
      
      // Import the BaileysWhatsappAPI class
      const { BaileysWhatsappAPI } = await import('../services/whatsapp-api/baileys/callBaileys');
      
      // Create instance of BaileysWhatsappAPI
      const baileysAPI = new BaileysWhatsappAPI(
        this.workspaceQueryService,
        this.staticGraphQLService,
      );

      // Get recruiter profile to get the actual phone number
      const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileFromCurrentUser(apiToken, origin);
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      console.log('recruiterProfile', recruiterProfile);
      
      if (!recruiterProfile?.phoneNumber) {
        throw new HttpException('Recruiter phone number not found', HttpStatus.BAD_REQUEST);
      }

      // Create a simple message object for sending text message
      const sendTextMessageObj = {
        phoneNumberFrom: recruiterProfile.phoneNumber,
        phoneNumberTo: recruiterProfile.phoneNumber,
        messages: 'This is a sample test message from Arxena API'
      };

      // Create a minimal mock candidate for the API call
      const mockCandidate = {
        id: 'test-candidate-id',
        name: 'Test Candidate',
        jobs: {
          id: 'test-job-id',
          title: 'Test Job',
          company: { name: 'Test Company' },
          recruiterId: currentUser?.workspaceMember?.id
        }
      } as any;

      // Call the simpler sendWhatsappTextMessageViaBaileys function
      const response = await baileysAPI.sendWhatsappTextMessageViaBaileys(
        sendTextMessageObj,
        mockCandidate,
        apiToken,
      );

      console.log('Baileys API response:', response);

      return { status: 'success', message: 'Sample Baileys message sent successfully' };
    } catch (error) {
      console.error('Error sending sample Baileys message:', error);
      throw new HttpException(
        error.message || 'Failed to send sample Baileys message',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('send-chat-candidate-id')
  @UseGuards(JwtAuthGuard)
  async sendChatCandidateId(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const messageToSend = request?.body?.messageToSend;
    const candidateId = request.body.candidateId;
    const sendResult = await this.messagingControls.sendMessageToCandidateById(
      candidateId,
      messageToSend,
      apiToken,
    );
    if (sendResult.status === 'failed') {
      return { status: 'failed', message: sendResult.message };
    }
    return { status: 'success' };
  }

  @Post('send-bulk-chats-by-candidate-ids')
  async sendBulkChatsByCandidateIds(@Req() request: any): Promise<object> {
    const apiToken = request.headers.authorization.split(' ')[1].replace(/[\r\n]+/g, '');
    const candidateIds = request.body.candidateIds;
    for (const candidateId of candidateIds) {
      await this.messagingControls.sendMessageToCandidateById(
        candidateId,
        request.body.messageToSend,
        apiToken,
      );
    }
    return { status: 'Success' };
  }
}