import { FacebookWhatsappChatApi } from '../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../services/candidate-engagement/update-chat';
import * as allDataObjects from '../../services/data-model-objects';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import { axiosRequest } from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { EntityManager } from 'typeorm';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../candidate-engagement/filter-candidates';

export class IncomingWhatsappMessages {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,

) {}
  async receiveIncomingMessagesFromBaileys(requestBody: allDataObjects.BaileysIncomingMessage,apiToken: string) {
    // console.log('This is requestBody::', requestBody);
    let savedMessage
    if (requestBody.message == ""){
      savedMessage = "Attachment Received"
    }
    else{
      savedMessage = requestBody.message
    }
    console.log("Saved message is ::", savedMessage)

    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: requestBody.phoneNumberFrom,
      phoneNumberTo: requestBody.phoneNumberTo,
      messages: [{ role: 'user', content: savedMessage }],
      messageType: 'string',
    };
    const chatReply = savedMessage;
    const status = '';
    console.log('We will first go and get the candiate who sent us the message');
    const candidateProfileData = await new FilterCandidates(this.workspaceQueryService).getCandidateInformation(whatsappIncomingMessage, apiToken);
    const candidateJob:allDataObjects.Jobs = candidateProfileData.jobs

    console.log('This is the candiate who has sent us the message fromBaileys., we have to update the database that this message has been recemivged::', chatReply);
    if (candidateProfileData != allDataObjects.emptyCandidateProfileObj) {
      // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
      await this.createAndUpdateIncomingCandidateChatMessage({ chatReply: savedMessage, whatsappDeliveryStatus: 'delivered',phoneNumberFrom:requestBody.phoneNumberFrom, whatsappMessageId: requestBody.baileysMessageId }, candidateProfileData,candidateJob, apiToken);
    } else {
      console.log('Message has been received from a candidate however the candidate is not in the database');
    }
  }
  async receiveIncomingMessagesFromSelfFromBaileys(requestBody: allDataObjects.BaileysIncomingMessage,apiToken: string) {
    // console.log('This is requestBody::', requestBody);
    console.log('-------This is the self message-------------');
    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
      phoneNumberFrom: requestBody.phoneNumberFrom,
      phoneNumberTo: requestBody.phoneNumberTo,
      messages: [{ role: 'assistant', content: requestBody.message }],
      messageType: 'messageFromSelf',
    };
    const chatReply = requestBody.message;
    console.log('We will first go and get the candiate who sent us the message');
    const candidateProfileData = await new FilterCandidates(this.workspaceQueryService).getCandidateInformation(whatsappIncomingMessage,apiToken);
    const candidateJob:allDataObjects.Jobs = candidateProfileData.jobs
    console.log('This is the SELF message., we have to update the database that this message has been received::', chatReply);
    if (candidateProfileData != allDataObjects.emptyCandidateProfileObj) {
      await this.createAndUpdateIncomingCandidateChatMessage({ chatReply: chatReply, whatsappDeliveryStatus: 'delivered',phoneNumberFrom:requestBody.phoneNumberFrom, whatsappMessageId: requestBody.baileysMessageId, isFromMe: true }, candidateProfileData,candidateJob, apiToken);
      new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).setCandidateEngagementStatusToFalse(candidateProfileData.id,apiToken);
    } else {
      console.log('Message has been received from a candidate however the candidate is not in the database');
    }
  }

  isWithinLast5Minutes(unixTimestamp) {
    let currentTime = Math.floor(Date.now() / 1000); 
    let providedTime = parseInt(unixTimestamp, 10);
    let differenceInSeconds = currentTime - providedTime;
    return differenceInSeconds < 300;
  }

  async fetchWhatsappMessageById(messageId: string,apiToken: string) {
    console.log('This is the message id:', messageId);
    try {
      const whatsappMessageVariable = {
        whatsappMessageId: messageId,
      };
      const response = await axiosRequest(
        JSON.stringify({
          query: allGraphQLQueries.graphqlToFetchOneWhatsappMessageByWhatsappId,
          variables: whatsappMessageVariable,
        }),apiToken
      );
      console.log('Response from fetchWhatsappMessageById:', response?.data);
      return response?.data;
    } catch (error) {
      console.log('Error fetching whatsapp message by id:', error);
      return { error: error };
    }
  }


  async getApiKeyToUseFromPhoneNumberMessageReceived(requestBody:any, transactionManager?: EntityManager){
    const phoneNumber = requestBody?.entry[0]?.changes[0]?.value?.messages[0].from;
    const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
      async (workspaceId, dataSourceSchema) => {
        const person = await this.workspaceQueryService.executeRawQuery(
          `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."phone" ILIKE '%${phoneNumber}%'`,
          [],
          workspaceId
        );
        const phoneNumberId = requestBody?.entry[0]?.changes[0]?.value.metadata?.phone_number_id;
        const workspace = await this.workspaceQueryService.executeRawQuery(
          `SELECT * FROM core.workspace WHERE id = $1 AND facebook_whatsapp_phone_number_id = $2`,
          [workspaceId, phoneNumberId],
          workspaceId
        );

        if (workspace.length === 0) {
          return null;
        }

        if (person.length > 0) {
          const apiKeys = await this.workspaceQueryService.getApiKeys(workspaceId, dataSourceSchema, transactionManager);
          if (apiKeys.length > 0) {
            const apiKeyToken = await this.workspaceQueryService.tokenService.generateApiKeyToken(
              workspaceId,
              apiKeys[0].id,
              apiKeys[0].expiresAt
            );
            if (apiKeyToken) {
              return apiKeyToken?.token;
            }
          }
        }
        return null;
      }
    );

    return results.find(result => result !== null);
  }

  async receiveIncomingMessagesFromFacebook(requestBody: allDataObjects.WhatsAppBusinessAccount) {
    console.log('This is requestBody from Facebook::', JSON.stringify(requestBody));
    // to check if the incoming message is the status of the message
    // have to use system API Key and get the status updates of all the workspaces where the phone number resides. Then get the api keys of the workspaces and then update the messages
    const apiToken = await this.getApiKeyToUseFromPhoneNumberMessageReceived(requestBody) || '';
    console.log('This is the apiToken to use in receiving facebook messages:', apiToken);
    if (requestBody?.entry[0]?.changes[0]?.value?.statuses && requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status && !requestBody?.entry[0]?.changes[0]?.value?.messages) {
      const messageId = requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.id;
      const messageStatus = requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status;

      const variables = { filter: { whatsappMessageId: { ilike: `%${messageId}%` } }, orderBy: { position: 'AscNullsFirst' } };
      const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToFindMessageByWAMId, variables: variables });
      const response = await axiosRequest(graphqlQueryObj,apiToken);
      console.log('-----------------This is the response from the query to find the message by WAMID::-------------------');
      // debugger
      // console.log("Response to query on who sent the messages::", response?.data?.data);

      if (response?.data?.data?.whatsappMessages?.edges.length === 0) {
        console.log('No message found with the given WAMID');
        return;
      }

      if (response?.data?.data?.whatsappMessages?.edges[0]?.node?.whatsappDeliveryStatus === 'read' || (response?.data?.data?.whatsappMessages?.edges[0]?.node?.whatsappDeliveryStatus === 'delivered' && messageStatus !== 'read')) {
        console.log('Message has already been read/delivered, skipping the update');
        return;
      }
      const variablesToUpdateDeliveryStatus = { idToUpdate: response?.data?.data?.whatsappMessages?.edges[0]?.node?.id, input: { whatsappDeliveryStatus: messageStatus } };
      // debugger
      const graphqlQueryObjForUpdationForDeliveryStatus = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToUpdateMessageDeliveryStatus, variables: variablesToUpdateDeliveryStatus });
      const responseOfDeliveryStatus = await axiosRequest(graphqlQueryObjForUpdationForDeliveryStatus,apiToken);

      console.log('---------------DELIVERY STATUS UPDATE DONE-----------------------');
      // console.log(responseOfDeliveryStatus);
    } else if (requestBody?.entry[0]?.changes[0]?.value?.messages?.length > 0) {
      // to check if the incoming message is the message
      console.log('There is a request body for sure', requestBody?.entry[0]?.changes[0]?.value?.messages[0]);
      const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];
      // console.log("This is the user messageBody :", userMessageBody)
      if (userMessageBody) {
        let timestamp = requestBody?.entry[0]?.changes[0]?.value?.messages[0].timestamp; // Assuming this is the Unix timestamp in seconds
        let result = this.isWithinLast5Minutes(timestamp);
        if (!result) {
          console.log('MESSAGE IS NOT WITHIN 5 MINUTES:::: ', userMessageBody);
          return;
        }

        // console.log('There is a usermessage body in the request', userMessageBody);
        if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== 'utility' && requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== 'document' && requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== 'audio') {
          // debugger
          console.log('We have a whatsapp incoming message which is a text one we have to do set of things with which is not a utility message');
          let chatReply = userMessageBody?.text?.body;
          if (!chatReply && userMessageBody.reaction.id){
          const whatsappMessageCommentedOn = await this.fetchWhatsappMessageById(userMessageBody?.reaction?.id,apiToken);

            console.log("its likely an emoji message or emoji reaction to precededing message")
            console.log("Emoji message:", userMessageBody.reaction.emoji, "to message id:", userMessageBody.reaction.id, "from ::", userMessageBody.reaction.from)
            // Adhoc setting chatReply to emoji. lets see how it goes.
            const messageToAppend = 'Reacted ' + userMessageBody.reaction.emoji + ' to ' + "'" + whatsappMessageCommentedOn + "'" || '';
            chatReply = messageToAppend
          }
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number;
          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: chatReply }],
            messageType: 'string',
          };
          console.log('We will first go and get the candiate who sent us the message');
          const candidateProfileData = await new FilterCandidates(this.workspaceQueryService).getCandidateInformation(whatsappIncomingMessage,apiToken);
          const candidateJob:allDataObjects.Jobs = candidateProfileData.jobs
          console.log('This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::', chatReply);
          // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
          const replyObject = {
            chatReply: chatReply,
            whatsappDeliveryStatus: 'receivedFromCandidate',
            phoneNumberFrom: userMessageBody.from,
            whatsappMessageId: requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.id,
          };

          const responseAfterMessageUpdate = await this.createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData,candidateJob, apiToken);
          if (candidateProfileData?.candidateReminders?.edges.length > 0) {
            console.log("Candidate reminder found, updating the reminder status to false")
            const listOfReminders = candidateProfileData?.candidateReminders?.edges;
            const updateOneReminderVariables = { idToUpdate: listOfReminders[0]?.node?.id, input: { isReminderActive: false } };
            const graphqlQueryObj = JSON.stringify({ query: allGraphQLQueries.graphqlQueryToCreateOneNewWhatsappMessage, variables: updateOneReminderVariables });
            console.log('This is the graphqlQueryObj after updating the reminder status::', graphqlQueryObj);
          }

          console.log("Graphqlreqsponse after message update",responseAfterMessageUpdate);
        } else if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type === 'document') {
          const sendTemplateMessageObj = {
            documentId: requestBody?.entry[0]?.changes[0]?.value?.messages[0].document.id,
            filename: requestBody?.entry[0]?.changes[0]?.value?.messages[0].document.filename,
            mime_type: requestBody?.entry[0]?.changes[0]?.value?.messages[0].document.mime_type,
          };
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number;

          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: '' }],
            messageType: 'string',
          };

          const replyObject = { chatReply: userMessageBody?.text?.body || 'Attachment Received', whatsappDeliveryStatus: 'receivedFromCandidate',phoneNumberFrom: whatsappIncomingMessage.phoneNumberFrom, whatsappMessageId: requestBody?.entry[0]?.changes[0]?.value?.messages[0].id };
          const candidateProfileData = await new FilterCandidates(this.workspaceQueryService).getCandidateInformation(whatsappIncomingMessage,apiToken);
          const candidateJob:allDataObjects.Jobs = candidateProfileData.jobs

          await new FacebookWhatsappChatApi(this.workspaceQueryService).downloadWhatsappAttachmentMessage(sendTemplateMessageObj, candidateProfileData,apiToken);
          await this.createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData,candidateJob, apiToken );
        }
        // Audio message
        else if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type === 'audio') {
          const audioMessageObject = {
            audioId: requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.id,
            filename: requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.id + '.ogg',
            mime_type: requestBody?.entry[0]?.changes[0]?.value?.messages[0]?.audio?.mime_type,
          };
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number;

          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{ role: 'user', content: '' }],
            messageType: 'string',
          };

          const candidateProfileData = await new FilterCandidates(this.workspaceQueryService).getCandidateInformation(whatsappIncomingMessage,apiToken);
          const audioMessageDetails = await new FacebookWhatsappChatApi(this.workspaceQueryService).handleAudioMessage(audioMessageObject, candidateProfileData,apiToken);

          console.log('This is the audioMessageDetails::', audioMessageDetails);
          // debugger;
          const replyObject = {
            chatReply: audioMessageDetails?.audioTranscriptionText || 'Audio Message Received',
            whatsappDeliveryStatus: 'receivedFromCandidate',
            phoneNumberFrom: userMessageBody.from,
            type: 'audio',
            databaseFilePath: audioMessageDetails?.databaseFilePath,
            whatsappMessageId: requestBody?.entry[0]?.changes[0]?.value?.messages[0].id,
          };
          const candidateJob:allDataObjects.Jobs = candidateProfileData.jobs
          await this.createAndUpdateIncomingCandidateChatMessage(replyObject, candidateProfileData,candidateJob, apiToken);
        }
      }
    } else {
      console.log('Message of type:', requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status, ', ignoring it');
    }
  }
  async createAndUpdateIncomingCandidateChatMessage(
    replyObject: { whatsappDeliveryStatus: string; chatReply: string;  phoneNumberFrom:string,whatsappMessageId: string; databaseFilePath?: string | null; type?: string; isFromMe?: boolean },
    candidateProfileDataNodeObj: allDataObjects.CandidateNode,candidateJob:allDataObjects.Jobs, apiToken: string
  ) {
    const personObj: allDataObjects.PersonNode = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(replyObject.phoneNumberFrom,apiToken);


    const recruiterProfile = allDataObjects.recruiterProfile;
    const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;
    // Ensure messagesList is not undefined before sorting
    // console.log( 'This is the messageObj:', messagesList.map((edge: any) => edge.node.messageObj), );
    console.log('This is the chat reply in createAndUpdateIncomingCandidateChatMessage:', replyObject.chatReply);
    let mostRecentMessageObj;
    if (messagesList) {
      // console.log('This is the messagesList:', messagesList);
      messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
      mostRecentMessageObj = messagesList[0]?.node.messageObj;
    } else {
      console.log('Just having to take the first one');
      mostRecentMessageObj = candidateProfileDataNodeObj?.whatsappMessages.edges[0].node.messageObj;
    }
    console.log('These are message kwargs length:', mostRecentMessageObj?.length);
    // console.log('This is the most recent message object being considered::', mostRecentMessageObj);
    // chatHistory = await this.getChatHistoryFromMongo(mostRecentMessageObj);
    console.log("replyObject?.phoneNumberFrom::", replyObject?.phoneNumberFrom)
    // console.log("replyObject?.candidateProfileDataNodeObj?.phoneNumber::", candidateProfileDataNodeObj?.phoneNumber)
    // const phoneNumberThatMessageCameFrom = replyObject?.phoneNumberFrom || candidateProfileDataNodeObj?.phoneNumber;
    if (mostRecentMessageObj?.length > 0) mostRecentMessageObj.push({ role: replyObject.isFromMe ? 'assistant' : 'user', content: replyObject.chatReply });
    let whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType = {
      // executorResultObj: {},
      candidateProfile: candidateProfileDataNodeObj,
      whatsappMessageType: candidateProfileDataNodeObj?.whatsappProvider || '',
      candidateFirstName: candidateProfileDataNodeObj.name,
      phoneNumberFrom: candidateProfileDataNodeObj?.phoneNumber,
      phoneNumberTo: recruiterProfile.phone,
      messages: [{ content: replyObject.chatReply }],
      messageType: 'candidateMessage',
      messageObj: mostRecentMessageObj,
      lastEngagementChatControl: candidateProfileDataNodeObj?.lastEngagementChatControl,
      whatsappDeliveryStatus: replyObject.whatsappDeliveryStatus,
      whatsappMessageId: replyObject.whatsappMessageId,
      type: replyObject.type || 'text',
      databaseFilePath: replyObject?.databaseFilePath || '',
    };


    await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObj,candidateJob, apiToken);
    // return whatappUpdateMessageObj;
  }
}
