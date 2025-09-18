import {
  BaileysIncomingMessage,
  CandidateNode,
  chatMessageType,
  emptyCandidateProfileObj,
  graphqlQueryToCreateOneNewWhatsappMessage,
  graphqlToFetchWhatsappMessageByWhatsappId,
  graphQlToFetchWhatsappMessages,
  graphqlToUpdateWhatsappMessageId,
  Job,
  whatappUpdateMessageObjType,
  WhatsAppBusinessAccount
} from 'twenty-shared';
import { EntityManager } from 'typeorm';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { FacebookWhatsappChatApi } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { EngagedCandidateJobData } from 'src/engine/core-modules/cron-processes/services/engaged-candidate-processor.job';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { v4 as uuidv4 } from 'uuid';
import { RecruiterProfileService } from '../recruiter-profile';

interface MessageResult {
  token: string;
  lastMessageTime: Date;
  workspaceId: string;
}

interface ApiTokenResult {
  token: string;
  workspaceId: string;
}

export class IncomingWhatsappMessages {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly engagedCandidateMessageQueueService?: MessageQueueService,
    ) {}

  async queueCandidateForEngagement(
    candidateId: string,
    workspaceId: string,
    messageId?: string,
  ): Promise<void> {
    if (!this.engagedCandidateMessageQueueService) {
      console.warn(`Message queue service not available, skipping queue for candidate ${candidateId}`);
      return;
    }

    try {
      const jobData: EngagedCandidateJobData = {
        candidateId,
        workspaceId,
        timestamp: Date.now(),
        messageId,
      };

      await this.engagedCandidateMessageQueueService.add<EngagedCandidateJobData>(
        'EngagedCandidateProcessor',
        jobData,
        {
          priority: 1,
          id: `engaged-candidate-${candidateId}-${Date.now()}`,
        },
      );

      console.log(`Queued candidate ${candidateId} for engagement processing`);
    } catch (error) {
      console.error(`Failed to queue candidate ${candidateId} for engagement:`, error);
    }
  }

  async receiveIncomingMessages(
    requestBody: BaileysIncomingMessage,
    apiToken: string,
  ) {
    console.log('This is requestBody in receiveIncomingMessages::', requestBody);
    let savedMessage;

    if (requestBody.message == '') {
      savedMessage = 'Attachment Received';
    } else {
      savedMessage = requestBody.message;
    }
    console.log('Saved message is ::', savedMessage);

    const whatsappIncomingMessage: chatMessageType = {
      phoneNumberFrom: requestBody.phoneNumberFrom,
      phoneNumberTo: requestBody.phoneNumberTo,
      messages: [{ role: 'user', content: savedMessage }],
      messageType: 'string',
    };
    const chatReply = savedMessage;
    const status = '';

    console.log(
      'We will first go and get the candiate who sent us the message',
    );
    const candidateProfileData = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateInformation(whatsappIncomingMessage, apiToken);
    const candidateJob: Job = candidateProfileData.jobs;

    console.log(
      'This is the candiate who has sent us the message fromBaileys., we have to update the database that this message has been recemivged::',
      chatReply,
    );
    if (candidateProfileData != emptyCandidateProfileObj) {
      // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
      await this.createAndUpdateIncomingCandidateChatMessage(
        {
          chatReply: savedMessage,
          whatsappDeliveryStatus: 'delivered',
          phoneNumberFrom: requestBody.phoneNumberFrom,
          whatsappMessageId: requestBody.baileysMessageId,
        },
        candidateProfileData,
        candidateJob,
        apiToken,
      );
    } else {
      console.log(
        'Message has been received from a candidate however the candidate is not in the database',
      );
    }
  }

  async receiveIncomingMessagesFromSelfFromBaileys(
    requestBody: BaileysIncomingMessage,
    apiToken: string,
  ) {
    // console.log('This is requestBody::', requestBody);
    console.log('-------This is the self message-------------');
    const whatsappIncomingMessage: chatMessageType = {
      phoneNumberFrom: requestBody.phoneNumberFrom,
      phoneNumberTo: requestBody.phoneNumberTo,
      messages: [{ role: 'assistant', content: requestBody.message }],
      messageType: 'messageFromSelf',
    };
    console.log("whatsappIncomingMessage with message from self :::", requestBody.message);
    const chatReply = requestBody.message;

    console.log(
      'We will first go and get the candiate who sent us the message',
    );
    const candidateProfileData = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateInformation(whatsappIncomingMessage, apiToken);
    const candidateJob: Job = candidateProfileData.jobs;

    console.log(
      'This is the SELF message., we have to update the database that this message has been received::',
      chatReply,
    );

    if (candidateProfileData != emptyCandidateProfileObj) {
      // Fetch all existing messages for this candidate
      const existingMessages = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).fetchAllWhatsappMessages(candidateProfileData.id, apiToken);

      // Check if this message already exists
      const isDuplicate = existingMessages.some(msg => {
        const messageMatches = msg.message === chatReply;
        // Check both combinations of sender/recipient since they can be inverted for self messages
        // console.log("msg.phoneFrom", msg.phoneFrom);
        // console.log("msg.phoneTo", msg.phoneTo);
        // console.log("requestBody.phoneNumberFrom", requestBody.phoneNumberFrom);
        // console.log("requestBody.phoneNumberTo", requestBody.phoneNumberTo);
        const participantsMatch = (
          (msg.phoneFrom === requestBody.phoneNumberFrom.replace("+", "") && msg.phoneTo === requestBody.phoneNumberTo.replace("+", "")) ||
          (msg.phoneFrom === requestBody.phoneNumberTo.replace("+", "") && msg.phoneTo === requestBody.phoneNumberFrom.replace("+", ""))
        );
        console.log("messageMatches", messageMatches);
        console.log("participantsMatch", participantsMatch);
        return messageMatches && participantsMatch;
      });

      if (isDuplicate) {
        console.log('Message already exists in database (including inverted sender/recipient), skipping processing');
        return;
      }

      await this.createAndUpdateIncomingCandidateChatMessage(
        {
          chatReply: chatReply,
          whatsappDeliveryStatus: 'delivered',
          phoneNumberFrom: requestBody.phoneNumberFrom,
          whatsappMessageId: requestBody.baileysMessageId,
          messageType: 'messageFromSelf',
          isFromMe: true,
        },
        candidateProfileData,
        candidateJob,
        apiToken,
      );

      new UpdateChat(
        this.workspaceQueryService,
        this.staticGraphQLService,
        ).setCandidateEngagementStatusToFalse(candidateProfileData.id, apiToken);
    
      } else {
      console.log(
        'Message has been received from a candidate however the candidate is not in the database',
      );
    }
  }

  isWithinLast5Minutes(unixTimestamp) {
    const currentTime = Math.floor(Date.now() / 1000);
    const providedTime = parseInt(unixTimestamp, 10);
    const differenceInSeconds = currentTime - providedTime;

    return differenceInSeconds < 300;
  }

  async fetchWhatsappMessageById(messageId: string, apiToken: string) {
    console.log('This is the message id:', messageId);
    try {
      const whatsappMessageVariable = {
        whatsappMessageId: messageId,
      };
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchWhatsappMessageByWhatsappId, whatsappMessageVariable, apiToken);

      console.log('Response from fetchWhatsappMessageById:', response?.data);

      return response?.data.data.whatsappMessage?.message || '';
    } catch (error) {
      console.log('Error fetching whatsapp message by id:', error);

      return { error: error };
    }
  }

  async getApiKeyToUseFromPhoneNumberMessageReceived(
    requestBody: WhatsAppBusinessAccount,
    messageData?: any,
    transactionManager?: EntityManager,
  ): Promise<ApiTokenResult | null> {

    console.log("Going to get api token to use from phone number message received");
    let incomingSenderIdentifierId =
      requestBody?.entry[0]?.changes[0]?.value?.messages?.[0]?.from ||
      requestBody?.entry[0]?.changes[0]?.value?.statuses[0].recipient_id;

    console.log("This is the incomingSenderIdentifierId::", incomingSenderIdentifierId);
    const incomingRecipientIdentifierId =
      requestBody?.entry[0]?.changes[0]?.value.metadata?.phone_number_id;
    console.log("This is the incomingRecipientIdentifierId::", incomingRecipientIdentifierId);
    // const waId = requestBody?.entry[0]?.changes[0]?.value?.contacts?.[0]?.wa_id;
    console.log("This is the requestBody in api key to use from phone number message received::", requestBody);

    console.log(
      'This is the phone number to use and search:',
      incomingSenderIdentifierId,
    );

    // Extract WhatsApp message ID for duplicate detection
    const whatsappMessageId = requestBody?.entry[0]?.changes[0]?.value?.messages?.[0]?.id;
    const messageBody = requestBody?.entry[0]?.changes[0]?.value?.messages?.[0]?.text?.body;

    const results =
      await this.workspaceQueryService.executeQueryAcrossWorkspaces(
        async (workspaceId, dataSourceSchema) => {
          console.log('Data source schema is::', dataSourceSchema);
          console.log('id:', workspaceId);
          let rawQuery = '';
          if (
            incomingRecipientIdentifierId.includes('linkedin')
          ) {
            console.log( 'This is a linkedin phone number, we will not use this phone number to send messages to setup linkedin url as recipient id for api key finding' );
            rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND linkedin_url ILIKE '%${incomingRecipientIdentifierId}%'`;
          } else {
            rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND facebook_whatsapp_phone_number_id ILIKE '%${incomingRecipientIdentifierId}%'`;
          }

          console.log('This si rawQuery:', rawQuery);
          const workspace = await this.workspaceQueryService.executeRawQuery(
            rawQuery,
            [workspaceId],
            workspaceId,
          );

          if (workspace.length === 0) {
            console.log("Workspace length is 0 for facebook whatsapp phone number id");

            rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND whatsapp_web_phone_number ILIKE '%${incomingRecipientIdentifierId}%'`;

            const workspace = await this.workspaceQueryService.executeRawQuery(
              rawQuery,
              [workspaceId],
              workspaceId,
            );

            if (workspace.length === 0) {
              rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND whatsapp_web_phone_number ILIKE '%${incomingSenderIdentifierId}%'`;
              const workspace = await this.workspaceQueryService.executeRawQuery(
                rawQuery,
                [workspaceId],
                workspaceId,
              );
              if (workspace.length === 0) {
                console.log("Workspace length is 0 for whatsapp web phone number");
                return null;
              }
              else{
                console.log("It is a self message, so we will use the incomingRecipientIdentifierId");
                incomingSenderIdentifierId = incomingRecipientIdentifierId
              }
              console.log("Workspace found for whatsapp web phone number::", workspace);
            }
          }

          console.log(
            'Whatsapp incoming incomingSenderIdentifierId::::',
            incomingSenderIdentifierId,
          );

          if (incomingSenderIdentifierId.includes('linkedin')) {
            console.log(
              'This is a linkedin phone number, we will not use this phone number to send messages',
            );
          }
          let recentMessageQuery = '';

          if (incomingSenderIdentifierId.includes('linkedin')) {
            recentMessageQuery = `SELECT * FROM ${dataSourceSchema}."_whatsappMessage" 
             WHERE ("_whatsappMessage"."phoneFrom" ILIKE '%${incomingSenderIdentifierId}%' OR "_whatsappMessage"."phoneTo" ILIKE '%${incomingSenderIdentifierId}%')
             ORDER BY "updatedAt" DESC
             LIMIT 1`;
          } else {
            recentMessageQuery = `SELECT * FROM ${dataSourceSchema}."_whatsappMessage" 
            WHERE ("_whatsappMessage"."phoneFrom" ILIKE '%${incomingSenderIdentifierId}%' OR "_whatsappMessage"."phoneTo" ILIKE '%${incomingSenderIdentifierId}%')
            ORDER BY "updatedAt" DESC
            LIMIT 1`;
          }
          console.log("Recent message query and message data::", recentMessageQuery, messageData);

          const recentMessage =
            await this.workspaceQueryService.executeRawQuery(
              recentMessageQuery,
              [],
              workspaceId,
            );

          console.log('recentMessage::', recentMessage);

          // Check if current message matches any recent message
          if (recentMessage.length > 0 && messageData) {
            const isMessageDuplicate = recentMessage.some(msg => {
              const messageMatches = msg.message === messageData?.body;
              const senderMatches = msg.phoneFrom === messageData?.from?.replace('@c.us', '') || 
                                  msg.phoneTo === messageData?.from?.replace('@c.us', '');
              const recipientMatches = msg.phoneFrom === messageData?.to?.replace('@c.us', '') || 
                                     msg.phoneTo === messageData?.to?.replace('@c.us', '');
              
              return messageMatches && senderMatches && recipientMatches;
            });

            if (isMessageDuplicate) {
              console.log('Message already exists in database, skipping processing');
              return null;
            }
          }

          if (recentMessage.length === 0) {
            console.log(
              'No messages found for this phone number in workspace so will return because incoming not worth it:',
              workspaceId,
            );

            return null;
          }

          if (
            incomingSenderIdentifierId.length > 10 &&
            !incomingSenderIdentifierId.includes('linkedin')
          ) {
            incomingSenderIdentifierId = incomingSenderIdentifierId.slice(-10);
          }

          let personQuery = '';

          if (!incomingSenderIdentifierId.includes('linkedin')) {
            personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."phonesPrimaryPhoneNumber" ILIKE '%${incomingSenderIdentifierId}%'`;
          } else {
            personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."linkedinLinkPrimaryLinkUrl" ILIKE '%${incomingSenderIdentifierId}%'`;
          }

          const person = await this.workspaceQueryService.executeRawQuery(
            personQuery,
            [],
            workspaceId,
          );

          if (person.length > 0) {
            const apiKeys = await this.workspaceQueryService.getApiKeys(
              workspaceId,
              dataSourceSchema,
              transactionManager,
            );

            if (apiKeys && apiKeys.length > 0) {
              const apiKeyToken =
                await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
                  workspaceId,
                  apiKeys[0].id,
                );

              console.log('This is the api key token::', apiKeyToken);

              if (apiKeyToken) {
                return {
                  token: apiKeyToken.token,
                  lastMessageTime: recentMessage[0].updatedAt,
                  workspaceId,
                } as MessageResult;
              }
            }
          }

          return null;
        },
      );

    // console.log("All results:", results);

    // Filter out null results and find the workspace with the most recent message
    const validResults = results.filter(
      (result): result is MessageResult => result !== null,
    );

    if (validResults.length === 0) return null;

    // Sort by lastMessageTime in descending order and take the first result
    const sortedResults = validResults.sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() -
        new Date(a.lastMessageTime).getTime(),
    );
    const sortedResultsToken = sortedResults[0]?.token ?? null;
    const sortedResultsWorkspaceId = sortedResults[0]?.workspaceId ?? null;

    console.log('sortedResultsToken::', sortedResultsToken);
    console.log('sortedResultsWorkspaceId::', sortedResultsWorkspaceId);

    if (sortedResultsToken && sortedResultsWorkspaceId) {
      return {
        token: sortedResultsToken,
        workspaceId: sortedResultsWorkspaceId
      };
    }

    return null;
  }

  async receiveIncomingMessagesFromFacebook(
    requestBody: WhatsAppBusinessAccount,
    messageData?: any,
  ) {
    console.log(
      'This is requestBody from Facebook::',
      JSON.stringify(requestBody),
    );
    // to check if the incoming message is the status of the message
    // have to use system API Key and get the status updates of all the workspaces where the phone number resides. Then get the api keys of the workspaces and then update the messages
    const apiTokenResult =
      await this.getApiKeyToUseFromPhoneNumberMessageReceived(requestBody, messageData);

    if (apiTokenResult === null) {
      console.log('NO API KEY FOUND FOR THIS PHONE NUMBER FUCK!!!!');

      return;
    }
    
    const apiToken = apiTokenResult.token;
    const workspaceId = apiTokenResult.workspaceId;
    
    console.log(
      'This is the apiToken to use in receiving facebook messages:',
      apiToken,
    );
    console.log(
      'This is the workspaceId to use in receiving facebook messages:',
      workspaceId,
    );
    if (
      requestBody?.entry[0]?.changes[0]?.value?.statuses &&
      requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status &&
      !requestBody?.entry[0]?.changes[0]?.value?.messages
    ) {
      console.log(
        'This is the status message::',
        requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status,
      );
      const messageId =
        requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.id;

      console.log('This ishte message id:', messageId);
      const messageStatus =
        requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status;

      console.log('This is the message statuse:', messageStatus);
      const variables = {
        filter: { whatsappMessageId: { ilike: `%${messageId}%` } },
        orderBy: { position: 'AscNullsFirst' },
      };
      const graphqlQueryObj = JSON.stringify({
        query: graphQlToFetchWhatsappMessages,
        variables: variables,
      });
      const response = await this.staticGraphQLService.executeGraphQL(graphQlToFetchWhatsappMessages, variables, apiToken);

      console.log(
        '-----------------This is the response from the query to find the message by WAMID::-------------------',
      );
      // debugger
      console.log(
        'Response to query on who sent the messages::',
        response?.data?.data,
      );

      if (response?.data?.data?.whatsappMessages?.edges.length === 0) {
        console.log('No message found with the given WAMID');

        return;
      }

      if (
        response?.data?.data?.whatsappMessages?.edges[0]?.node
          ?.whatsappDeliveryStatus === 'read' ||
        (response?.data?.data?.whatsappMessages?.edges[0]?.node
          ?.whatsappDeliveryStatus === 'delivered' &&
          messageStatus !== 'read')
      ) {
        console.log(
          'Message has already been read/delivered, skipping the update',
        );

        return;
      }
      console.log(
        'Will try and do a delivery status update now:: ',
        response?.data?.data?.whatsappMessages?.edges[0]?.node?.id,
        'with delivery satatus::',
        messageStatus,
      );
      const variablesToUpdateDeliveryStatus = {
        idToUpdate: response?.data?.data?.whatsappMessages?.edges[0]?.node?.id,
        input: { whatsappDeliveryStatus: messageStatus },
      };
  
      const responseOfDeliveryStatus = await this.staticGraphQLService.executeGraphQL(graphqlToUpdateWhatsappMessageId, variablesToUpdateDeliveryStatus, apiToken);
      // console.log("This is the response of the delivery status update::", responseOfDeliveryStatus);

      console.log(
        '---------------DELIVERY STATUS UPDATE DONE-----------------------',
      );
      // console.log(responseOfDeliveryStatus);
    } else if (requestBody?.entry[0]?.changes[0]?.value?.messages?.length > 0) {
      // to check if the incoming message is the message
      console.log(
        'There is a request body for sure',
        requestBody?.entry[0]?.changes[0]?.value?.messages[0],
      );
      const userMessageBody =
        requestBody?.entry[0]?.changes[0]?.value?.messages[0];
      let chatReply = '';
      let whatsappMessageCommentedOn = '';

      console.log('Message:', userMessageBody?.text?.body, 
        'To:', requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number,
        'From:', userMessageBody?.from,
        'Name:', requestBody?.entry[0]?.changes[0]?.value?.contacts?.[0]?.profile?.name);
      if (userMessageBody) {
        const timestamp =
          requestBody?.entry[0]?.changes[0]?.value?.messages[0].timestamp; // Assuming this is the Unix timestamp in seconds
        const result = this.isWithinLast5Minutes(timestamp);

        if (!result) {
          console.log('MESSAGE IS NOT WITHIN 5 MINUTES:::: ', userMessageBody);

          return;
        }

        // Additional duplicate check using WhatsApp message ID
        const whatsappMessageId = userMessageBody?.id;
        const messageBody = userMessageBody?.text?.body;
        
        if (whatsappMessageId && messageBody) {
          // Check if this message already exists in the current workspace
          const dataSourceSchema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
          const duplicateCheckQuery = `SELECT id FROM ${dataSourceSchema}."_whatsappMessage" 
            WHERE "whatsappMessageId" = $1 AND "message" = $2 LIMIT 1`;
          
          try {
            const duplicateResult = await this.workspaceQueryService.executeRawQuery(
              duplicateCheckQuery,
              [whatsappMessageId, messageBody],
              workspaceId,
            );
            
            if (duplicateResult.length > 0) {
              console.log('Message already exists in current workspace, skipping processing. Message ID:', whatsappMessageId);
              return;
            }
          } catch (error) {
            console.log('Error checking for duplicates, continuing with processing:', error);
          }
        }
        // if (userMessageBody.reaction){
        //   console.log("This is a reaction message", userMessageBody.reaction.emoji)
        //   console.log("its likely an emoji message or emoji reaction to precededing message")
        //   const whatsappMessageCommentedOn = await this.fetchWhatsappMessageById(userMessageBody?.reaction?.message_id,apiToken);
        //   console.log("this is the messages commented on ::", whatsappMessageCommentedOn)
        //   if (!userMessageBody.reaction.emoji){
        //     console.log("This is a reaction message without an emoji")
        //     chatReply = "Removed emoji " + " from " + "'" + whatsappMessageCommentedOn + "'" || "";
        //   }
        //   const messageToAppend = 'Reacted ' + userMessageBody.reaction.emoji + ' to ' + "'" + whatsappMessageCommentedOn + "'" || '';
        //   chatReply = messageToAppend || ""
        // }

        // console.log('There is a usermessage body in the request', userMessageBody);
        if (
          requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !==
            'utility' &&
          requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !==
            'document' &&
          requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== 'audio'
        ) {
          // debugger
          console.log(
            'We have a whatsapp incoming message which is a text one we have to do set of things with which is not a utility message',
          );
          chatReply = userMessageBody?.text?.body || '';
          if (
            !userMessageBody?.text?.body &&
            userMessageBody.reaction.message_id
          ) {
            console.log(
              'There is not chat body and we have a reaction id, so we will fetch based on the reaction',
            );
            whatsappMessageCommentedOn = await this.fetchWhatsappMessageById(
              userMessageBody?.reaction?.message_id,
              apiToken,
            );
            if (
              typeof whatsappMessageCommentedOn === 'object' &&
              whatsappMessageCommentedOn !== null &&
              'error' in whatsappMessageCommentedOn
            ) {
              console.log('Error in fetching the message commented on');
              whatsappMessageCommentedOn = 'Message commented on not found';
            }
            console.log(
              'this is the messages commented on ::',
              whatsappMessageCommentedOn,
            );

            console.log(
              'its likely an emoji message or emoji reaction to precededing message',
            );
            console.log(
              'its likely an emoji message or userMessageBody.reaction.from',
              userMessageBody?.reaction?.from,
            );
            console.log(
              'its likely an emoji message or userMessageBody.reaction.from',
              userMessageBody?.reaction?.message_id,
            );
            console.log(
              'Emoji message:',
              userMessageBody.reaction.emoji,
              'to message id:',
              userMessageBody.reaction.message_id,
              'from ::',
              userMessageBody.reaction.from,
            );
            // Adhoc setting chatReply to emoji. lets see how it goes.
            if (!userMessageBody.reaction.emoji) {
              console.log('This is a reaction message without an emoji');
              chatReply =
                'Removed emoji ' +
                  ' from ' +
                  "'" +
                  whatsappMessageCommentedOn +
                  "'" || '';
            } else {
              chatReply =
                'Reacted ' +
                  userMessageBody.reaction.emoji +
                  ' to ' +
                  "'" +
                  whatsappMessageCommentedOn +
                  "'" || '';
            }
            console.log('This is the chatReply', chatReply);
          }
          const phoneNumberTo =
            requestBody?.entry[0]?.changes[0]?.value?.metadata
              ?.display_phone_number;

          if (userMessageBody.from === '1234567890') {
            console.log(
              'This is a cron test to check if the connection exists or not',
            );

            return;
          }
          const whatsappIncomingMessage: chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: chatReply || '' }],
            messageType: 'string',
          };
          console.log( 'We will first go and get the candiate who sent us the message', );
          const candidateProfileData = await new FilterCandidates(
            this.workspaceQueryService,
            this.staticGraphQLService,
          ).getCandidateInformation(whatsappIncomingMessage, apiToken);
          const candidateJob: Job = candidateProfileData.jobs;

          console.log( 'This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::', chatReply, );
          console.log( 'This is the candiate who has sent us candidateProfileData::', candidateProfileData, );
          const replyObject = {
            chatReply: chatReply,
            whatsappDeliveryStatus: 'receivedFromCandidate',
            phoneNumberFrom: userMessageBody.from,
            whatsappMessageId:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.id,
          };

          const responseAfterMessageUpdate =
            await this.createAndUpdateIncomingCandidateChatMessage(
              replyObject,
              candidateProfileData,
              candidateJob,
              apiToken,
            );

          if (candidateProfileData?.candidateReminders?.edges.length > 0) {
            console.log( 'Candidate reminder found, updating the reminder status to false', );
            const listOfReminders =
              candidateProfileData?.candidateReminders?.edges;
            const updateOneReminderVariables = {
              idToUpdate: listOfReminders[0]?.node?.id,
              input: { isReminderActive: false },
            };
            const graphqlQueryObj = JSON.stringify({
              query: graphqlQueryToCreateOneNewWhatsappMessage,
              variables: updateOneReminderVariables,
            });
          }

          console.log( 'Graphqlreqsponse after message update', responseAfterMessageUpdate, );
        } else if (
          requestBody?.entry[0]?.changes[0]?.value?.messages[0].type ===
          'document'
        ) {
          const sendTemplateMessageObj = {
            documentId:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0].document.id,
            filename:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0].document
                .filename,
            mime_type:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0].document
                .mime_type,
          };
          const phoneNumberTo =
            requestBody?.entry[0]?.changes[0]?.value?.metadata
              ?.display_phone_number;

          const whatsappIncomingMessage: chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: '' }],
            messageType: 'string',
          };

          const replyObject = {
            chatReply: chatReply || 'Attachment Received',
            whatsappDeliveryStatus: 'receivedFromCandidate',
            phoneNumberFrom: whatsappIncomingMessage.phoneNumberFrom,
            whatsappMessageId:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0].id,
          };
          const candidateProfileData = await new FilterCandidates(
            this.workspaceQueryService,
            this.staticGraphQLService,
          ).getCandidateInformation(whatsappIncomingMessage, apiToken);
          const candidateJob: Job = candidateProfileData.jobs;

          await new FacebookWhatsappChatApi(
            this.workspaceQueryService,
            this.staticGraphQLService,
          ).downloadWhatsappAttachmentMessage(
            sendTemplateMessageObj,
            candidateProfileData,
            apiToken,
          );
          await this.createAndUpdateIncomingCandidateChatMessage(
            replyObject,
            candidateProfileData,
            candidateJob,
            apiToken,
          );
        }
        // Audio message
        else if (
          requestBody?.entry[0]?.changes[0]?.value?.messages[0].type === 'audio'
        ) {
          const audioMessageObject = {
            audioId:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.id,
            filename:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.id +
              '.ogg',
            mime_type:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio
                ?.mime_type,
          };
          const phoneNumberTo =
            requestBody?.entry[0]?.changes[0]?.value?.metadata
              ?.display_phone_number;

          const whatsappIncomingMessage: chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: '' }],
            messageType: 'string',
          };

          const candidateProfileData = await new FilterCandidates(
            this.workspaceQueryService,
            this.staticGraphQLService,
          ).getCandidateInformation(whatsappIncomingMessage, apiToken);
          const audioMessageDetails = await new FacebookWhatsappChatApi(
            this.workspaceQueryService,
            this.staticGraphQLService,
          ).handleAudioMessage(
            audioMessageObject,
            candidateProfileData,
            apiToken,
          );

          console.log('This is the audioMessageDetails::', audioMessageDetails);
          // debugger;
          const replyObject = {
            chatReply:
              audioMessageDetails?.audioTranscriptionText ||
              'Audio Message Received',
            whatsappDeliveryStatus: 'receivedFromCandidate',
            phoneNumberFrom: userMessageBody.from,
            type: 'audio',
            databaseFilePath: audioMessageDetails?.databaseFilePath,
            whatsappMessageId:
              requestBody?.entry[0]?.changes[0]?.value?.messages[0].id,
          };
          const candidateJob: Job = candidateProfileData.jobs;

          await this.createAndUpdateIncomingCandidateChatMessage(
            replyObject,
            candidateProfileData,
            candidateJob,
            apiToken,
          );
        }
      }
    } else {
      console.log(
        'Message of type:',
        requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status,
        ', ignoring it',
      );
    }
  }

  async createAndUpdateIncomingCandidateChatMessage(
    replyObject: {
      whatsappDeliveryStatus: string;
      chatReply: string;
      phoneNumberFrom: string;
      whatsappMessageId: string;
      databaseFilePath?: string | null;
      type?: string;
      isFromMe?: boolean;
      messageType?: string;
    },
    candidateProfileDataNodeObj: CandidateNode,
    candidateJob: Job,
    apiToken: string,
    shouldQueue: boolean = true,
  ) {
    console.log("This is the replyObject in createAndUpdateIncomingCandidateChatMessage::", replyObject);
    // Check for duplicate message before processing
    if (replyObject.whatsappMessageId && replyObject.chatReply) {
      try {
        const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        if (workspaceId) {
          const dataSourceSchema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
          const duplicateCheckQuery = `SELECT id FROM ${dataSourceSchema}."_whatsappMessage" 
            WHERE "whatsappMessageId" = $1 AND "message" = $2 LIMIT 1`;
          
          const duplicateResult = await this.workspaceQueryService.executeRawQuery(
            duplicateCheckQuery,
            [replyObject.whatsappMessageId, replyObject.chatReply],
            workspaceId,
          );
          
          console.log('duplicateResult::', duplicateResult);
          console.log('replyObject.whatsappMessageId::', replyObject.whatsappMessageId);
          if (duplicateResult.length > 0 && replyObject.whatsappMessageId!= 'NA') {
            console.log('Message already exists in database, skipping creation. Message ID:', replyObject.whatsappMessageId);
            return;
          }
        }
        else{
          console.log("No workspace id found in createAndUpdateIncomingCandidateChatMessage");
        }
      } catch (error) {
        console.log('Error checking for duplicates in createAndUpdateIncomingCandidateChatMessage, continuing:', error);
      }
    }

    console.log("replyObject", replyObject);
    console.log("type:", replyObject.type);
    console.log("messageType:", replyObject.messageType);
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;

    console.log(
      'This is the chat reply in create And Update Incoming Candidate Chat Message:',
      replyObject.chatReply,
    );

    let mostRecentMessageObj;

    if (messagesList) {
      messagesList.sort(
        (a, b) =>
          new Date(b.node.createdAt).getTime() -
          new Date(a.node.createdAt).getTime(),
      );
      mostRecentMessageObj = messagesList[0]?.node.messageObj;
    } else {
      console.log('Just having to take the first one');
      mostRecentMessageObj =
        candidateProfileDataNodeObj?.whatsappMessages.edges[0].node.messageObj;
    }
    console.log(
      'These are message kwargs length:',
      mostRecentMessageObj?.length,
    );
    console.log('replyObject?.phoneNumberFrom::', replyObject?.phoneNumberFrom);
    if (mostRecentMessageObj?.length > 0)
      mostRecentMessageObj.push({
        role: replyObject.isFromMe ? 'assistant' : 'user',
        content: replyObject.chatReply,
      });


      console.log("candidateProfileDataNodeObj::", candidateProfileDataNodeObj);
      console.log("candidateJob::", candidateJob);
      let phoneNumberFrom:string = candidateProfileDataNodeObj.people.phones.primaryPhoneNumber.length == 10
      ? '91' + candidateProfileDataNodeObj.people.phones.primaryPhoneNumber
      : candidateProfileDataNodeObj.people.phones.primaryPhoneNumber;
      if (candidateProfileDataNodeObj.people?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.messagingChannel == 'linkedin') {
        phoneNumberFrom = candidateProfileDataNodeObj.people?.linkedinLink?.primaryLinkUrl || '';
      }
      else{
        phoneNumberFrom = candidateProfileDataNodeObj.people.phones.primaryPhoneNumber.length == 10
            ? '91' + candidateProfileDataNodeObj.people.phones.primaryPhoneNumber
            : candidateProfileDataNodeObj.people.phones.primaryPhoneNumber
      }
  
      let phoneNumberTo:string = recruiterProfile.phoneNumber;
  
      if (candidateProfileDataNodeObj.people?.candidates?.edges.filter(
        (candidate) => candidate.node.jobs.id == candidateJob.id,
      )[0]?.node?.messagingChannel == 'linkedin') {
        phoneNumberTo = recruiterProfile.linkedinUrl || '';
      }
      else{
        phoneNumberTo = recruiterProfile.phoneNumber
      }

      console.log("candidateProfileDataNodeObj?.messagingChannel for message text ", candidateProfileDataNodeObj?.messagingChannel, "replyObject.chatReply", replyObject.chatReply);
      console.log("phoneNumberFrom::", phoneNumberFrom);
      console.log("phoneNumberTo::", phoneNumberTo);
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      // executorResultObj: {},
      id: uuidv4(),
      candidateProfile: candidateProfileDataNodeObj,
      whatsappMessageType: candidateProfileDataNodeObj?.whatsappProvider || '',
      candidateFirstName: candidateProfileDataNodeObj.name,
      phoneNumberFrom: phoneNumberFrom,
      phoneNumberTo: phoneNumberTo,
      messages: [{ content: replyObject.chatReply }],
      messageType: 'candidateMessage',
      messageObj: mostRecentMessageObj,
      lastEngagementChatControl:
        candidateProfileDataNodeObj?.lastEngagementChatControl,
      whatsappDeliveryStatus: replyObject.whatsappDeliveryStatus,
      whatsappMessageId: replyObject.whatsappMessageId,
      type: replyObject.type || 'text',
      databaseFilePath: replyObject?.databaseFilePath || '',
      typeOfMessage: candidateProfileDataNodeObj?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    };
    console.log("whatappUpdateMessageObj::", whatappUpdateMessageObj);
    await new UpdateChat(
      this.workspaceQueryService,
        this.staticGraphQLService,
    ).updateCandidateEngagementDataInTable(candidateProfileDataNodeObj, whatappUpdateMessageObj, apiToken);

    // Queue candidate for engagement processing if they are eligible and this is not a self message
    if (shouldQueue && !replyObject.isFromMe && candidateProfileDataNodeObj?.id && candidateProfileDataNodeObj?.engagementStatus) {
      try {
        const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
        if (workspaceId) {
          await this.queueCandidateForEngagement(
            candidateProfileDataNodeObj.id,
            workspaceId,
            replyObject.whatsappMessageId,
          );
        }
      } catch (error) {
        console.error('Error queuing candidate for engagement:', error);
      }
    }

    return whatappUpdateMessageObj;
  }
}
