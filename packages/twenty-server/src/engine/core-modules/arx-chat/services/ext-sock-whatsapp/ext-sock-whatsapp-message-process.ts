import { Injectable } from '@nestjs/common';

import axios from 'axios';
import {
  BaileysIncomingMessage,
  ChatControlsObjType,
  ChatHistoryItem,
  Jobs,
  PersonNode,
  WhatsappMessageData,
  whatappUpdateMessageObjType,
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { IncomingWhatsappMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExtSockWhatsappMessageProcessor {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}
  
  async processMessageWithUserId(
    messageData: WhatsappMessageData,
    userId: string,
  ): Promise<void> {
    try {
      console.log(`Processing WhatsApp message: ${messageData.id}`);
      console.log(`Received WhatsApp message: messageData`, messageData);
      console.log(`Using userId: ${userId} for phone: ${messageData.from}`);

      // Get API token for the phone number
      const incomingMessages = new IncomingWhatsappMessages(
        this.workspaceQueryService,
      );
      let messageFrom:string = ""

      if (messageData.from.includes("linkedin")){
        console.log("This is a linkedin message, so we will not process it")
        messageFrom = messageData.from
      }
      else{
        messageFrom = messageData.from.split('@')[0]
      }

      console.log("Going to use message from as :::", messageFrom)



      const apiToken =
      await incomingMessages.getApiKeyToUseFromPhoneNumberMessageReceived({
        object: 'whatsapp_personal_account',
        entry: [
          {
            id: '123',
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: messageFrom,
                    },
                  ],
                  metadata: {
                    phone_number_id: messageData.to.split('@')[0],
                  },
                },
              },
            ],
          },
        ],
      }, messageData);
      console.log("Thi is the api token found when trying to process message")
      if (apiToken === null) {
        console.log('NO API KEY FOUND FOR THIS PHONE NUMBER');
        return;
      } else {
        console.log('API KEY FOUND FOR THIS PHONE NUMBER::', messageData.from);
      }

      console.log("Going to rpocess :::", messageData)
      // Process based on whether the message is from self or from another user
      if (messageData.fromMe) {
        await this.processOutgoingMessage(messageData, apiToken, userId);
      } else {
        await this.processIncomingMessage(messageData, apiToken, userId);
      }

      console.log(`Successfully processed WhatsApp message: ${messageData.id}`);
    } catch (error) {
      console.error(
        `Failed to process WhatsApp message ${messageData.id}:`,
        error,
      );
      throw error;
    }
  }

  private async processIncomingMessage(
    messageData: WhatsappMessageData,
    apiToken: string,
    userId: string,
  ): Promise<void> {
    // Only process chat messages, not call logs or other types
    if (messageData.type !== 'chat') {
      console.log(`Ignoring non-chat message of type: ${messageData.type}`);

      return;
    }
    console.log(`Processing incoming message: ${messageData}`);
    // Convert to BaileysIncomingMessage format
    const baileysMessage: BaileysIncomingMessage = {
      message: messageData.body || '',
      phoneNumberFrom: messageData.from.split('@')[0],
      phoneNumberTo: messageData.to.split('@')[0],
      baileysMessageId: messageData.id,
      messageTimeStamp: messageData.timestamp.toString(),
      fromName: messageData.from,
    };

    console.log(`Baileys message: ${baileysMessage}`);

    // Process the incoming message
    const incomingMessages = new IncomingWhatsappMessages(
      this.workspaceQueryService,
    );

    await incomingMessages.receiveIncomingMessages(
      baileysMessage,
      apiToken,
    );
  }

  private async processOutgoingMessage(
    messageData: WhatsappMessageData,
    apiToken: string,
    userId: string,
  ): Promise<void> {
    // Only process chat messages, not call logs or other types
    if (messageData.type !== 'chat') {
      console.log(`Ignoring non-chat message of type: ${messageData.type}`);
      return;
    }


    // Get candidate information
    const filterCandidates = new FilterCandidates(this.workspaceQueryService);
    const personObj = await filterCandidates.getPersonDetailsByPhoneNumber(
      messageData.to.split('@')[0],
      apiToken,
    );

    if (!personObj || !personObj.candidates?.edges?.[0]?.node) {
      console.log('No candidate found for this phone number');
      return;
    }

    const candidateNode = personObj.candidates.edges
      .sort((a, b) => new Date(b?.node?.updatedAt).getTime() - new Date(a?.node?.updatedAt).getTime())
      [0]?.node;
    
    console.log("This is the candidate node in process outgoing message:", candidateNode)
    let messageObj: ChatHistoryItem[] = [];
    if (candidateNode.whatsappMessages?.edges?.length > 0) {
      const messagesList = candidateNode.whatsappMessages.edges;

      messagesList.sort(
        (a, b) =>
          new Date(b.node.createdAt).getTime() -
          new Date(a.node.createdAt).getTime(),
      );
      messageObj = [
        ...(messagesList[0]?.node.messageObj ?? []),
      ] as ChatHistoryItem[];
    }


    console.log("This is the message obj in process outgoing message:", messageObj)

    // try{
    //   const recruiterProfile = await getRecruiterProfileByRecruiterId (
    //     candidateNode?.jobs?.recruiterId,
    //     apiToken,
    //   );
    //   console.log("This is the recruiter profile in process outgoing message:", recruiterProfile)
    //   const phoneFrom = messageData?.from?.split('@')[0]
    //   const recruiterPhoneNumber = recruiterProfile?.phoneNumber
    //   console.log("This is the phone from in process outgoing message:", phoneFrom)
    //   console.log("This is the recruiter phone number in process outgoing message:", recruiterPhoneNumber)
    //   if (phoneFrom === recruiterPhoneNumber){
    //     console.log("This is a message from the recruiter, so we will not process it")
    //     return;
    //   }
    // } catch (error) {
    //   console.log("Error in process outgoing message:", error)
    // }

    // const candidatePhoneNumber = candidateNode


    // Add the new message
    if (!messageObj.some(msg => msg.content === messageData.body) && messageData.body !== "" && messageData.body !== null && messageData.body !== undefined) {
      messageObj.push({
        role: 'assistant',
        content: messageData.body || '',
      });
    }
    else{
      console.log("This message already exists in the message obj, so we will not add it again")
      return;
    }

    // Create update message object
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: candidateNode,
      whatsappMessageType: candidateNode.whatsappProvider || '',
      candidateFirstName: candidateNode.name,
      phoneNumberFrom: messageData.from.split('@')[0],
      phoneNumberTo: messageData.to.split('@')[0],
      messages: [{ content: messageData.body || '' }],
      messageType: 'candidateMessage',
      messageObj: messageObj as ChatHistoryItem[],
      lastEngagementChatControl: candidateNode.lastEngagementChatControl,
      whatsappDeliveryStatus: 'dispatched',
      typeOfMessage: candidateNode.messagingChannel || 'whatsapp-web',
      whatsappMessageId: messageData.id,
      type: 'text',
      databaseFilePath: '',
    };

    // Update the message in the database
    const updateChat = new UpdateChat(this.workspaceQueryService);

    await updateChat.createAndUpdateWhatsappMessage(
      candidateNode,
      whatappUpdateMessageObj,
      apiToken,
    );

    // Set engagement status to false since this is a message from us
    await updateChat.setCandidateEngagementStatusToFalse(
      candidateNode.id,
      apiToken,
    );
  }

  async sendWhatsappMessageVIAExtSockWhatsappAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    personNode: PersonNode,
    candidateJob: Jobs,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    try {
      console.log( 'Sending WhatsApp message via ext-sock-whatsapp:', whatappUpdateMessageObj.messages[0].content, );
      console.log("whatappUpdateMessageObj. obj:::", whatappUpdateMessageObj);
      const baseUrl = process.env.SERVER_URL || 'http://localhost:3000';

      const response = await axios.post(
        `${baseUrl}/ext-sock-whatsapp/send-sock-message`,
        whatappUpdateMessageObj,
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}`, }, },
      );

      if (response.data.status === 'success') {
        console.log('Message sent successfully via ext-sock-whatsapp');
        whatappUpdateMessageObj.whatsappDeliveryStatus = 'dispatched';
        const updateChat = new UpdateChat(this.workspaceQueryService);
        await updateChat.createAndUpdateWhatsappMessage(
          personNode.candidates.edges.filter(
            (candidate) => candidate.node.jobs.id == candidateJob.id,
          )[0].node,
          whatappUpdateMessageObj,
          apiToken,
        );
      } else {
        console.error(
          'Failed to send message via ext-sock-whatsapp:',
          response.data,
        );
      }
    } catch (error) {
      console.error('Error in sendWhatsappMessageVIABaileysAPI:', error);
    }
  }
}
