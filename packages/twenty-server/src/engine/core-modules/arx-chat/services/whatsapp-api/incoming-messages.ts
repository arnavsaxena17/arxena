import {
  BaileysIncomingMessage,
  CandidateNode,
  chatMessageType,
  emptyCandidateProfileObj,
  graphqlQueryToCreateOneNewWhatsappMessage,
  graphqlToFetchWhatsappMessageByWhatsappId,
  graphQlToFetchWhatsappMessages,
  graphqlToUpdateWhatsappMessageId,
  Jobs,
  whatappUpdateMessageObjType,
  WhatsAppBusinessAccount,
} from 'twenty-shared';
import { EntityManager } from 'typeorm';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { getRecruiterProfileByJob } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { FacebookWhatsappChatApi } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { axiosRequest } from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

interface MessageResult {
  token: string;
  lastMessageTime: Date;
  workspaceId: string;
}

export class IncomingWhatsappMessages {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async receiveIncomingMessages(
    requestBody: BaileysIncomingMessage,
    apiToken: string,
  ) {
    // console.log('This is requestBody::', requestBody);
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
    ).getCandidateInformation(whatsappIncomingMessage, apiToken);
    const candidateJob: Jobs = candidateProfileData.jobs;

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
    const chatReply = requestBody.message;

    console.log(
      'We will first go and get the candiate who sent us the message',
    );
    const candidateProfileData = await new FilterCandidates(
      this.workspaceQueryService,
    ).getCandidateInformation(whatsappIncomingMessage, apiToken);
    const candidateJob: Jobs = candidateProfileData.jobs;

    console.log(
      'This is the SELF message., we have to update the database that this message has been received::',
      chatReply,
    );
    if (candidateProfileData != emptyCandidateProfileObj) {
      await this.createAndUpdateIncomingCandidateChatMessage(
        {
          chatReply: chatReply,
          whatsappDeliveryStatus: 'delivered',
          phoneNumberFrom: requestBody.phoneNumberFrom,
          whatsappMessageId: requestBody.baileysMessageId,
          isFromMe: true,
        },
        candidateProfileData,
        candidateJob,
        apiToken,
      );
      new UpdateChat(
        this.workspaceQueryService,
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
      const response = await axiosRequest(
        JSON.stringify({
          query: graphqlToFetchWhatsappMessageByWhatsappId,
          variables: whatsappMessageVariable,
        }),
        apiToken,
      );

      console.log('Response from fetchWhatsappMessageById:', response?.data);

      return response?.data.data.whatsappMessage?.message || '';
    } catch (error) {
      console.log('Error fetching whatsapp message by id:', error);

      return { error: error };
    }
  }

  async getApiKeyToUseFromPhoneNumberMessageReceived(
    requestBody: WhatsAppBusinessAccount,
    transactionManager?: EntityManager,
  ): Promise<string | null> {

    console.log("Going to get api token to use from phone number message received");
    let incomingSenderIdentifierId =
      requestBody?.entry[0]?.changes[0]?.value?.messages?.[0]?.from ||
      requestBody?.entry[0]?.changes[0]?.value?.statuses[0].recipient_id;

    console.log("This is the incomingSenderIdentifierId::", incomingSenderIdentifierId);
    const incomingRecipientIdentifierId =
      requestBody?.entry[0]?.changes[0]?.value.metadata?.phone_number_id;
    console.log("This is the incomingRecipientIdentifierId::", incomingRecipientIdentifierId);
    // const waId = requestBody?.entry[0]?.changes[0]?.value?.contacts?.[0]?.wa_id;

    console.log(
      'This is the phone number to use and search:',
      incomingSenderIdentifierId,
    );

    const results =
      await this.workspaceQueryService.executeQueryAcrossWorkspaces(
        async (workspaceId, dataSourceSchema) => {
          console.log('Data source schema is::', dataSourceSchema);
          console.log('id:', workspaceId);
          // First check if this workspace is valid for the phone number ID
          let rawQuery = '';

          if (
            incomingRecipientIdentifierId.includes('linkedin')
          ) {
            console.log(
              'This is a linkedin phone number, we will not use this phone number to send messages to setup linkedin url as recipient id for api key finding',
            );

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
              console.log(
                'NO WORKSPACE FOUND FOR WHATSAPP INCOMING PHONE NUMBER',
              );
              return null;
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
          console.log("Recent message query::", recentMessageQuery);
          // Get the most recent message for this phone number in this workspace
          const recentMessage =
            await this.workspaceQueryService.executeRawQuery(
              recentMessageQuery,
              [],
              workspaceId,
            );

          console.log('recentMessage::', recentMessage);

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
            console.log('Removing ISD code to enable the search');
            incomingSenderIdentifierId = incomingSenderIdentifierId.slice(-10);
          }

          let personQuery = '';

          if (!incomingSenderIdentifierId.includes('linkedin')) {
            personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."phonesPrimaryPhoneNumber" ILIKE '%${incomingSenderIdentifierId}%'`;
          } else {
            personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."linkedinLinkPrimaryLinkUrl" ILIKE '%${incomingSenderIdentifierId}%'`;
          }

          console.log('This is the person query:', personQuery);


          // Get the person associated with this phone number
          const person = await this.workspaceQueryService.executeRawQuery(
            personQuery,
            [],
            workspaceId,
          );

          console.log('This is the person::', person);

          if (person.length > 0) {
            const apiKeys = await this.workspaceQueryService.getApiKeys(
              workspaceId,
              dataSourceSchema,
              transactionManager,
            );

            if (apiKeys.length > 0) {
              const apiKeyToken =
                await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
                  workspaceId,
                  apiKeys[0].id,
                );

              console.log('This is the api key token::', apiKeyToken);
              console.log('This is the recent message::', recentMessage);

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

    console.log('sortedResultsToken::', sortedResultsToken);

    return sortedResultsToken;
  }

  async receiveIncomingMessagesFromFacebook(
    requestBody: WhatsAppBusinessAccount,
  ) {
    console.log(
      'This is requestBody from Facebook::',
      JSON.stringify(requestBody),
    );
    // to check if the incoming message is the status of the message
    // have to use system API Key and get the status updates of all the workspaces where the phone number resides. Then get the api keys of the workspaces and then update the messages
    const apiToken =
      await this.getApiKeyToUseFromPhoneNumberMessageReceived(requestBody);

    if (apiToken === null) {
      console.log('NO API KEY FOUND FOR THIS PHONE NUMBER FUCK!!!!');

      return;
    }
    console.log(
      'This is the apiToken to use in receiving facebook messages:',
      apiToken,
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
      const response = await axiosRequest(graphqlQueryObj, apiToken);

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
      // debugger
      const graphqlQueryObjForUpdationForDeliveryStatus = JSON.stringify({
        query: graphqlToUpdateWhatsappMessageId,
        variables: variablesToUpdateDeliveryStatus,
      });
      const responseOfDeliveryStatus = await axiosRequest(
        graphqlQueryObjForUpdationForDeliveryStatus,
        apiToken,
      );
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

      console.log('This is the user messageBody :', userMessageBody);
      if (userMessageBody) {
        const timestamp =
          requestBody?.entry[0]?.changes[0]?.value?.messages[0].timestamp; // Assuming this is the Unix timestamp in seconds
        const result = this.isWithinLast5Minutes(timestamp);

        if (!result) {
          console.log('MESSAGE IS NOT WITHIN 5 MINUTES:::: ', userMessageBody);

          return;
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

          console.log(
            'We will first go and get the candiate who sent us the message',
          );
          const candidateProfileData = await new FilterCandidates(
            this.workspaceQueryService,
          ).getCandidateInformation(whatsappIncomingMessage, apiToken);
          const candidateJob: Jobs = candidateProfileData.jobs;

          console.log(
            'This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::',
            chatReply,
          );
          console.log(
            'This is the candiate who has sent us candidateProfileData::',
            candidateProfileData,
          );
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
            console.log(
              'Candidate reminder found, updating the reminder status to false',
            );
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

          console.log(
            'Graphqlreqsponse after message update',
            responseAfterMessageUpdate,
          );
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
          ).getCandidateInformation(whatsappIncomingMessage, apiToken);
          const candidateJob: Jobs = candidateProfileData.jobs;

          await new FacebookWhatsappChatApi(
            this.workspaceQueryService,
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
          ).getCandidateInformation(whatsappIncomingMessage, apiToken);
          const audioMessageDetails = await new FacebookWhatsappChatApi(
            this.workspaceQueryService,
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
          const candidateJob: Jobs = candidateProfileData.jobs;

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
    },
    candidateProfileDataNodeObj: CandidateNode,
    candidateJob: Jobs,
    apiToken: string,
  ) {
    const recruiterProfile = await getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;

    console.log(
      'This is the chat reply in create And Update Incoming Candidate Chat Message:',
      replyObject.chatReply,
    );
    console.log(
      'This is the chat reply in create And Update candidateProfileDataNodeObj:',
      candidateProfileDataNodeObj,
    );
    console.log(
      'This is the chat replycandidateProfileDataNodeObj?.whatsappMessages.edges',
      candidateProfileDataNodeObj?.whatsappMessages.edges,
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
  
      








    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      // executorResultObj: {},
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
    };

    await new UpdateChat(
      this.workspaceQueryService,
    ).updateCandidateEngagementDataInTable(whatappUpdateMessageObj, apiToken);

    return whatappUpdateMessageObj;
  }
}
