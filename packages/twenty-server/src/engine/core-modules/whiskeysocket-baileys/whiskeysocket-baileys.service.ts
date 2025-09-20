import { Injectable } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';

import { Boom } from '@hapi/boom';
import makeWASocket, {
  delay,
  DisconnectReason,
  downloadMediaMessage,
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
import { AttachmentProcessingService } from '../arx-chat/utils/attachment-processes';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';

// import { IEventsGateway } from './events-gateway-module/events-gateway.interface';
// import { makeStore } from './helpers/store';
import console from 'console';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
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
  private static instances: Map<string, BaileysWhatsappService> = new Map();
  private readonly logger = MAIN_LOGGER.child({});
  private sock: any;
  public whatsappLoginQrString = '';
  private recruiterId: string = '';
  private connectionStatus: boolean = false;
  private eventsGateway: IEventsGateway;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private lastQrGenerationTime: number = 0;
  private static readonly QR_COOLDOWN_MS = 60000; // 1 minute cooldown between QR generations
  private static readonly SESSION_TIMEOUT_MS = 300000; // 5 minutes timeout for inactive sessions

  static getInstance(
    recruiterId: string,
    workspaceQueryService: WorkspaceQueryService,
    staticGraphQLService: StaticGraphQLService
  ): BaileysWhatsappService {
    if (!this.instances.has(recruiterId)) {
      this.instances.set(recruiterId, new BaileysWhatsappService(
        workspaceQueryService,
        staticGraphQLService
      ));
    }
    return this.instances.get(recruiterId)!;
  }

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async initializeSession(recruiterId: string, eventsGateway: IEventsGateway): Promise<void> {
    // Validate recruiterId
    if (!recruiterId || typeof recruiterId !== 'string' || recruiterId === 'undefined') {
      console.error('Invalid recruiterId provided to initializeSession');
      return;
    }

    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      console.log('Session already initializing for recruiter:', recruiterId);
      return this.initializationPromise || Promise.resolve();
    }

    if (this.sock?.ws?.readyState === WebSocket.OPEN) {
      console.log('Session already active for recruiter:', recruiterId);
      this.sendConnectionUpdate();
      return;
    }

    this.isInitializing = true;
    this.initializationPromise = this._doInitialize(recruiterId, eventsGateway);
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  private async _doInitialize(recruiterId: string, eventsGateway: IEventsGateway): Promise<void> {
    this.recruiterId = recruiterId;
    this.eventsGateway = eventsGateway;
    await this.startSock();
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
    // Add connection state check
    if (this.isInitializing && this.sock) {
      console.log('Socket initialization already in progress');
      return;
    }

    const isSocketActive = this.sock?.ws?.readyState === WebSocket.OPEN;
    if (isSocketActive) {
      console.log('WhatsApp socket is already active for recruiter:', this.recruiterId);
      this.sendConnectionUpdate();
      if (!this.connectionStatus && this.whatsappLoginQrString) {
        // Check QR cooldown before re-emitting
        const timeSinceLastQr = Date.now() - this.lastQrGenerationTime;
        if (timeSinceLastQr >= BaileysWhatsappService.QR_COOLDOWN_MS) {
          console.log('Re-emitting existing QR code for recruiter:', this.recruiterId);
          this.eventsGateway.emitEventTo('qr', this.whatsappLoginQrString, this.recruiterId);
          this.lastQrGenerationTime = Date.now();
        } else {
          console.log('Skipping QR re-emit due to cooldown for recruiter:', this.recruiterId);
        }
      }
      return;
    }

    // Better cleanup with longer delay
    if (this.sock) {
      console.log('Cleaning up existing WhatsApp socket for recruiter:', this.recruiterId);
      try {
        if (this.sock.ws && 
            this.sock.ws.readyState !== WebSocket.CLOSED && 
            this.sock.ws.readyState !== WebSocket.CLOSING) {
          await new Promise<void>((resolve) => {
            const cleanup = async () => {
              try {
                if (this.sock.ws.readyState === WebSocket.OPEN) {
                  this.sock.ws.close();
                }
                resolve();
              } catch (err) {
                console.log('Non-critical error during socket cleanup:', err.message);
                resolve();
              }
            };
            
            // Set a timeout for the cleanup
            const timeoutId = setTimeout(() => {
              console.log('Socket cleanup timed out, proceeding anyway');
              resolve();
            }, 5000);

            cleanup().finally(() => clearTimeout(timeoutId));
          });
        }
      } catch (error) {
        console.log('Error during socket cleanup (non-critical):', error.message);
      }
      
      this.sock = null;
      await delay(3000); // Additional delay after cleanup
    }

    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3; // Reduce max attempts
    let lastDisconnectTime = 0;

    try {
      await this.ensureAuthDirectory();
      
      const { state, saveCreds } = await useMultiFileAuthState(
        'baileys_auth_info/' + this.recruiterId,
      );

      const hasValidCreds = state.creds?.me?.id && state.creds?.registered;
      console.log(`Checking credentials for recruiter ${this.recruiterId}:`, hasValidCreds ? 'Valid' : 'Invalid/Missing');

      // const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
        // console.log("version", latestVersion, "isLatest", isLatest);
      // console.log(`Initializing WhatsApp v${latestVersion.join('.')} for recruiter:`, this.recruiterId);
      const version: [number, number, number] = [ 2, 3000, 1023223821 ];
      const connectionOptions = {
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger),
        },
        logger: this.logger,
        msgRetryCounterCache: nodeCache,
        syncFullHistory: true,
        connectTimeoutMs: 60000,
        markOnlineOnConnect: false,
        defaultQueryTimeoutMs: 60000,
        browser: ['Arxena', 'Chrome', '1.0.0'] as [string, string, string],
        getMessage: async (key) => {
          console.log('Getting message:', key, 'for recruiter:', this.recruiterId);
          return undefined;
        },
        retryRequestDelayMs: 5000,
        shouldIgnoreJid: jid => {
          if (!jid) return true;
          return !jid.includes('@s.whatsapp.net');
        },
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
      };

      try {
        this.sock = makeWASocket(connectionOptions);
      } catch (error) {
        console.error('Error creating WhatsApp socket:', error);
        throw error;
      }

      this.connectionStatus = false;
      this.whatsappLoginQrString = '';
      this.sendConnectionUpdate();

      this.sock.ev.process(async (events) => {
        try {
          if (events['connection.update']) {
            const update = events['connection.update'];
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
              const timeSinceLastQr = Date.now() - this.lastQrGenerationTime;
              if (timeSinceLastQr >= BaileysWhatsappService.QR_COOLDOWN_MS) {
                console.log('New QR code received for recruiter:', this.recruiterId);
                this.whatsappLoginQrString = qr;
                this.eventsGateway.emitEventTo('qr', qr, this.recruiterId);
                this.lastQrGenerationTime = Date.now();
                reconnectAttempts = 0;
              } else {
                console.log('Skipping QR generation due to cooldown for recruiter:', this.recruiterId);
              }
            }

            if (connection === 'close') {
              lastDisconnectTime = Date.now();
              const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
              const disconnectReason = lastDisconnect?.error?.output?.payload?.error;
              const errorMessage = lastDisconnect?.error?.message;
              console.log('Connection closed with status:', statusCode, 'reason:', disconnectReason, 'error:', errorMessage, "for recruiterId", this.recruiterId);
              
              // Handle authentication and Bad MAC errors
              if (errorMessage?.includes('Unsupported state or unable to authenticate data') || 
                  errorMessage?.includes('Bad MAC') ||
                  statusCode === 440 || 
                  statusCode === 401 || 
                  statusCode === DisconnectReason.loggedOut || 
                  statusCode === DisconnectReason.badSession) {
                console.log('Authentication error detected - clearing auth and requesting new QR code', "for recruiterId", this.recruiterId);
                await this.clearAuthAndRestart(true);
                return;
              }

              // Handle conflict errors differently
              if (statusCode === 440 && lastDisconnect?.error?.message?.includes('conflict')) {
                console.log('Conflict detected - waiting longer before retry');
                reconnectAttempts++;
                
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                  const delay = Math.min(10000 * Math.pow(2, reconnectAttempts), 60000);
                  console.log(`Waiting ${delay}ms before retry attempt ${reconnectAttempts}`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  await this.startSock();
                } else {
                  console.log('Max conflict retries reached - clearing auth');
                  await this.clearAuthAndRestart(true);
                }
                return;
              }

              const maxAttempts = hasValidCreds ? MAX_RECONNECT_ATTEMPTS : 3;
              const shouldReconnect = reconnectAttempts < maxAttempts && 
                                    statusCode !== DisconnectReason.loggedOut && 
                                    statusCode !== DisconnectReason.badSession &&
                                    statusCode !== 401;

              if (shouldReconnect) {
                const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
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
              reconnectAttempts = 0;
              
              // Remove immediate group participant fetching to avoid rate limits
              console.log('Successfully connected to WhatsApp');
            }
          }

          if (events['creds.update']) {
            console.log('Credentials updated - saving');
            await saveCreds();
          }

          if (events['messages.upsert']) {
            console.log("There is a whole new events in events['messages.upsert']::");
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
                    this.staticGraphQLService,
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
                      this.staticGraphQLService,
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
                      this.staticGraphQLService,
                    ).receiveIncomingMessagesFromSelfFromBaileys(
                      baileysWhatsappIncomingObj,
                      apiToken,
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing WhatsApp events:', error);
        }
      });
    } catch (error) {
      console.error('Error starting WhatsApp socket for recruiter:', this.recruiterId, error);
      this.connectionStatus = false;
      this.sendConnectionUpdate();
      
      if (!this.connectionStatus && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log('Attempting recovery after error...');
        await delay(5000);
        await this.startSock();
      }
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
        console.log("Message data::", messageData);

        const recentMessage = await this.workspaceQueryService.executeRawQuery(
          recentMessageQuery,
          [],
          workspaceId,
        );

        console.log('recentMessage::', recentMessage);

        // Check if current message matches any recent message
        if (recentMessage.length > 0 && messageData) {
          const isMessageDuplicate = recentMessage.some((msg: { message: any; phoneFrom: any; phoneTo: any; }) => {
            console.log('msg::', msg);
            console.log('messageData::', messageData);
            const messageMatches = msg.message === messageData?.body;
            const senderMatches = msg.phoneFrom === messageData?.from?.replace('@c.us', '') || msg.phoneTo === messageData?.from?.replace('@c.us', '');
            const recipientMatches = msg.phoneFrom === messageData?.to?.replace('@c.us', '') || msg.phoneTo === messageData?.to?.replace('@c.us', '');
            console.log('messageMatches::', messageMatches);
            console.log('senderMatches::', senderMatches);
            console.log('recipientMatches::', recipientMatches);
            return messageMatches && senderMatches && recipientMatches;
          });

          if (isMessageDuplicate) {
            console.log('Message already exists in database, skipping processing');
            return null;
          }
        }

        if (recentMessage.length === 0) {
          console.log('No messages found for this phone number in workspace, but checking if person exists:', workspaceId);
          // Don't return null immediately - still check if person exists in this workspace
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

          if (apiKeys && apiKeys.length > 0) {
            const apiKeyToken = await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
              workspaceId,
              apiKeys[0].id,
            );

            console.log('This is the api key token::', apiKeyToken);
            console.log('This is the recent message in whasapp baileys service::', recentMessage);

            if (apiKeyToken) {
              return {
                token: apiKeyToken?.token,
                lastMessageTime: messageData?.messageTimestamp || Date.now(),
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

      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchWhatsappMessageByWhatsappId, whatsappMessageVariable, apiToken);

      console.log('Response from fetchWhatsappMessageById:', response?.data);

      return response?.data
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

      const responseAfterFetchingAllMessagesByCandidateId = await this.staticGraphQLService.executeGraphQL(graphQlToFetchWhatsappMessages, variables, apiToken);
      console.log('responseAfterFetchingAllMessagesByCandidateId:', responseAfterFetchingAllMessagesByCandidateId); 

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
      
      const response = await this.staticGraphQLService.executeGraphQL(graphqlToUpdateWhatsappMessageId, dataToUpdate, apiToken);
      
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
        await new AttachmentProcessingService(this.staticGraphQLService).uploadAttachmentToTwenty(
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

      await new AttachmentProcessingService(this.staticGraphQLService).createOneAttachmentFromFilePath(
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
    await this.sock.sendPresenceUpdate('unavailable', jid);
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
    const baseAuthPath = 'baileys_auth_info';
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
          // First try to remove the specific recruiter directory
          if (fs.existsSync(authPath)) {
            await fs.promises.rm(authPath, { recursive: true, force: true });
            console.log('Recruiter auth directory cleared successfully:', authPath);
          }

          // Then check if the base directory is empty and remove it if it is
          if (fs.existsSync(baseAuthPath)) {
            const remainingFiles = await fs.promises.readdir(baseAuthPath);
            if (remainingFiles.length === 0) {
              await fs.promises.rm(baseAuthPath, { recursive: true, force: true });
              console.log('Base auth directory removed as it was empty:', baseAuthPath);
            } else {
              console.log(`Base directory still contains ${remainingFiles.length} other directories/files`);
            }
          }
        } catch (rmErr) {
          console.error('Error removing auth directories:', rmErr);
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

  // Add new method to cleanup inactive sessions
  public static cleanupInactiveSessions(): void {
    const now = Date.now();
    for (const [recruiterId, service] of BaileysWhatsappService.instances) {
      // Check if session is inactive
      const isInactive = !service.connectionStatus && 
                        (now - service.lastQrGenerationTime) > BaileysWhatsappService.SESSION_TIMEOUT_MS;
      
      if (isInactive) {
        console.log(`Cleaning up inactive session for recruiter: ${recruiterId}`);
        service.clearAuthAndRestart(true).catch(err => {
          console.error(`Error cleaning up session for recruiter ${recruiterId}:`, err);
        });
        BaileysWhatsappService.instances.delete(recruiterId);
      }
    }
  }
}
