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

@Injectable()
export class ExtSockWhatsappMessageProcessor {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

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
      const apiToken =
        await incomingMessages.getApiKeyToUseFromPhoneNumberMessageReceived({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      {
                        from: messageData.from.split('@')[0],
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
        });

      if (apiToken === null) {
        console.log('NO API KEY FOUND FOR THIS PHONE NUMBER');

        return;
      } else {
        console.log('API KEY FOUND FOR THIS PHONE NUMBER::', messageData.from);
      }

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

    await incomingMessages.receiveIncomingMessagesFromBaileys(
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

    const candidateNode = personObj.candidates.edges[0].node;

    // Get message object from candidate
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

    // Add the new message
    messageObj.push({
      role: 'assistant',
      content: messageData.body || '',
    });

    // Create update message object
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      candidateProfile: candidateNode,
      whatsappMessageType: candidateNode.whatsappProvider || '',
      candidateFirstName: candidateNode.name,
      phoneNumberFrom: messageData.from.split('@')[0],
      phoneNumberTo: messageData.to.split('@')[0],
      messages: [{ content: messageData.body || '' }],
      messageType: 'candidateMessage',
      messageObj: messageObj as ChatHistoryItem[],
      lastEngagementChatControl: candidateNode.lastEngagementChatControl,
      whatsappDeliveryStatus: 'delivered',
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
      console.log(
        'Sending WhatsApp message via ext-sock-whatsapp:',
        whatappUpdateMessageObj.messages[0].content,
      );
      const baseUrl = process.env.SERVER_URL || 'http://localhost:3000';

      const response = await axios.post(
        `${baseUrl}/ext-sock-whatsapp/send-message`,
        whatappUpdateMessageObj,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        },
      );

      if (response.data.status === 'success') {
        console.log('Message sent successfully via ext-sock-whatsapp');

        // Update the message status in the database
        whatappUpdateMessageObj.whatsappDeliveryStatus = 'sent';

        // Create a new UpdateChat instance to update the message status
        const updateChat = new UpdateChat(this.workspaceQueryService);

        await updateChat.createAndUpdateWhatsappMessage(
          personNode.candidates.edges[0].node,
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
