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
  WhatsAppBusinessAccount
} from 'twenty-shared';
import { EntityManager } from 'typeorm';
import { UnipileMessageWebhook } from '../../types/unipile-webhook.types';

import { EngagedCandidateQueueService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/engaged-candidate-queue.service';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { FacebookWhatsappChatApi } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { buildIncomingAttachmentChatReply } from 'src/engine/core-modules/arx-chat/utils/unipile-attachment-message.util';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WhatsappMediaStorageService } from 'src/engine/core-modules/whatsapp-media/services/whatsapp-media-storage.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

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
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly engagedCandidateMessageQueueService?: MessageQueueService,
    private readonly whatsappMediaStorageService?: WhatsappMediaStorageService,
    ) {
  }

  async queueCandidateForEngagement(
    candidateId: string,
    workspaceId: string,
    messageId?: string,
    isIncomingMessage: boolean = true,
    slidingWindowDelayMinutes?: number,
  ): Promise<void> {
    // Use the dedicated EngagedCandidateQueueService for better separation of concerns
    const { EngagedCandidateQueueService } = await import('../candidate-engagement/engaged-candidate-queue.service');
    
    const queueService = new EngagedCandidateQueueService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.engagedCandidateMessageQueueService,
    );

    await queueService.queueCandidateForEngagement(
      candidateId,
      workspaceId,
      messageId,
      isIncomingMessage,
      slidingWindowDelayMinutes,
    );
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
    
    // Use the new queue service to get candidate information and check for duplicates
    const { EngagedCandidateQueueService } = await import('../candidate-engagement/engaged-candidate-queue.service');
    const queueService = new EngagedCandidateQueueService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.engagedCandidateMessageQueueService,
    );

    const { candidateProfileData, candidateJob, isDuplicate } = await queueService.getCandidateInformationWithDuplicateCheck(
      whatsappIncomingMessage,
      apiToken
    );

    if (isDuplicate) {
      console.log('Message already exists in database, skipping processing');
      return;
    }

    console.log(
      'This is the candiate who has sent us the message fromBaileys., we have to update the database that this message has been recemivged::',
      chatReply,
    );
    if (candidateProfileData != emptyCandidateProfileObj) {
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
    
    // Use the new queue service to get candidate information and check for duplicates
    const { EngagedCandidateQueueService } = await import('../candidate-engagement/engaged-candidate-queue.service');
    const queueService = new EngagedCandidateQueueService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.engagedCandidateMessageQueueService,
    );

    const { candidateProfileData, candidateJob, isDuplicate } = await queueService.getCandidateInformationWithDuplicateCheck(
      whatsappIncomingMessage,
      apiToken
    );

    console.log(
      'This is the SELF message., we have to update the database that this message has been received::',
      chatReply,
    );

    if (candidateProfileData != emptyCandidateProfileObj) {
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
    
      } else {
      console.log(
        'Message has been received from a candidate however the candidate is not in the database',
      );
    }
  }

  async receiveIncomingMessageFromLinkedinUnipile(
    payload: UnipileMessageWebhook,
  ) {
    console.log('Received LinkedIn Unipile message:', payload);
    
    const { 
      message, 
      sender, 
      account_info, 
      message_id, 
      timestamp,
      chat_id 
    } = payload;

    // Get API token for this LinkedIn message
    const apiTokenResult = await this.getApiKeyToUseFromLinkedinMessageReceived(payload);

    if (apiTokenResult === null) {
      console.log('NO API KEY FOUND FOR THIS LINKEDIN MESSAGE');
      return;
    }
    
    const apiToken = apiTokenResult.token;
    const workspaceId = apiTokenResult.workspaceId;
    
    console.log('This is the apiToken to use in receiving LinkedIn messages:', apiToken);
    console.log('This is the workspaceId to use in receiving LinkedIn messages:', workspaceId);

    // Check if message is from the connected user (self message) or external contact
    const isFromConnectedUser = account_info?.user_id === sender.attendee_provider_id;
    
    console.log('LinkedIn message from connected user:', isFromConnectedUser);
    console.log('Message content:', message);
    console.log('Sender:', sender.attendee_name);
    console.log('Account info user_id:', account_info?.user_id);
    console.log('Sender attendee_provider_id:', sender.attendee_provider_id);
    console.log('Sender attendee_profile_url:', sender.attendee_profile_url);
    console.log('Attendees:', payload.attendees);

    // Create chat message type for LinkedIn
    // Normalize LinkedIn URLs to always use https://linkedin.com/in/ format (without www)
    const normalizeLinkedInUrl = (url: string): string => {
      if (!url) return '';
      // Convert www.linkedin.com to linkedin.com for consistency
      return url.replace('www.linkedin.com', 'linkedin.com');
    };
    
    const linkedinUrlFrom = normalizeLinkedInUrl(sender.attendee_profile_url);
    
    // Find the recipient's profile URL from the attendees array
    // If no recipient found in attendees, it means the message is from external contact to connected user
    const recipient = payload.attendees.find(attendee => 
      attendee.attendee_provider_id !== sender.attendee_provider_id
    );
    
    let linkedinUrlTo = '';
    if (recipient) {
      linkedinUrlTo = normalizeLinkedInUrl(recipient.attendee_profile_url);
    } else {
      // Message is from external contact to connected user
      // We need to construct the LinkedIn URL for the connected user
      linkedinUrlTo = account_info?.user_id ? `https://linkedin.com/in/${account_info.user_id}` : '';
    }

    // Self messages must use messageFromSelf so candidate lookup uses phoneNumberTo (recipient)
    const linkedinIncomingMessage: chatMessageType = {
      phoneNumberFrom: linkedinUrlFrom,
      phoneNumberTo: linkedinUrlTo,
      messages: [{ 
        role: isFromConnectedUser ? 'assistant' : 'user', 
        content: message 
      }],
      messageType: isFromConnectedUser ? 'messageFromSelf' : 'linkedin',
    };

    console.log('Final LinkedIn URL from (phoneNumberFrom):', linkedinUrlFrom);
    console.log('Final LinkedIn URL to (phoneNumberTo):', linkedinUrlTo);
    console.log('Processing LinkedIn message for candidate identification');
    
    // Use the new queue service to get candidate information and check for duplicates
    const { EngagedCandidateQueueService } = await import('../candidate-engagement/engaged-candidate-queue.service');
    const queueService = new EngagedCandidateQueueService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.engagedCandidateMessageQueueService,
    );

    const { candidateProfileData, candidateJob, isDuplicate } = await queueService.getCandidateInformationWithDuplicateCheck(
      linkedinIncomingMessage,
      apiToken
    );

    if (candidateProfileData != emptyCandidateProfileObj) {
      if (isDuplicate) {
        console.log('LinkedIn message already exists in database, skipping processing');
        return;
      }

      // Create and update the message
      const chatReply = buildIncomingAttachmentChatReply(
        message,
        payload.attachments,
      );
      await this.createAndUpdateIncomingCandidateChatMessage(
        {
          chatReply,
          whatsappDeliveryStatus: 'delivered',
          phoneNumberFrom: linkedinUrlFrom,
          whatsappMessageId: message_id,
          messageType: isFromConnectedUser ? 'messageFromSelf' : 'linkedin',
          isFromMe: isFromConnectedUser,
        },
        candidateProfileData,
        candidateJob,
        apiToken,
      );
    } else {
      console.log('LinkedIn message received from contact not in database');
    }
  }

  async receiveIncomingMessageFromWhatsappUnipile(
    payload: UnipileMessageWebhook,
  ) {
    if (payload.attendees.length > 4) {
      return;
    }

    console.log('Received WhatsApp Unipile message:', payload);

    const { 
      message, 
      sender, 
      account_info, 
      message_id, 
      timestamp,
      chat_id 
    } = payload;

    // Get API token for this WhatsApp message
    const apiTokenResult = await this.getApiKeyToUseFromWhatsappUnipileMessageReceived(payload);

    if (apiTokenResult === null) {
      console.log('NO API KEY FOUND FOR THIS WHATSAPP UNIPILE MESSAGE:', message);
      return;
    }
    
    const apiToken = apiTokenResult.token;
    const workspaceId = apiTokenResult.workspaceId;
    /**
     * Determine if the message is from the connected WhatsApp account (self) or from the external contact (candidate).
     *
     * Unipile provides an `is_sender` flag which is the most reliable indicator:
     * - is_sender === true  => message is sent by the connected account (self message)
     * - is_sender === false => message is received from external contact (candidate)
     *
     * Previously we compared `account_info.user_id === sender.attendee_provider_id`,
     * which misclassified messages when both values were `undefined`, treating
     * candidate messages as self messages and skipping engagement processing.
     */
    const isFromConnectedUser = payload.is_sender === true;
    
    console.log('WhatsApp Unipile message from connected user:', isFromConnectedUser);
    console.log('Message content:', message);
    console.log('Sender:', sender.attendee_name);
    console.log('Account info user_id:', account_info?.user_id);
    console.log('Sender attendee_provider_id:', sender.attendee_provider_id);

    // Helper to consistently extract a WhatsApp phone number from Unipile attendee objects
    const extractWhatsappPhoneNumber = (attendee: typeof sender | (typeof payload.attendees)[number] | undefined): string => {
      if (!attendee) {
        return '';
      }

      // 1. Prefer explicit phone_number from attendee_specifics if present
      if (attendee.attendee_specifics && typeof attendee.attendee_specifics === 'object') {
        const phoneSpecific = attendee.attendee_specifics.phone_number;
        if (phoneSpecific) {
          return phoneSpecific.replace(/[^\d+]/g, '').replace(/\+/g, '');
        }
      }

      // 2. Next, try attendee_public_identifier like "919869403861@s.whatsapp.net"
      if (attendee.attendee_public_identifier) {
        const publicId = attendee.attendee_public_identifier;
        const beforeAt = publicId.split('@')[0];
        if (beforeAt) {
          return beforeAt.replace(/[^\d+]/g, '').replace(/\+/g, '');
        }
      }

      // 3. Fallback to attendee_provider_id / name, stripping non-digits
      if (attendee.attendee_provider_id) {
        return attendee.attendee_provider_id.replace(/[^\d+]/g, '').replace(/\+/g, '');
      }

      if (attendee.attendee_name) {
        return attendee.attendee_name.replace(/[^\d+]/g, '');
      }

      return '';
    };

    // Extract phone number from sender using the helper
    const phoneNumberFrom = extractWhatsappPhoneNumber(sender);
    
    // Find the recipient's phone number from the attendees array
    const recipient = payload.attendees.find(attendee => 
      attendee.attendee_provider_id !== sender.attendee_provider_id
    );

    // For self messages, provider_chat_id is the candidate chat JID (e.g. 919819185599@s.whatsapp.net)
    const providerChatPhone = payload.provider_chat_id
      ? payload.provider_chat_id.split('@')[0]?.replace(/[^\d]/g, '') || ''
      : '';
    
    // If no explicit recipient, fall back to provider_chat_id (self msgs) or connected account user_id
    const phoneNumberTo =
      extractWhatsappPhoneNumber(recipient) ||
      (isFromConnectedUser ? providerChatPhone : '') ||
      (account_info?.user_id ? String(account_info.user_id).replace(/[^\d+]/g, '') : '');

    // Self messages must use messageFromSelf so candidate lookup uses phoneNumberTo (recipient),
    // not phoneNumberFrom (connected account). Stored as assistant/botMessage for the candidate.
    const whatsappIncomingMessage: chatMessageType = {
      phoneNumberFrom: phoneNumberFrom,
      phoneNumberTo: phoneNumberTo,
      messages: [{ 
        role: isFromConnectedUser ? 'assistant' : 'user', 
        content: message 
      }],
      messageType: isFromConnectedUser ? 'messageFromSelf' : 'whatsapp-unipile',
    };

    console.log('Final WhatsApp phone from (phoneNumberFrom):', phoneNumberFrom);
    console.log('Final WhatsApp phone to (phoneNumberTo):', phoneNumberTo);
    
    // Use the new queue service to get candidate information and check for duplicates
    const queueService = new EngagedCandidateQueueService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.engagedCandidateMessageQueueService,
    );

    const { candidateProfileData, candidateJob, isDuplicate } = await queueService.getCandidateInformationWithDuplicateCheck(
      whatsappIncomingMessage,
      apiToken
    );

    if (candidateProfileData != emptyCandidateProfileObj) {
      if (isDuplicate) {
        console.log('WhatsApp Unipile message already exists in database, skipping processing');
        return;
      }

      // Create and update the message — document attachments become "CV Received"
      // so chat history / LLM agents know a resume arrived (not a blank/generic msg).
      const chatReply = buildIncomingAttachmentChatReply(
        message,
        payload.attachments,
      );
      await this.createAndUpdateIncomingCandidateChatMessage(
        {
          chatReply,
          whatsappDeliveryStatus: 'delivered',
          phoneNumberFrom: phoneNumberFrom,
          whatsappMessageId: message_id,
          messageType: isFromConnectedUser ? 'messageFromSelf' : 'whatsapp-unipile',
          isFromMe: isFromConnectedUser,
        },
        candidateProfileData,
        candidateJob,
        apiToken,
      );
    } else {
      console.log('WhatsApp Unipile message received from contact not in database');
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

  async getApiKeyToUseFromLinkedinMessageReceived(
    payload: UnipileMessageWebhook,
  ): Promise<ApiTokenResult | null> {
    console.log(
      'Going to get api token to use from LinkedIn message received:',
      JSON.stringify(payload, null, 2),
    );

    const { sender, account_info, message, account_id } = payload;

    const normalizeLinkedinIdentifier = (value: string): string => {
      if (!value) {
        return '';
      }

      if (value.startsWith('http')) {
        return value.replace('www.linkedin.com', 'linkedin.com');
      }

      return `https://linkedin.com/in/${value}`.replace(
        'www.linkedin.com',
        'linkedin.com',
      );
    };

    const escapeForLike = (value: string): string => value.replace(/'/g, "''");

    const incomingSenderIdentifierId = normalizeLinkedinIdentifier(
      sender.attendee_profile_url ||
        sender.attendee_provider_id ||
        sender.attendee_id,
    );

    if (!incomingSenderIdentifierId) {
      console.log(
        'No LinkedIn sender identifier found in payload, skipping token lookup',
      );

      return null;
    }

    console.log(
      'This is the normalized incomingSenderIdentifierId (LinkedIn sender)::',
      incomingSenderIdentifierId,
    );

    const workspaceId =
      await this.workspaceQueryService.findWorkspaceIdByLinkedinUnipileAccountId(
        account_id,
      );

    if (!workspaceId) {
      console.log(
        'No workspace found for LinkedIn Unipile account ID:',
        account_id,
      );

      return null;
    }

    console.log(
      'Workspace found for LinkedIn Unipile account ID:',
      workspaceId,
    );

    const dataSourceSchema =
      this.workspaceQueryService.getDataSourceSchema(workspaceId);

    const whatsappMessageTableExists =
      await this.workspaceQueryService.checkIfTableExists(
        dataSourceSchema,
        '_whatsappMessage',
      );

    if (!whatsappMessageTableExists) {
      console.log(
        `Table _whatsappMessage does not exist for schema ${dataSourceSchema}, skipping`,
      );

      return null;
    }

    const workspaceKeys =
      await this.workspaceQueryService.getWorkspaceKeys(workspaceId);

    let incomingRecipientIdentifierId = '';

    if (workspaceKeys?.linkedin_profile_id) {
      incomingRecipientIdentifierId = normalizeLinkedinIdentifier(
        workspaceKeys.linkedin_profile_id,
      );
    } else if (workspaceKeys?.linkedin_url) {
      incomingRecipientIdentifierId = normalizeLinkedinIdentifier(
        workspaceKeys.linkedin_url,
      );
    } else if (account_info?.user_id) {
      incomingRecipientIdentifierId = normalizeLinkedinIdentifier(
        account_info.user_id,
      );
    }

    if (!incomingRecipientIdentifierId) {
      console.log(
        'No LinkedIn recipient identifier configured for workspace:',
        workspaceId,
      );

      return null;
    }

    console.log(
      'This is the normalized incomingRecipientIdentifierId (LinkedIn recipient)::',
      incomingRecipientIdentifierId,
    );

    const safeSenderIdentifier = escapeForLike(incomingSenderIdentifierId);

    const recentMessageQuery = `SELECT * FROM ${dataSourceSchema}."_whatsappMessage" 
      WHERE ("_whatsappMessage"."phoneFrom" ILIKE '%${safeSenderIdentifier}%' OR "_whatsappMessage"."phoneTo" ILIKE '%${safeSenderIdentifier}%')
      ORDER BY "updatedAt" DESC
      LIMIT 1`;

    console.log(
      'Recent message query for LinkedIn contact::',
      recentMessageQuery,
    );

    const recentMessage = await this.workspaceQueryService.executeRawQuery(
      recentMessageQuery,
      [],
      workspaceId,
    );

    console.log('recentMessage for LinkedIn::', recentMessage);

    if (recentMessage.length === 0) {
      console.log(
        'No messages found for this LinkedIn contact in workspace, skipping message:',
        workspaceId,
      );

      return null;
    }

    const normalizedRecipientIdentifierId = incomingRecipientIdentifierId;

    const isMessageDuplicate = recentMessage.some((msg) => {
      const normalizedPhoneFrom = normalizeLinkedinIdentifier(
        msg.phoneFrom || '',
      );
      const normalizedPhoneTo = normalizeLinkedinIdentifier(msg.phoneTo || '');

      const messageMatches = msg.message === message;
      const senderMatches =
        normalizedPhoneFrom === incomingSenderIdentifierId ||
        normalizedPhoneTo === incomingSenderIdentifierId;
      const recipientMatches =
        normalizedPhoneFrom === normalizedRecipientIdentifierId ||
        normalizedPhoneTo === normalizedRecipientIdentifierId;

      return messageMatches && senderMatches && recipientMatches;
    });

    if (isMessageDuplicate) {
      console.log(
        'LinkedIn message already exists in database, skipping processing',
      );

      return null;
    }

    const senderSlug =
      incomingSenderIdentifierId.split('/').pop()?.replace(/\?.*$/, '') || '';
    const safeSenderSlug = escapeForLike(senderSlug);

    const personQueryConditions = [
      `"person"."linkedinLinkPrimaryLinkUrl" ILIKE '%${safeSenderIdentifier}%'`,
    ];

    if (senderSlug) {
      personQueryConditions.push(
        `"person"."linkedinLinkPrimaryLinkUrl" ILIKE '%${safeSenderSlug}%'`,
      );
    }

    const personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE ${personQueryConditions.join(
      ' OR ',
    )}`;

    console.log('Person query for LinkedIn contact::', personQuery);

    const person = await this.workspaceQueryService.executeRawQuery(
      personQuery,
      [],
      workspaceId,
    );

    if (person.length === 0) {
      console.log(
        'No person found for LinkedIn identifier:',
        incomingSenderIdentifierId,
      );

      return null;
    }

    console.log(
      'Person found for LinkedIn identifier::',
      incomingSenderIdentifierId,
    );

    const apiKeys = await this.workspaceQueryService.getApiKeys(
      workspaceId,
      dataSourceSchema,
    );

    if (!apiKeys || apiKeys.length === 0) {
      console.log(
        'No API keys configured for workspace:',
        workspaceId,
        'schema:',
        dataSourceSchema,
      );

      return null;
    }

    const apiKeyToken =
      await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
      );

    if (!apiKeyToken) {
      console.log(
        'Failed to generate API key token for workspace:',
        workspaceId,
      );

      return null;
    }

    return {
      token: apiKeyToken.token,
      workspaceId,
    };
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

    const match = results.find(
      (result): result is MessageResult => result !== null,
    );

    if (match?.token && match.workspaceId) {
      return {
        token: match.token,
        workspaceId: match.workspaceId,
      };
    }

    return null;
  }

  async getApiKeyToUseFromWhatsappUnipileMessageReceived(
    payload: UnipileMessageWebhook,
  ): Promise<ApiTokenResult | null> {

    const { sender, message, account_id } = payload;

    // Reuse the same phone extraction logic as receiveIncomingMessageFromWhatsappUnipile
    const extractWhatsappPhoneNumber = (attendee: typeof sender | (typeof payload.attendees)[number] | undefined): string => {
      if (!attendee) {
        return '';
      }

      if (attendee.attendee_specifics && typeof attendee.attendee_specifics === 'object') {
        const phoneSpecific = attendee.attendee_specifics.phone_number;
        if (phoneSpecific) {
          return phoneSpecific.replace(/[^\d+]/g, '');
        }
      }

      if (attendee.attendee_public_identifier) {
        const publicId = attendee.attendee_public_identifier;
        const beforeAt = publicId.split('@')[0];
        if (beforeAt) {
          return beforeAt.replace(/[^\d+]/g, '');
        }
      }

      if (attendee.attendee_provider_id) {
        return attendee.attendee_provider_id.replace(/[^\d+]/g, '');
      }

      if (attendee.attendee_name) {
        return attendee.attendee_name.replace(/[^\d+]/g, '');
      }

      return '';
    };

    const incomingSenderIdentifierId = extractWhatsappPhoneNumber(sender);

    const workspaceId =
      await this.workspaceQueryService.findWorkspaceIdByWhatsappUnipileAccountId(
        account_id,
      );

    if (!workspaceId) {
      console.log(
        'No workspace found for WhatsApp Unipile account ID:',
        account_id,
      );

      return null;
    }

    const dataSourceSchema =
      this.workspaceQueryService.getDataSourceSchema(workspaceId);

    const whatsappMessageTableExists =
      await this.workspaceQueryService.checkIfTableExists(
        dataSourceSchema,
        '_whatsappMessage',
      );

    if (!whatsappMessageTableExists) {
      console.log(
        `Table _whatsappMessage does not exist for schema ${dataSourceSchema}, skipping`,
      );

      return null;
    }

    const workspaceKeys =
      await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
    const incomingRecipientIdentifierId =
      workspaceKeys?.whatsapp_web_phone_number || '';

    if (!incomingRecipientIdentifierId) {
      console.log(
        'No WhatsApp web phone number configured for workspace:',
        workspaceId,
      );

      return null;
    }

    const normalizedPhoneNumber = incomingSenderIdentifierId.replace(
      /[^\d+]/g,
      '',
    ).replace(/\+/g, '');
    const normalizedRecipientPhoneNumber =
      incomingRecipientIdentifierId.replace(/[^\d+]/g, '').replace(/\+/g, '');

    // Match stored 10-digit phones (e.g. 9136465636) when Unipile sends
    // country-code form (e.g. 919136465636). Same as Facebook/Baileys paths.
    const phoneNumberForLookup =
      normalizedPhoneNumber.length > 10
        ? normalizedPhoneNumber.slice(-10)
        : normalizedPhoneNumber;

    if (phoneNumberForLookup !== normalizedPhoneNumber) {
      console.log(
        'WhatsApp Unipile phone number is more than 10 digits, using last 10 for lookup:',
        { full: normalizedPhoneNumber, lookup: phoneNumberForLookup },
      );
    }

    const recentMessageQuery = `SELECT * FROM ${dataSourceSchema}."_whatsappMessage" 
      WHERE ("_whatsappMessage"."phoneFrom" ILIKE '%${phoneNumberForLookup}%' OR "_whatsappMessage"."phoneTo" ILIKE '%${phoneNumberForLookup}%')
      ORDER BY "updatedAt" DESC
      LIMIT 1`;

    const recentMessage = await this.workspaceQueryService.executeRawQuery(
      recentMessageQuery,
      [],
      workspaceId,
    );


    if (recentMessage.length === 0) {
      console.log(
        'No messages found for this WhatsApp contact in workspace, skipping message:',
        workspaceId,
      );

      return null;
    }

    const phoneDigitsMatch = (stored: string | null | undefined, candidate: string) => {
      if (!stored || !candidate) {
        return false;
      }
      const storedDigits = stored.replace(/[^\d]/g, '');
      return (
        storedDigits === candidate ||
        storedDigits.endsWith(candidate) ||
        candidate.endsWith(storedDigits)
      );
    };

    const isMessageDuplicate = recentMessage.some((msg) => {
      const messageMatches = msg.message === message;
      const senderMatches =
        phoneDigitsMatch(msg.phoneFrom, normalizedPhoneNumber) ||
        phoneDigitsMatch(msg.phoneTo, normalizedPhoneNumber) ||
        phoneDigitsMatch(msg.phoneFrom, phoneNumberForLookup) ||
        phoneDigitsMatch(msg.phoneTo, phoneNumberForLookup);
      const recipientMatches =
        phoneDigitsMatch(msg.phoneFrom, normalizedRecipientPhoneNumber) ||
        phoneDigitsMatch(msg.phoneTo, normalizedRecipientPhoneNumber);

      return messageMatches && senderMatches && recipientMatches;
    });

    if (isMessageDuplicate) {
      return null;
    }

    const personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."phonesPrimaryPhoneNumber" ILIKE '%${phoneNumberForLookup}%'`;

    const person = await this.workspaceQueryService.executeRawQuery(
      personQuery,
      [],
      workspaceId,
    );

    if (person.length === 0) {
      console.log(
        'No person found for WhatsApp Unipile phone number:',
        normalizedPhoneNumber,
        '(looked up as',
        phoneNumberForLookup,
        ')',
      );

      return null;
    }

    const apiKeys = await this.workspaceQueryService.getApiKeys(
      workspaceId,
      dataSourceSchema,
    );

    if (!apiKeys || apiKeys.length === 0) {
      console.log(
        'No API keys configured for workspace:',
        workspaceId,
        'schema:',
        dataSourceSchema,
      );

      return null;
    }

    const apiKeyToken =
      await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
      );

    if (!apiKeyToken) {
      console.log('Failed to generate API key token for workspace:', workspaceId);

      return null;
    }

    return {
      token: apiKeyToken.token,
      workspaceId,
    };
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

      console.log(`Message: ${userMessageBody?.text?.body}, 
        To: ${requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number},
        From: ${userMessageBody?.from},
        Name: ${requestBody?.entry[0]?.changes[0]?.value?.contacts?.[0]?.profile?.name}`);
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
            chatReply: chatReply || 'CV Received',
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
            this.whatsappMediaStorageService,
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
            this.whatsappMediaStorageService,
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
    console.log("This is the replyObject in createAndUpdate Incoming CandidateChatMessage::", replyObject);
    
    try {
      const { EngagedCandidateQueueService } = await import('../candidate-engagement/engaged-candidate-queue.service');
      
      const queueService = new EngagedCandidateQueueService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.engagedCandidateMessageQueueService,
      );
      console.log("Adding to queue service to process engagement operations");
      const whatappUpdateMessageObj = await queueService.processEngagementOperations(
        replyObject,
        candidateProfileDataNodeObj,
        candidateJob,
        apiToken,
      );

      console.log("Message was processed successfully and we should queue for engagement");
      if (whatappUpdateMessageObj && shouldQueue && !replyObject.isFromMe && candidateProfileDataNodeObj?.id) {
        try {
          const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
          if (workspaceId) {
            console.log(`🔄 QUEUEING CANDIDATE FOR ENGAGEMENT: ${candidateProfileDataNodeObj.id} (incoming message)`);
            await this.queueCandidateForEngagement(
              candidateProfileDataNodeObj.id,
              workspaceId,
              replyObject.whatsappMessageId,
              true,
              candidateJob?.engagementProcessingDelayMinutes,
            );
          }
        } catch (error) {
          console.error('Error queuing candidate for engagement:', error);
        }
      }

      return whatappUpdateMessageObj;

    } catch (error) {
      console.error('Error in createAndUpdateIncomingCandidateChatMessage:', error);
      throw error;
    }
  }
}
