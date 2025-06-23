import { Injectable } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';

import { Boom } from '@hapi/boom';
import makeWASocket, {
  delay,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import MAIN_LOGGER from '@whiskeysockets/baileys/lib/Utils/logger';
import NodeCache from 'node-cache';
import { SocksProxyAgent } from 'socks-proxy-agent';
import {
  CandidateNode,
  chatMessageType,
  emptyCandidateProfileObj,
  graphqlToFetchWhatsappMessageByWhatsappId,
  graphQlToFetchWhatsappMessages,
  graphqlToUpdateWhatsappMessageId,
  WhatsAppBusinessAccount,
} from 'twenty-shared';

import { FilterCandidates } from '../arx-chat/services/candidate-engagement/filter-candidates';
import { IncomingWhatsappMessages } from '../arx-chat/services/whatsapp-api/incoming-messages';
import { axiosRequest } from '../arx-chat/utils/arx-chat-agent-utils';
import { AttachmentProcessingService } from '../arx-chat/utils/attachment-processes';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';

// import { IEventsGateway } from './events-gateway-module/events-gateway.interface';
// import { makeStore } from './helpers/store';
import { GraphQLExecutionService } from 'src/engine/core-modules/candidate-sourcing/utils/utils';
import { IEventsGateway } from 'src/engine/core-modules/whiskeysocket-baileys/events-gateway-module/events-gateway.interface';
import { FileDataDto, MessageDto } from './types/baileys-types';

interface MessageResult {
  token: string;
  lastMessageTime: Date;
  workspaceId: string;
}

export interface FormattedMessage {
  id: string;
  messageTimestamp: number;
  message: string;
  fromMe: boolean;
  phoneFrom: string;
  phoneTo: string;
  messageType: string;
  mediaUrl: string | null;
}

const nodeCache = new NodeCache();

const agent = new SocksProxyAgent(process.env.SMART_PROXY_URL || '');

// const apiToken = process.env.TWENTY_JWT_SECRET || '';
// WhatsappService(USER).eventsGateway.emitEvent();

@Injectable()
export class BaileysWhatsappService {
  private readonly logger = MAIN_LOGGER.child({});
  private sock: any;
  // private store: any = makeStore();
  public whatsappLoginQrString = '';
  private recruiterId: string = '';
  private connectionStatus: boolean = false;
  private eventsGateway: IEventsGateway;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly graphQLExecutionService: GraphQLExecutionService,
  ) {}

  initializeSession(recruiterId: string, eventsGateway: IEventsGateway): void {
    console.log('Initializing WhatsApp session for recruiter:', recruiterId);
    this.recruiterId = recruiterId;
    this.eventsGateway = eventsGateway;
    this.startSock();
  }

  sendConnectionUpdate() {
    console.log('Sending WhatsApp connection update for recruiter:', this.recruiterId, 'status:', this.connectionStatus);
    this.eventsGateway.emitEventTo(
      'isWhatsappLoggedIn',
      this.connectionStatus,
      this.recruiterId,
    );
  }

  private async startSock() {
    const isSocketActive = this.sock?.ws?.readyState === 1;
    if (isSocketActive) {
      console.log('WhatsApp socket is already active for recruiter:', this.recruiterId);
      this.sendConnectionUpdate();
      if (!this.connectionStatus && this.whatsappLoginQrString) {
        console.log('Re-emitting existing QR code for recruiter:', this.recruiterId);
        this.eventsGateway.emitEventTo('qr', this.whatsappLoginQrString, this.recruiterId);
      }
      return;
    }

    if (this.sock) {
      console.log('Closing existing WhatsApp socket for recruiter:', this.recruiterId);
      await this.sock.end();
      this.sock = null;
      await delay(2000);
    }

    try {
      await this.ensureAuthDirectory();
      
      const { state, saveCreds } = await useMultiFileAuthState(
        'baileys_auth_info/' + this.recruiterId,
      );

      // Check if we have valid credentials before proceeding
      const hasValidCreds = state.creds?.me?.id && state.creds?.registered;
      console.log(`Checking credentials for recruiter ${this.recruiterId}:`, hasValidCreds ? 'Valid' : 'Invalid/Missing');

      const { version, isLatest } = await fetchLatestBaileysVersion();

      console.log(`Initializing WhatsApp v${version.join('.')} for recruiter:`, this.recruiterId);
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger),
        },
        logger: this.logger,
        msgRetryCounterCache: nodeCache,
        syncFullHistory: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        browser: ['Arxena', 'Chrome', '1.0.0'],
        getMessage: async (key) => {
          console.log('Getting message:', key, 'for recruiter:', this.recruiterId);
          return undefined;
        },
        retryRequestDelayMs: 2000,
        // Add automatic reconnect options
        shouldIgnoreJid: jid => {
          if (!jid) return true;
          return !jid.includes('@s.whatsapp.net');
        },
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 30000,
        patchMessageBeforeSending: (message) => {
          const requiresPatch = !!(
            message.buttonsMessage 
            || message.templateMessage
            || message.listMessage
          );
          if (requiresPatch) {
            message = {
              viewOnceMessage: {
                message: {
                  messageContextInfo: {
                    deviceListMetadataVersion: 2,
                    deviceListMetadata: {},
                  },
                  ...message,
                },
              },
            };
          }
          return message;
        }
      });

      this.connectionStatus = false;
      this.whatsappLoginQrString = '';
      this.sendConnectionUpdate();

      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = hasValidCreds ? 10 : 3;

      this.sock.ev.process(async (events) => {
        console.log('Processing WhatsApp events for recruiter:', this.recruiterId, 'events keys:', Object.keys(events));
        console.log('Processing WhatsApp events for recruiter:', this.recruiterId, 'events:',events);
        console.log('Processing WhatsApp events presence.update for recruiter:', this.recruiterId, 'events:',events['presence.update']);
        console.log('Processing WhatsApp events presence.update for recruiter:', this.recruiterId, 'events:',events['presence.update']?.presences);
        console.log('Processing WhatsApp events messaging-history.set for recruiter:', this.recruiterId, 'events:',events['messaging-history.set']?.contacts);
        console.log('Processing WhatsApp events messaging-history.set for recruiter:', this.recruiterId, 'events:',events['messaging-history.set']?.contacts[0]);

        if (events['connection.update']) {
          const update = events['connection.update'];
          const { connection, lastDisconnect, qr } = update;
          console.log('WhatsApp connection update for recruiter:', this.recruiterId, { connection, lastDisconnect: lastDisconnect?.error?.output, qr: !!qr });

          if (qr) {
            console.log('New QR code received for recruiter:', this.recruiterId);
            this.whatsappLoginQrString = qr;
            this.eventsGateway.emitEventTo('qr', qr, this.recruiterId);
            // Reset reconnect attempts when new QR is generated
            reconnectAttempts = 0;
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const disconnectReason = lastDisconnect?.error?.output?.payload?.error;
            console.log('Connection closed with status:', statusCode, 'reason:', disconnectReason, "for recruiterId", this.recruiterId);
            
            if (statusCode === 401 || statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
              console.log('Unauthorized/logged out - clearing auth and requesting new QR code', "for recruiterId", this.recruiterId);
              await this.clearAuthAndRestart(true);
              return;
            }

            reconnectAttempts++;
            const shouldReconnect = reconnectAttempts < MAX_RECONNECT_ATTEMPTS && 
                                  statusCode !== DisconnectReason.loggedOut && 
                                  statusCode !== DisconnectReason.badSession &&
                                  statusCode !== 401;

            console.log('Connection closed, attempt:', reconnectAttempts, 'of', MAX_RECONNECT_ATTEMPTS, ', reconnecting:', shouldReconnect, "for recruiterId", this.recruiterId);
            
            if (shouldReconnect) {
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000); // Exponential backoff
              console.log(`Waiting ${delay}ms before reconnect attempt...`, "for recruiterId", this.recruiterId);
              await new Promise(resolve => setTimeout(resolve, delay));
              await this.startSock();
            } else {
              console.log('Max reconnection attempts reached or permanent disconnect - clearing auth', "for recruiterId", this.recruiterId);
              await this.clearAuthAndRestart(true);
            }
          }

          if (connection === 'open') {
            console.log('Connection opened successfully', "for recruiterId", this.recruiterId);
            this.connectionStatus = true;
            this.sendConnectionUpdate();
            reconnectAttempts = 0; // Reset counter on successful connection
            
            try {
              const chats = await this.sock.groupFetchAllParticipating();
              console.log('Successfully fetched group participants');
              console.log('Successfully connected to WhatsApp');
            } catch (error) {
              console.error('Error fetching group participants:', error);
            }
          }
        }

        if (events['creds.update']) {
          console.log('Credentials updated - saving');
          await saveCreds();
        }

        if (events['messages.upsert']) {
          const upsert = events['messages.upsert'];
          console.log("upsert.messages", upsert.messages[0]?.message?.extendedTextMessage?.text, "for this.recruiterId", this.recruiterId)
          console.log("upsert.messages object", upsert?.messages[0]?.message?.conversation, "for this.recruiterId", this.recruiterId)
          const selfWhatsappID = this.sock?.user?.id;
          const selfPhoneNumber = selfWhatsappID?.split(':')[0];

          console.log('Phone Number selfWhatsappID:', selfWhatsappID, "for this.recruiterId", this.recruiterId);

          if (upsert.type === 'notify' || upsert.type === 'append') {
            let phoneNumberTo = '';

            try {
              // Handle potential Bad MAC errors
              if (upsert.messages[0]?.messageStubParameters?.includes('BadMAC')) {
                console.log('Bad MAC error detected, attempting to refresh session', "for this.recruiterId", this.recruiterId);
                await this.clearAuthAndRestart();
                return;
              }

              phoneNumberTo = upsert?.messages[0]?.key?.remoteJid?.replace(
                '@s.whatsapp.net',
                '',
              );
            } catch (error) {
              if (error.message?.includes('Bad MAC')) {
                console.log('Bad MAC error caught, attempting to refresh session', "for this.recruiterId", this.recruiterId);
                await this.clearAuthAndRestart();
                return;
              }
              console.error('Error processing message:', error);
              phoneNumberTo = '';
            }

            for (const msg of upsert.messages) {
              if (!msg.key.fromMe) {
                const data: any = {
                  msg: `got message from:${msg?.pushName}(${msg?.key?.remoteJid}) and message is:${msg?.message?.conversation}`,
                  fromName: msg?.pushName,
                  fromRemoteJid: msg?.key?.remoteJid,
                  message:
                    msg?.message?.conversation ||
                    msg?.message?.extendedTextMessage?.text ||
                    '',
                };

                const event = 'message';

                console.log('replying to', msg.key.remoteJid, "for this.recruiterId", this.recruiterId);
                const whatsappIncomingMessage: chatMessageType = {
                  phoneNumberFrom:
                    '+' + msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                  phoneNumberTo: phoneNumberTo,
                  messages: [],
                  messageType: 'string',
                };

                // Get API token for this message
                const apiToken = await this.getApiKeyToUseFromPhoneNumberMessageReceived(
                  {
                    object: 'whatsapp_business_account',
                    entry: [{
                      id: 'message_' + Date.now(),
                      changes: [{
                        value: {
                          messages: [{
                            from: msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                          }],
                          metadata: {
                            phone_number_id: selfPhoneNumber
                          }
                        }
                      }]
                    }]
                  },
                  msg
                );

                if (!apiToken) {
                  console.log('No API token found for this message, skipping processing');
                  continue;
                }

                const candidateProfileData = await new FilterCandidates(
                  this.workspaceQueryService,
                  this.graphQLExecutionService,
                ).getCandidateInformation(whatsappIncomingMessage, apiToken);

                if (msg?.message?.protocolMessage?.type === 0) {
                  await this.handleDeleteForEveryoneMessage(
                    msg,
                    candidateProfileData,
                    apiToken
                  );
                  continue;
                }

                if (candidateProfileData == emptyCandidateProfileObj) {
                  continue;
                }

                let isMediaDownloaded = false;
                let isReactionMessage = false;
                let textMessageToSend =
                  msg?.message?.conversation ||
                  msg?.message?.extendedTextMessage?.text ||
                  (isMediaDownloaded && 'Attachment Received') ||
                  '';

                if (
                  msg?.message?.messageType === 'imageMessage' ||
                  'videoMessage' ||
                  'documentMessage' ||
                  'messageContextInfo'
                ) {
                  isMediaDownloaded = true;
                }

                if (msg?.message?.reactionMessage) {
                  isReactionMessage = true;
                  const whatsappMessageReacted = await this.fetchWhatsappMessageById(
                    msg?.message?.reactionMessage?.key?.id,
                    apiToken
                  );

                  if (msg?.message?.reactionMessage?.text === '') {
                    textMessageToSend =
                      'Unreacted reaction' +
                        msg?.message?.reactionMessage?.text +
                        ' to ' +
                        "'" +
                        whatsappMessageReacted?.data?.whatsappMessage?.message +
                        "'" || '';
                  } else {
                    textMessageToSend =
                      'Reacted ' +
                        msg?.message?.reactionMessage?.text +
                        ' to ' +
                        "'" +
                        whatsappMessageReacted?.data?.whatsappMessage?.message +
                        "'" || '';
                  }
                }

                const baileysWhatsappIncomingObj = {
                  phoneNumberFrom:
                    '+' + msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                  message: textMessageToSend,
                  phoneNumberTo: selfPhoneNumber,
                  messageTimeStamp: msg?.messageTimestamp,
                  fromName: msg?.pushName,
                  baileysMessageId: msg?.key?.id,
                };

                await this.downloadAllMediaFiles(
                  msg,
                  this.sock,
                  msg.key.remoteJid,
                  candidateProfileData,
                  apiToken
                );
                
                await new IncomingWhatsappMessages(
                  this.workspaceQueryService,
                  this.graphQLExecutionService,
                ).receiveIncomingMessages(
                  baileysWhatsappIncomingObj,
                  apiToken,
                );

                this.sock?.server?.emit(event, data);
              } else {
                console.log('Message is from me:', msg.key.fromMe);
                const baileysWhatsappIncomingObj = {
                  phoneNumberTo:
                    '+' + msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                  message:
                    msg?.message?.conversation ||
                    msg?.message?.extendedTextMessage?.text ||
                    '',
                  phoneNumberFrom: selfPhoneNumber,
                  messageTimeStamp: msg?.messageTimestamp,
                  fromName: msg?.pushName,
                  baileysMessageId: msg?.key?.id,
                };

                // Get API token for self messages
                const apiToken = await this.getApiKeyToUseFromPhoneNumberMessageReceived(
                  {
                    object: 'whatsapp_business_account',
                    entry: [{
                      id: 'self_message_' + Date.now(),
                      changes: [{
                        value: {
                          messages: [{
                            from: selfPhoneNumber
                          }],
                          metadata: {
                            phone_number_id: msg?.key?.remoteJid?.replace('@s.whatsapp.net', '')
                          }
                        }
                      }]
                    }]
                  },
                  msg
                );

                if (apiToken) {
                  await new IncomingWhatsappMessages(
                    this.workspaceQueryService,
                    this.graphQLExecutionService,
                  ).receiveIncomingMessagesFromSelfFromBaileys(
                    baileysWhatsappIncomingObj,
                    apiToken,
                  );
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error starting WhatsApp socket for recruiter:', this.recruiterId, error);
      this.connectionStatus = false;
      this.sendConnectionUpdate();
    }
  }

  async getApiKeyToUseFromPhoneNumberMessageReceived(
    requestBody: WhatsAppBusinessAccount,
    messageData?: any,
  ): Promise<string | null> {
    console.log("Going to get api token to use from phone number message received");
    let incomingSenderIdentifierId = requestBody?.entry[0]?.changes[0]?.value?.messages?.[0]?.from ||
                                    requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.recipient_id;
    console.log("This is the incomingSenderIdentifierId::", incomingSenderIdentifierId);
    const incomingRecipientIdentifierId = requestBody?.entry[0]?.changes[0]?.value?.metadata?.phone_number_id;
    console.log("This is the incomingRecipientIdentifierId::", incomingRecipientIdentifierId);
    console.log("This is the requestBody in api key to use from phone number message received::", requestBody);
    console.log('This is the phone number to use and search:', incomingSenderIdentifierId);
    if (incomingSenderIdentifierId == incomingRecipientIdentifierId) {
      console.log('This is a self message, we will not use this phone number to send messages');
      return null;
    }

    if (incomingSenderIdentifierId.includes('broadcast')) {
      console.log('This is a broadcast message, we will not use this phone number to send messages');
      return null;
    }

    const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
      async (workspaceId, dataSourceSchema) => {
        console.log('Data source schema is::', dataSourceSchema);
        console.log('id:', workspaceId);        
        let rawQuery = '';
        if (incomingRecipientIdentifierId?.includes('linkedin')) {
          console.log('This is a linkedin phone number, we will not use this phone number to send messages to setup linkedin url as recipient id for api key finding');
          rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND linkedin_url ILIKE '%${incomingRecipientIdentifierId}%'`;
        } else {
          rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND facebook_whatsapp_phone_number_id ILIKE '%${incomingRecipientIdentifierId}%'`;
        }
        console.log('This is rawQuery:', rawQuery);
        const workspace = await this.workspaceQueryService.executeRawQuery(
          rawQuery,
          [workspaceId],
          workspaceId,
        );
        if (workspace.length === 0) {
          console.log("Workspace length is 0 for facebook whatsapp phone number id", "for this.recruiterId", this.recruiterId);
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
            } else {
              console.log("It is a self message, so we will use the incomingRecipientIdentifierId");
              incomingSenderIdentifierId = incomingRecipientIdentifierId;
            }
            console.log("Workspace found for whatsapp web phone number::", workspace);
          }
        }
        console.log('Whatsapp incoming incomingSenderIdentifierId::::', incomingSenderIdentifierId);
        if (incomingSenderIdentifierId?.includes('linkedin')) {
          console.log('This is a linkedin phone number, we will not use this phone number to send messages');
        }
        let recentMessageQuery = '';
        if (incomingSenderIdentifierId?.includes('linkedin')) {
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
        console.log("Message data::", messageData);

        const recentMessage = await this.workspaceQueryService.executeRawQuery(
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
          console.log('No messages found for this phone number in workspace so will return because incoming not worth it:', workspaceId);
          // was null earlier, but now returning null will cause the message to be skipped
          // return null;
        }

        if (incomingSenderIdentifierId?.length > 10 && !incomingSenderIdentifierId?.includes('linkedin')) {
          incomingSenderIdentifierId = incomingSenderIdentifierId.slice(-10);
        }

        let personQuery = '';
        if (!incomingSenderIdentifierId?.includes('linkedin')) {
          personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."phonesPrimaryPhoneNumber" ILIKE '%${incomingSenderIdentifierId}%'`;
        } else {
          personQuery = `SELECT * FROM ${dataSourceSchema}.person WHERE "person"."linkedinLinkPrimaryLinkUrl" ILIKE '%${incomingSenderIdentifierId}%'`;
        }

        console.log('This is the person query:', personQuery);

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
          );

          if (apiKeys.length > 0) {
            const apiKeyToken = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
              workspaceId,
              apiKeys[0].id,
            );

            console.log('This is the api key token::', apiKeyToken);
            console.log('This is the recent message in whasapp baileys service::', recentMessage);

            if (apiKeyToken) {
              return {
                token: apiKeyToken?.token,
                lastMessageTime: messageData?.messageTimestamp,
                workspaceId,
              };
            }
          }
        }

        return null;
      },
    );

    const validResults = results.filter(
      (result): result is MessageResult => result !== null,
    );

    if (validResults.length === 0) return null;

    const sortedResults = validResults.sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime(),
    );
    
    return sortedResults[0]?.token ?? null;
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

      return response?.data;
    } catch (error) {
      console.log('Error fetching whatsapp message by id:', error);
      return { error: error };
    }
  }

  async handleDeleteForEveryoneMessage(msg: any, candidateProfile: CandidateNode, apiToken: string) {
    console.log('This is the candidateProfile:', candidateProfile);
    const whatsappMessageToGetDeleted = await this.fetchWhatsappMessageById(
      msg?.message?.protocolMessage?.key?.id,
      apiToken
    );

    console.log('whatsappMessageToGetDeleted:', whatsappMessageToGetDeleted);
    const messageObj =
      whatsappMessageToGetDeleted?.data?.whatsappMessage?.messageObj;

    console.log('messageObj:', messageObj);
    const messagesAfterDeletingTheCurrentMessage = messageObj?.slice(
      0,
      messageObj?.length - 1,
    );

    try {
      const variables = {
        limit: 1,
        filter: {
          candidateId: {
            eq: candidateProfile?.id,
          },
        },
        orderBy: [
          {
            position: 'AscNullsFirst',
          },
        ],
      };
      const responseAfterFetchingAllMessagesByCandidateId = await axiosRequest(
        JSON.stringify({
          query: graphQlToFetchWhatsappMessages,
          variables: variables,
        }),
        apiToken,
      );
      const latestMessageObject: any[] =
        responseAfterFetchingAllMessagesByCandidateId?.data?.data
          ?.whatsappMessages?.edges[0]?.node?.messageObj;

      const updatedMessageHistoryObject: any = [];

      for (let i = latestMessageObject.length - 1; i >= 0; i--) {
        if (
          whatsappMessageToGetDeleted?.data?.whatsappMessage?.message !==
          latestMessageObject[i].content
        ) {
          updatedMessageHistoryObject.unshift(latestMessageObject[i]);
        }
      }

      const dataToUpdate = {
        idToUpdate:
          responseAfterFetchingAllMessagesByCandidateId?.data?.data
            ?.whatsappMessages?.edges[0]?.node?.id,
        input: {
          messageObj: updatedMessageHistoryObject,
        },
      };
      const response = await axiosRequest(
        JSON.stringify({
          query: graphqlToUpdateWhatsappMessageId,
          variables: dataToUpdate,
        }),
        apiToken,
      );

      console.log('Response from updating the message:', response?.data);
    } catch (error) {
      console.log('Error updating the message', error);
    }
  }

  async downloadAllMediaFiles(
    m: any,
    socket: any,
    folder: any,
    candidateProfileData: CandidateNode,
    apiToken: string,
  ) {
    let messageType = '';

    try {
      messageType = Object.keys(m.message)[0];
    } catch {
      console.log('message type errored');
    }

    const message = m?.message;
    let ogFileName = '';

    if (messageType == 'imageMessage') {
      ogFileName = `${new Date().getTime()}.jpeg`;
      folder = folder + '/images';
    } else if (messageType == 'videoMessage') {
      ogFileName = `${new Date().getTime()}.mp4`;
      folder = folder + '/videos';
    } else if (messageType == 'messageContextInfo') {
      ogFileName =
        message?.documentMessage?.fileName ||
        message?.documentWithCaptionMessage?.message?.documentMessage
          ?.fileName ||
        `${new Date().getTime()}.pdf`;
      folder = folder + '/messageContext';
    } else if (messageType == 'documentMessage') {
      ogFileName = message.documentMessage.fileName;
      folder = folder + '/docs';
    } else {
      return false;
    }

    try {
      if (candidateProfileData != emptyCandidateProfileObj) {
        console.log('Candidate is in the database');
        const buffer = await downloadMediaMessage(
          m,
          'buffer',
          {},
          { logger: this.logger, reuploadRequest: socket.updateMediaMessage },
        );
        const data: any = { fileName: ogFileName, fileBuffer: buffer };

        console.log('Got the data for upload attachemnets:', data);
        await this.handleFileUpload(
          data,
          './.attachments/' + folder,
          candidateProfileData,
          apiToken
        );

        return true;
      } else {
        console.log(
          'Message has been received from a candidate however the candidate is not in the database',
        );
      }
    } catch (error) {
      console.log('Error downloading media:', error);
    }
  }

  async handleFileUpload(
    file: FileDataDto,
    userDirectory: string,
    candidateProfileData: CandidateNode,
    apiToken: string,
  ): Promise<FileDataDto> {
    try {
      console.log('userDirectory:', userDirectory);
      console.log('file:', file);
      userDirectory = await this.createDirectoryIfNotExists(userDirectory);
      file.filePath = path.join(userDirectory, file.fileName);
      console.log(file.filePath);
      await fs.promises.writeFile(file.filePath, file.fileBuffer);
      const attachmentObj =
        await new AttachmentProcessingService().uploadAttachmentToTwenty(
          file.filePath,
          apiToken,
        );

      const dataToUploadInAttachmentTable = {
        input: {
          authorId: candidateProfileData.jobs.recruiterId,
          name: file.fileName,
          fullPath: attachmentObj.data.uploadFile,
          type: 'TextDocument',
          candidateId: candidateProfileData.id,
        },
      };

      await new AttachmentProcessingService().createOneAttachmentFromFilePath(
        dataToUploadInAttachmentTable,
        apiToken,
      );

      return file;
    } catch (error) {
      throw new Error(`Error handling file upload: ${error}`);
    }
  }

  async createDirectoryIfNotExists(
    dirPath: string,
    defaultDir: string = process.env.UPLOAD_DEFAULT_LOCATION || 'FileUploads',
  ): Promise<string> {
    const filePath = path.join(`${dirPath}/`);

    try {
      // Check if directory exists
      await fs.promises.access(filePath, fs.constants.F_OK);

      return filePath;
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        await fs.promises.mkdir(filePath, { recursive: true });

        return filePath;
      } catch (mkdirError) {
        throw new Error(`Error creating directory: ${mkdirError}`);
      }
    }
  }

  async sendMessageWTyping(msg: string, jid: string) {
    await this.sock.presenceSubscribe(jid);
    await delay(500);
    await this.sock.sendPresenceUpdate('composing', jid);
    await delay(1000);
    await this.sock.sendPresenceUpdate('paused', jid);
    const sendMessageResponse = await this.sock.sendMessage(jid, { text: msg });

    // console.log('sendMessageResponse in baileys service::', sendMessageResponse);
    return sendMessageResponse?.key?.id;
  }

  async sendMessageFileToBaileys(body: MessageDto) {
    const {
      jid,
      message,
      fileData: { filePath, mimetype, fileName } = {} as any,
    } = body;

    console.log('file media ', { jid, message, filePath, mimetype, fileName });
    try {
      const sendMessageResponse = await this.sock.sendMessage(
        jid,
        { document: { url: filePath }, caption: message, mimetype, fileName },
        { url: filePath },
      );

      return sendMessageResponse?.key?.id;
    } catch (error) {
      console.log('baileys.sendMessage got error');
      // this.handleError(error);
    }
  }

  public async clearAuthAndRestart(forceNewQR: boolean = false): Promise<void> {
    const authPath = 'baileys_auth_info/' + this.recruiterId;
    try {
      // First, clear the socket connection
      if (this.sock) {
        try {
          // Force logout if socket is connected
          if (this.sock.ws?.readyState === 1) {
            await this.sock.logout();
            console.log('Successfully logged out of WhatsApp socket');
          }
        } catch (logoutErr) {
          console.log('Logout failed (expected if connection already closed):', logoutErr.message);
        }
        
        try {
          // End the socket connection
          await this.sock.end();
          console.log('Successfully ended WhatsApp socket connection');
        } catch (endErr) {
          console.log('End connection failed (expected if already closed):', endErr.message);
        }

        // Clear socket reference
        this.sock = null;
      }

      // Update connection status and notify clients
      this.connectionStatus = false;
      this.whatsappLoginQrString = '';

      // Clear auth files only on explicit logout (forceNewQR = true)
      if (forceNewQR) {
        try {
          if (fs.existsSync(authPath)) {
            await fs.promises.rm(authPath, { recursive: true, force: true });
            console.log('Auth directory cleared successfully:', authPath);
          }
        } catch (rmErr) {
          console.error('Error removing auth directory:', rmErr);
        }

        // Ensure auth directory exists for new session
        await this.ensureAuthDirectory();

        // Clear cache
        nodeCache.flushAll();
        console.log('Node cache cleared');

        // Wait before restarting
        await delay(2000);
        
        console.log('Forcing new QR code generation');
        await this.startSock();
      }
    } catch (err) {
      console.error('Error during auth cleanup:', err);
      throw err;
    }
  }

  private async ensureAuthDirectory(): Promise<void> {
    const authPath = 'baileys_auth_info/' + this.recruiterId;
    try {
      await fs.promises.mkdir(authPath, { recursive: true });
      console.log('Auth directory ensured:', authPath);
    } catch (err) {
      console.error('Error ensuring auth directory:', err);
      throw err;
    }
  }

  async fetchMessageHistory(jid: string, limit: number): Promise<FormattedMessage[]> {
    if (!this.sock) {
      throw new Error('WhatsApp connection not initialized');
    }
  
    try {
      // First, we need to get the oldest message from the database/store
      const oldestMessage = await this.getOldestMessageInChat(jid);
      
      if (!oldestMessage) {
        console.log('No messages found in chat history');
        return [];
      }
  
      return new Promise((resolve, reject) => {
        let isResolved = false;
        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve([]);
          }
        }, 10000); // 10 second timeout
  
        // Set up event listener for the history
        const handleHistorySet = (events: any) => {
          if (events['messaging-history.set'] && !isResolved) {
            try {
              const historyEvent = events['messaging-history.set'];
              if (historyEvent?.messages) {
                isResolved = true;
                clearTimeout(timeout);
                
                const formattedMessages: FormattedMessage[] = historyEvent.messages.map((msg: any) => ({
                  id: msg.key?.id || '',
                  messageTimestamp: typeof msg.messageTimestamp === 'number' 
                    ? msg.messageTimestamp 
                    : parseInt(msg.messageTimestamp) || 0,
                  message: msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || 
                           msg.message?.imageMessage?.caption ||
                           (msg.message?.imageMessage ? '[Image]' : '') ||
                           (msg.message?.videoMessage ? '[Video]' : '') ||
                           (msg.message?.audioMessage ? '[Audio]' : '') ||
                           (msg.message?.documentMessage ? '[Document]' : '') ||
                           '',
                  fromMe: msg.key?.fromMe || false,
                  phoneFrom: msg.key?.fromMe ? (this.sock?.user?.id?.split(':')[0] || '') : (msg.key?.remoteJid?.replace('@s.whatsapp.net', '') || ''),
                  phoneTo: msg.key?.fromMe ? (msg.key?.remoteJid?.replace('@s.whatsapp.net', '') || '') : (this.sock?.user?.id?.split(':')[0] || ''),
                  messageType: Object.keys(msg.message || {})[0] || 'conversation',
                  mediaUrl: msg.message?.imageMessage?.url || msg.message?.videoMessage?.url || null
                }));
                
                resolve(formattedMessages);
                // Remove the event listener
                this.sock.ev.off('messaging-history.set', handleHistorySet);
              }
            } catch (error) {
              isResolved = true;
              clearTimeout(timeout);
              reject(error);
              this.sock.ev.off('messaging-history.set', handleHistorySet);
            }
          }
        };
  
        this.sock.ev.on('messaging-history.set', handleHistorySet);
  
        this.sock.fetchMessageHistory(
          jid,
          Math.min(limit, 50),
          oldestMessage.key,
          oldestMessage.messageTimestamp
        ).catch((error: any) => {
          isResolved = true;
          clearTimeout(timeout);
          this.sock.ev.off('messaging-history.set', handleHistorySet);
          reject(error);
        });
      });
  
    } catch (error) {
      console.error('Error fetching message history:', error);
      throw error;
    }
  }
  

  private async getOldestMessageInChat(jid: string): Promise<{ key: any, messageTimestamp: number } | null> {
    try {
      // You need to implement this based on your database structure
      // This should query your whatsapp messages table and get the oldest message for this JID
      
      const phoneNumber = jid.replace('@s.whatsapp.net', '');
      
      // Get all workspaces and find the oldest message
      const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
        async (workspaceId, dataSourceSchema) => {
          const query = `
            SELECT "whatsappMessageId", "messageTimeStamp", "phoneFrom", "phoneTo" 
            FROM ${dataSourceSchema}."_whatsappMessage" 
            WHERE ("phoneFrom" ILIKE '%${phoneNumber}%' OR "phoneTo" ILIKE '%${phoneNumber}%')
            AND "whatsappMessageId" IS NOT NULL
            ORDER BY "messageTimeStamp" ASC 
            LIMIT 1
          `;
          
          const result = await this.workspaceQueryService.executeRawQuery(
            query,
            [],
            workspaceId,
          );
          
          return result.length > 0 ? result[0] : null;
        }
      );
  
      // Find the oldest message across all workspaces
      const validResults = results.filter(result => result !== null);
      if (validResults.length === 0) {
        return null;
      }
  
      const oldestMessage = validResults.reduce((oldest, current) => {
        return current.messageTimeStamp < oldest.messageTimeStamp ? current : oldest;
      });
  
      return {
        key: {
          remoteJid: jid,
          id: oldestMessage.baileysMessageId,
          fromMe: oldestMessage.phoneFrom === this.sock?.user?.id?.split(':')[0]
        },
        messageTimestamp: parseInt(oldestMessage.messageTimeStamp)
      };
  
    } catch (error) {
      console.error('Error getting oldest message:', error);
      return null;
    }
  }
}
