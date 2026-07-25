import { Injectable } from '@nestjs/common';

import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';

import { Boom } from '@hapi/boom';
import makeWASocket, {
  delay,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState
} from 'baileys';
import MAIN_LOGGER from 'baileys/lib/Utils/logger';
import NodeCache from 'node-cache';
import {
  CandidateNode,
  chatMessageType,
  emptyCandidateProfileObj,
  graphqlToFetchWhatsappMessageByWhatsappId,
  graphQlToFetchWhatsappMessages,
  graphqlToUpdateWhatsappMessageId,
  WhatsAppBusinessAccount,
} from 'twenty-shared';

import { ProxyRotationManager } from './utils/proxy-rotation';

import { FilterCandidates } from '../arx-chat/services/candidate-engagement/filter-candidates';
import { IncomingWhatsappMessages } from '../arx-chat/services/whatsapp-api/incoming-messages';
import { AttachmentProcessingService } from '../arx-chat/utils/attachment-processes';
import { InjectMessageQueue } from '../message-queue/decorators/message-queue.decorator';
import { MessageQueue } from '../message-queue/message-queue.constants';
import { MessageQueueService } from '../message-queue/services/message-queue.service';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';

// import { IEventsGateway } from './events-gateway-module/events-gateway.interface';
// import { makeStore } from './helpers/store';
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

// Initialize proxy rotation manager
const proxyManager = ProxyRotationManager.getInstance();

// const apiToken = process.env.TWENTY_JWT_SECRET || '';
// WhatsappService(USER).eventsGateway.emitEvent();

@Injectable()
export class BaileysWhatsappService {
  private static instances: Map<string, BaileysWhatsappService> = new Map();
  private readonly logger = MAIN_LOGGER.child({});
  public sock: any;
  public whatsappLoginQrString = '';
  private recruiterId: string = '';
  private recruiterName: string = '';
  private connectionStatus: boolean = false;
  private eventsGateway: IEventsGateway;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationStartTime: number = 0;
  private lastQrGenerationTime: number = 0;
  private static readonly QR_COOLDOWN_MS = 60000; // 1 minute cooldown between QR generations
  private static readonly SESSION_TIMEOUT_MS = 300000; // 5 minutes timeout for inactive sessions
  private currentProxySession: { sessionId: number; proxyUrl: string } | null = null;
  private proxyRetryAttempts: number = 0;
  private static readonly MAX_PROXY_RETRIES = 5; // Try all 5 proxy sessions

  // static getInstance(
  //   recruiterId: string,
  //   workspaceQueryService: WorkspaceQueryService,
  //   staticGraphQLService: StaticGraphQLService,
  //   messageQueueService?: MessageQueueService
  // ): BaileysWhatsappService {
  //   if (!this.instances.has(recruiterId)) {
  //     this.instances.set(recruiterId, new BaileysWhatsappService(
  //       workspaceQueryService,
  //       staticGraphQLService,
  //       messageQueueService
  //     ));
  //   }

  //   const instance = this.instances.get(recruiterId)!;

  //   // Check if the instance is corrupted or stuck
  //   if (this.isInstanceCorrupted(instance)) {
  //     console.log(`Detected corrupted instance for recruiter ${recruiterId}, recreating...`);
  //     this.instances.delete(recruiterId);
  //     const newInstance = new BaileysWhatsappService(
  //       workspaceQueryService,
  //       staticGraphQLService,
  //       messageQueueService
  //     );
  //     this.instances.set(recruiterId, newInstance);
  //     return newInstance;
  //   }

  //   return instance;
  // }

  private static isInstanceCorrupted(instance: BaileysWhatsappService): boolean {
    try {
      // Check if the instance has been stuck in a bad state
      const sock = (instance as any).sock;
      const recruiterId = (instance as any).recruiterId;
      const connectionStatus = (instance as any).connectionStatus;

      // If socket is closed/closing and we think we're connected, it's corrupted
      if (sock?.ws?.readyState === 3 && connectionStatus === true) { // WebSocket.CLOSED
        console.log(`Instance corrupted: socket closed but connectionStatus is true for recruiter ${recruiterId}`);
        return true;
      }

      // If socket is null but we think we're connected, it's corrupted
      if (!sock && connectionStatus === true) {
        console.log(`Instance corrupted: no socket but connectionStatus is true for recruiter ${recruiterId}`);
        return true;
      }

      // If instance has been stuck in initializing state for too long
      const isInitializing = (instance as any).isInitializing;
      const initializationPromise = (instance as any).initializationPromise;
      if (isInitializing && initializationPromise) {
        // Check if initialization has been stuck for more than 5 minutes
        const initStartTime = (instance as any).initializationStartTime || 0;
        if (initStartTime > 0 && (Date.now() - initStartTime) > 300000) { // 5 minutes
          console.log(`Instance corrupted: stuck in initialization for ${Math.round((Date.now() - initStartTime) / 60000)} minutes for recruiter ${recruiterId}`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.log(`Error checking instance corruption: ${error.message}`);
      return true; // If we can't check, assume it's corrupted
    }
  }

  // static removeInstance(recruiterId: string): void {
  //   console.log(`Removing instance from static map for recruiter: ${recruiterId}`);
  //   this.instances.delete(recruiterId);
  // }

  static cleanupCorruptedInstances(): void {
    const corruptedInstances: string[] = [];

    for (const [recruiterId, instance] of this.instances) {
      if (this.isInstanceCorrupted(instance)) {
        corruptedInstances.push(recruiterId);
      }
    }

    for (const recruiterId of corruptedInstances) {
      console.log(`Cleaning up corrupted instance for recruiter: ${recruiterId}`);
      this.instances.delete(recruiterId);
    }

    if (corruptedInstances.length > 0) {
      console.log(`Cleaned up ${corruptedInstances.length} corrupted instances from static map`);
    }
  }

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly messageQueueService?: MessageQueueService,
  ) {}

  async initializeSession(recruiterId: string, eventsGateway: IEventsGateway, recruiterName?: string): Promise<void> {
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

    // Check if we already have an active connection
    if (this.sock?.ws?.readyState === WebSocket.OPEN) {
      console.log('Session already active for recruiter:', recruiterId);
      this.sendConnectionUpdate();
      return;
    }

    // Check if there's already an instance for this recruiter
    const existingInstance = BaileysWhatsappService.instances.get(recruiterId);
    if (existingInstance && existingInstance !== this && existingInstance.sock?.ws?.readyState === WebSocket.OPEN) {
      console.log('Another active instance found for recruiter:', recruiterId, '- cleaning up current instance');
      // Clean up this instance and return the existing one
      await this.cleanup();
      return;
    }

    this.isInitializing = true;
    this.initializationStartTime = Date.now();
    this.initializationPromise = this._doInitialize(recruiterId, eventsGateway, recruiterName);

    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
      this.initializationStartTime = 0;
    }
  }

  private async _doInitialize(recruiterId: string, eventsGateway: IEventsGateway, recruiterName?: string): Promise<void> {
    this.recruiterId = recruiterId;
    this.recruiterName = recruiterName || 'Unknown User';
    this.eventsGateway = eventsGateway;
    this.proxyRetryAttempts = 0; // Reset proxy retry attempts for new initialization
    await this.startSock();
  }

  public getRecruiterName(): string {
    return this.recruiterName;
  }

  public getRecruiterId(): string {
    return this.recruiterId;
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.sock) {
        if (this.sock.ws && this.sock.ws.readyState === WebSocket.OPEN) {
          await this.sock.end();
        }
        this.sock = null;
      }
      this.connectionStatus = false;
      this.whatsappLoginQrString = '';
    } catch (error) {
      console.log('Error during cleanup:', error.message);
    }
  }

  sendConnectionUpdate() {
    // Only validate WebSocket state if we think we're connected but want to double-check
    // Don't override a false status with validation - trust the connection state events
    if (this.connectionStatus === true) {
      const actualConnectionStatus = this.validateWebSocketState();
      if (actualConnectionStatus !== this.connectionStatus) {
        console.log(`WebSocket state mismatch detected for recruiter ${this.recruiterName}: expected ${this.connectionStatus}, actual ${actualConnectionStatus}`);
        this.connectionStatus = actualConnectionStatus;
      }
    }

    console.log('Sending WhatsApp connection update for recruiter:', this.recruiterName, 'status:', this.connectionStatus);
    this.eventsGateway.emitEventTo(
      'isWhatsappLoggedIn',
      this.connectionStatus,
      this.recruiterId,
      this.recruiterName
    );
  }

  private validateWebSocketState(): boolean {
    try {
      if (!this.sock) {
        return false;
      }

      const ws = this.sock.ws;
      if (!ws) {
        return false;
      }

      const readyState = ws.readyState;

      // WebSocket states: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
      switch (readyState) {
        case 1: // WebSocket.OPEN
          return true;
        case 0: // WebSocket.CONNECTING
          return false; // Still connecting, not fully connected
        case 2: // WebSocket.CLOSING
        case 3: // WebSocket.CLOSED
          return false;
        case undefined:
          // If readyState is undefined but we have a socket and ws object,
          // check if the socket has a user (which indicates successful connection)
          if (this.sock.user && this.sock.user.id) {
            console.log(`WebSocket readyState is undefined but socket has user, considering connected for recruiter ${this.recruiterName}`);
            return true;
          }
          console.log(`WebSocket readyState is undefined and no user found for recruiter ${this.recruiterName}`);
          return false;
        default:
          console.log(`Unknown WebSocket readyState: ${readyState} for recruiter ${this.recruiterName}`);
          return false;
      }
    } catch (error) {
      console.log(`Error validating WebSocket state for recruiter ${this.recruiterName}: ${error.message}`);
      return false;
    }
  }

  public async validateAndRecoverConnection(): Promise<boolean> {
    try {
      const actualStatus = this.validateWebSocketState();

      if (actualStatus !== this.connectionStatus) {
        console.log(`Connection state mismatch for recruiter ${this.recruiterName}: expected ${this.connectionStatus}, actual ${actualStatus}`);

        if (actualStatus === false && this.connectionStatus === true) {
          // We think we're connected but we're not - need to recover
          console.log(`Attempting connection recovery for recruiter ${this.recruiterName}`);
          this.connectionStatus = false;
          this.sendConnectionUpdate();

          // Try to restart the connection
          await this.softRestart();
          return true;
        }
      }

      return actualStatus;
    } catch (error) {
      console.error(`Error validating connection for recruiter ${this.recruiterName}: ${error.message}`);
      return false;
    }
  }

  private async startSock() {
    // Add connection state check
    if (this.isInitializing && this.sock) {
      console.log('Socket initialization already in progress');
      return;
    }

    const isSocketActive = this.sock?.ws?.readyState === WebSocket.OPEN;
    if (isSocketActive) {
      console.log('WhatsApp socket is already active for recruiter:', this.recruiterName);
      this.sendConnectionUpdate();
      if (!this.connectionStatus && this.whatsappLoginQrString) {
        // Check QR cooldown before re-emitting
        const timeSinceLastQr = Date.now() - this.lastQrGenerationTime;
        if (timeSinceLastQr >= BaileysWhatsappService.QR_COOLDOWN_MS) {
          console.log('Re-emitting existing QR code for recruiter:', this.recruiterName);
          this.eventsGateway.emitEventTo('qr', this.whatsappLoginQrString, this.recruiterName);
          this.lastQrGenerationTime = Date.now();
        } else {
          console.log('Skipping QR re-emit due to cooldown for recruiter:', this.recruiterName);
        }
      }
      return;
    }
    else{
      console.log("WhatsApp socket is not active for recruiter", this.recruiterName);
    }

    // Better cleanup with longer delay
    if (this.sock) {
      console.log('Cleaning up existing WhatsApp socket for recruiter:', this.recruiterName);
      try {
        if (this.sock.ws &&
            this.sock.ws.readyState !== WebSocket.CLOSED &&
            this.sock.ws.readyState !== WebSocket.CLOSING) {
          await new Promise<void>((resolve) => {
            const cleanup = async () => {
              try {
                if (this.sock.ws.readyState === WebSocket.OPEN) {
                  // Try graceful logout first
                  try {
                    await this.sock.logout();
                    console.log('Graceful logout completed');
                  } catch (logoutErr) {
                    console.log('Logout failed, forcing close:', logoutErr.message);
                    this.sock.ws.close();
                  }
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
            }, 8000); // Increased timeout

            cleanup().finally(() => clearTimeout(timeoutId));
          });
        }
      } catch (error) {
        console.log('Error during socket cleanup (non-critical):', error.message);
      }

      this.sock = null;
      await delay(5000); // Increased delay after cleanup
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
      console.log(`Checking credentials for recruiter ${this.recruiterName}:`, hasValidCreds ? 'Valid' : 'Invalid/Missing');

      const useProxy = process.env.WHATSAPP_USE_PROXY !== 'false';
      let proxyInfo: ReturnType<typeof proxyManager.getNextActiveProxy> = null;
      if (useProxy) {
        proxyInfo = proxyManager.getNextActiveProxy();
        if (proxyInfo) {
          this.currentProxySession = {
            sessionId: proxyInfo.sessionId,
            proxyUrl: proxyInfo.proxyUrl
          };
          console.log(`Using proxy session-${proxyInfo.sessionId} for WhatsApp connection: ${proxyInfo.proxyUrl}`);
        } else {
          console.log('No active proxy sessions available for WhatsApp connection');
          this.currentProxySession = null;
        }
      } else {
        console.log('WhatsApp proxy disabled (WHATSAPP_USE_PROXY=false), connecting without proxy');
        this.currentProxySession = null;
      }

      const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
        console.log("version", latestVersion, "isLatest", isLatest);
        // const { version } = await fetchLatestBaileysVersion();
        console.log(`Initializing WhatsApp v${latestVersion.join('.')} for recruiter:`, this.recruiterName);
      const connectionOptions = {
        version: latestVersion,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger),
        },
        logger: this.logger,
        msgRetryCounterCache: nodeCache,
        syncFullHistory: true,
        connectTimeoutMs: 120000, // Increased connection timeout
        markOnlineOnConnect: false,
        defaultQueryTimeoutMs: 120000, // Increased query timeout
        browser: ['Arxena', 'Chrome', '1.0.0'] as [string, string, string],
        getMessage: async (key) => {
          console.log('Getting message:', key, 'for recruiter:', this.recruiterName);
          return undefined;
        },
        retryRequestDelayMs: 10000, // Increased retry delay
        shouldIgnoreJid: jid => {
          if (!jid) return true;
          return !jid.includes('@s.whatsapp.net');
        },
        keepAliveIntervalMs: 30000,
        // Add proxy agent if available
        ...(proxyInfo && { agent: proxyInfo.agent }),
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

              // Only allow QR generation if it's been long enough AND we haven't exceeded max attempts
              if (timeSinceLastQr >= BaileysWhatsappService.QR_COOLDOWN_MS && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                console.log('New QR code received for recruiter:', this.recruiterName);
                this.whatsappLoginQrString = qr;
                this.eventsGateway.emitEventTo('qr', qr, this.recruiterId, this.recruiterName);
                this.lastQrGenerationTime = Date.now();
                reconnectAttempts = 0;
              } else {
                console.log('Skipping QR generation due to cooldown for recruiter:', this.recruiterName, 'time since last:', timeSinceLastQr, 'reconnect attempts:', reconnectAttempts);
              }
            }

            if (connection === 'close') {
              lastDisconnectTime = Date.now();
              const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
              const disconnectReason = lastDisconnect?.error?.output?.payload?.error;
              const errorMessage = lastDisconnect?.error?.message;
              console.log('Connection closed with status:', statusCode, 'reason:', disconnectReason, 'error:', errorMessage, "for recruiterName", this.recruiterName);

              // Handle proxy-related connection failures
              if (this.currentProxySession && this.shouldTryDifferentProxy(errorMessage, statusCode)) {
                console.log(`Proxy connection failed for session-${this.currentProxySession.sessionId}, attempting proxy rotation`);
                proxyManager.markSessionFailed(this.currentProxySession.sessionId, lastDisconnect?.error);
                this.proxyRetryAttempts++;

                if (this.proxyRetryAttempts < BaileysWhatsappService.MAX_PROXY_RETRIES && proxyManager.hasActiveSessions()) {
                  console.log(`Retrying with different proxy (attempt ${this.proxyRetryAttempts}/${BaileysWhatsappService.MAX_PROXY_RETRIES})`);
                  await delay(2000); // Short delay before retry
                  await this.startSock();
                  return;
                } else {
                  console.log('All proxy sessions exhausted or max retries reached');
                  this.proxyRetryAttempts = 0;
                }
              }

              // Handle undefined status codes (normal disconnections)
              if (statusCode === undefined && !errorMessage) {
                console.log('Normal connection close detected, not retrying', "for recruiterName", this.recruiterName);
                this.connectionStatus = false;
                this.sendConnectionUpdate();
                return;
              }

              // Handle conflict errors first (specific 440 with conflict message)
              if (statusCode === 440 && lastDisconnect?.error?.message?.includes('conflict')) {
                console.log('Conflict detected - another session is active, waiting longer before retry for recruiter:', this.recruiterName);
                reconnectAttempts++;

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                  const delay = Math.min(15000 * Math.pow(2, reconnectAttempts), 120000); // Longer delays for conflicts
                  console.log(`Waiting ${delay}ms before retry attempt ${reconnectAttempts} for recruiter:`, this.recruiterName);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  await this.startSock();
                } else {
                  console.log('Max conflict retries reached - stopping without clearing auth (preserving credentials) for recruiter:', this.recruiterName);
                  this.connectionStatus = false;
                  this.sendConnectionUpdate();
                  // Don't clear auth for conflicts - just stop trying
                }
                return;
              }

              // Handle authentication and Bad MAC errors (but not conflicts)
              // If we have 401 AND no valid creds, force fresh QR immediately
              if (statusCode === 401 && !hasValidCreds) {
                console.log('401 with missing/invalid creds - forcing auth reset and new QR', "for r  recruiterName", this.recruiterName);
                await this.clearAuthAndRestart(true);
                return;
              }

              if (errorMessage?.includes('Unsupported state or unable to authenticate data') ||
                  errorMessage?.includes('Bad MAC') ||
                  statusCode === 401 ||
                  statusCode === DisconnectReason.loggedOut ||
                  statusCode === DisconnectReason.badSession) {
                console.log('Authentication error detected - attempting reconnection for recruiter:', this.recruiterName);
                reconnectAttempts++;

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                  const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), 30000);
                  console.log(`Waiting ${delay}ms before auth retry attempt ${reconnectAttempts} for recruiter:`, this.recruiterName);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  await this.startSock();
                } else {
                  console.log('Max auth retries reached - clearing auth and requesting new QR code for recruiter:', this.recruiterName);
                  await this.clearAuthAndRestart(true);
                }
                return;
              }

              // Handle timeout errors specifically - preserve auth details
              if (statusCode === 408) {
                console.log('Timeout error detected - waiting before retry for recruiter:', this.recruiterName);
                reconnectAttempts++;

                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                  const delay = Math.min(10000 * Math.pow(2, reconnectAttempts), 60000); // Longer delays for timeouts
                  console.log(`Waiting ${delay}ms before timeout retry attempt ${reconnectAttempts} for recruiter:`, this.recruiterName);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  await this.startSock();
                } else {
                  console.log('Max timeout retries reached - stopping without clearing auth (preserving credentials)', "for recruiterName", this.recruiterName);
                  this.connectionStatus = false;
                  this.sendConnectionUpdate();
                  // Don't clear auth for timeouts - just stop trying
                }
                return;
              }

              const maxAttempts = hasValidCreds ? MAX_RECONNECT_ATTEMPTS : 3;
              const shouldReconnect = reconnectAttempts < maxAttempts &&
                                    statusCode !== DisconnectReason.loggedOut &&
                                    statusCode !== DisconnectReason.badSession &&
                                    statusCode !== 401 &&
                                    statusCode !== 408 && // Don't retry timeout errors here
                                    statusCode !== 428; // Don't retry precondition required errors (invalid credentials)

              if (shouldReconnect) {
                const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 30000);
                console.log(`Waiting ${delay}ms before reconnect attempt... for recruiter:`, this.recruiterName);
                await new Promise(resolve => setTimeout(resolve, delay));
                await this.startSock();
              } else {
                console.log('Max reconnection attempts reached or permanent disconnect - stopping without clearing auth (preserving credentials)', "for recruiterName", this.recruiterName);
                this.connectionStatus = false;
                this.sendConnectionUpdate();
                // Don't clear auth for general disconnections - just stop trying
              }
            }

            if (connection === 'open') {
              console.log('Connection opened successfully for recruiter:', this.recruiterName);
              this.connectionStatus = true;
              this.sendConnectionUpdate();
              reconnectAttempts = 0;
              this.proxyRetryAttempts = 0; // Reset proxy retry attempts on successful connection

              // Mark current proxy session as successful
              if (this.currentProxySession) {
                proxyManager.markSessionSuccess(this.currentProxySession.sessionId);
              }

              // Remove immediate group participant fetching to avoid rate limits
              console.log('Successfully connected to WhatsApp for recruiter:', this.recruiterName);
            }
          }

          if (events['creds.update']) {
            console.log('Credentials updated - saving for recruiter:', this.recruiterName);
            await saveCreds();
          }

          if (events['call']) {
            const callList = events['call'] as Array<{ id: string; status: string; chatId: string; isGroup?: boolean }>;
            const call = callList?.[0];
            if (call?.status === 'offer' && !call.isGroup && call.chatId) {
              const callerJid = call.chatId;
              const fromNumber = callerJid.replace('@s.whatsapp.net', '');
              const selfPhoneNumber = this.sock?.user?.id?.split(':')[0] ?? '';
              console.log(
                `Incoming WA call from ${fromNumber} for recruiter ${this.recruiterName}`,
              );
              try {
                const apiToken = await this.getApiKeyToUseFromPhoneNumberMessageReceived(
                  {
                    object: 'whatsapp_business_account',
                    entry: [{
                      id: 'call_' + Date.now(),
                      changes: [{
                        value: {
                          messages: [{ from: fromNumber }],
                          metadata: { phone_number_id: selfPhoneNumber },
                        },
                      }],
                    }],
                  },
                );
                const baseUrl =
                  process.env.SERVER_URL ??
                  process.env.SERVER_BASE_URL ??
                  process.env.ARXENA_SITE_BASE_URL ??
                  'http://localhost:3000';
                if (apiToken) {
                  await fetch(`${baseUrl}/voice-calls/incoming`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
                    body: JSON.stringify({ from: fromNumber, apiToken }),
                  });
                } else {
                  console.log(
                    `No workspace resolved for number ${fromNumber} (recruiter ${this.recruiterName}); rejecting call and sending message.`,
                  );
                }
                if (typeof this.sock.rejectCall === 'function') {
                  await this.sock.rejectCall(call.id, callerJid);
                }
                await this.sock.sendMessage(callerJid, {
                  text: "Thanks for your call. We'll get back to you on your number shortly.",
                });
              } catch (err) {
                console.error('Voice call (Baileys) handling error for recruiter:', this.recruiterName, err);
              }
            }
          }

          if (events['messages.upsert']) {
            const upsert = events['messages.upsert'];
            console.log("upsert", upsert, "for this.recruiterName", this.recruiterName)
            const selfWhatsappID = this.sock?.user?.id;
            const selfPhoneNumber = selfWhatsappID?.split(':')[0];

            console.log('Phone Number selfWhatsappID:', selfWhatsappID, "for this.recruiterName", this.recruiterName);

            if (upsert.type === 'notify' || upsert.type === 'append') {
              let phoneNumberTo = '';

              try {
                // Handle potential Bad MAC errors
                if (upsert.messages[0]?.messageStubParameters?.includes('BadMAC')) {
                  console.log('Bad MAC error detected, attempting to refresh session', "for this.recruiterName", this.recruiterName);
                  await this.clearAuthAndRestart();
                  return;
                }

                phoneNumberTo = upsert?.messages[0]?.key?.remoteJid?.replace(
                  '@s.whatsapp.net',
                  '',
                );
              } catch (error) {
                if (error.message?.includes('Bad MAC')) {
                  console.log('Bad MAC error caught, attempting to refresh session', "for this.recruiterName", this.recruiterName);
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

                  console.log('replying to', msg.key.remoteJid, "for this.recruiterName", this.recruiterName);
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
                    console.log('No API token found for this message, skipping processing for recruiter:', this.recruiterName);
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
                    this.messageQueueService,
                  ).receiveIncomingMessages(
                    baileysWhatsappIncomingObj,
                    apiToken,
                  );

                  this.sock?.server?.emit(event, data);
                } else {
                  console.log('Message is from me:', msg.key.fromMe, "for this.recruiterName", this.recruiterName);
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
                      this.messageQueueService,
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
      console.error('Error starting WhatsApp socket for recruiter:', this.recruiterName, error);
      this.connectionStatus = false;
      this.sendConnectionUpdate();

      // Handle proxy-related errors
      if (this.currentProxySession && this.shouldTryDifferentProxy(error.message, 0)) {
        console.log(`Proxy error caught for session-${this.currentProxySession.sessionId}, attempting proxy rotation for recruiter:, ${this.recruiterName}`);
        proxyManager.markSessionFailed(this.currentProxySession.sessionId, error);
        this.proxyRetryAttempts++;

        if (this.proxyRetryAttempts < BaileysWhatsappService.MAX_PROXY_RETRIES && proxyManager.hasActiveSessions()) {
          console.log(`Retrying with different proxy after error (attempt ${this.proxyRetryAttempts}/${BaileysWhatsappService.MAX_PROXY_RETRIES}) for recruiter:, ${this.recruiterName}`);
          await delay(2000);
          await this.startSock();
          return;
        } else {
          console.log('All proxy sessions exhausted after error for recruiter:', this.recruiterName );
          this.proxyRetryAttempts = 0;
        }
      }

      // Handle specific timeout errors that could crash the server
      if (error.message?.includes('Timed Out') || error.message?.includes('timeout')) {
        console.log('Timeout error caught, clearing auth and restarting', "for recruiterName", this.recruiterName);
        await this.clearAuthAndRestart(true);
        return;
      }

      if (!this.connectionStatus && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        console.log('Attempting recovery after error... for recruiter:', this.recruiterName);
        await delay(5000);
        await this.startSock();
      }
    }
  }

  async getApiKeyToUseFromPhoneNumberMessageReceived(
    requestBody: WhatsAppBusinessAccount,
    messageData?: any,
  ): Promise<string | null> {
    console.log("Going to get api token to use from phone number message received for recruiter:", this.recruiterName);
    let incomingSenderIdentifierId = requestBody?.entry[0]?.changes[0]?.value?.messages?.[0]?.from ||
                                    requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.recipient_id;
    console.log("This is the incomingSenderIdentifierId::", incomingSenderIdentifierId, "for recruiter:", this.recruiterName);
    const incomingRecipientIdentifierId = requestBody?.entry[0]?.changes[0]?.value?.metadata?.phone_number_id;
    console.log("This is the incomingRecipientIdentifierId::", incomingRecipientIdentifierId, "for recruiter:", this.recruiterName);
    if (incomingSenderIdentifierId == incomingRecipientIdentifierId) {
      console.log('This is a self message, we will not use this phone number to send messages for recruiter:', this.recruiterName);
      return null;
    }

    if (incomingSenderIdentifierId.includes('broadcast')) {
      console.log('This is a broadcast message, we will not use this phone number to send messages for recruiter:', this.recruiterName);
      return null;
    }

    const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
      async (workspaceId, dataSourceSchema) => {
        let rawQuery = '';
        if (incomingRecipientIdentifierId?.includes('linkedin')) {
          console.log('This is a linkedin phone number, we will not use this phone number to send messages to setup linkedin url as recipient id for api key finding for recruiter:', this.recruiterName);
          rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND linkedin_url ILIKE '%${incomingRecipientIdentifierId}%'`;
        } else {
          rawQuery = `SELECT * FROM core.workspace WHERE id = $1 AND facebook_whatsapp_phone_number_id ILIKE '%${incomingRecipientIdentifierId}%'`;
        }
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
              return null;
            } else {
              console.log("It is a self message, so we will use the incomingRecipientIdentifierId for recruiter:", this.recruiterName);
              incomingSenderIdentifierId = incomingRecipientIdentifierId;
            }
            console.log("Workspace found for whatsapp web phone number::", workspace, "for recruiter:", this.recruiterName);
          }
        }
        console.log('Whatsapp incoming incomingSenderIdentifierId::::', incomingSenderIdentifierId, "for recruiter:", this.recruiterName);
        if (incomingSenderIdentifierId?.includes('linkedin')) {
          console.log('This is a linkedin phone number, we will not use this phone number to send messages for recruiter:', this.recruiterName);
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

        const recentMessage = await this.workspaceQueryService.executeRawQuery(
          recentMessageQuery,
          [],
          workspaceId,
        );


        // Check if current message matches any recent message
        if (recentMessage.length > 0 && messageData) {
          const isMessageDuplicate = recentMessage.some((msg: { message: any; phoneFrom: any; phoneTo: any; }) => {
            const messageMatches = msg.message === messageData?.body;
            const senderMatches = msg.phoneFrom === messageData?.from?.replace('@c.us', '') || msg.phoneTo === messageData?.from?.replace('@c.us', '');
            const recipientMatches = msg.phoneFrom === messageData?.to?.replace('@c.us', '') || msg.phoneTo === messageData?.to?.replace('@c.us', '');
            return messageMatches && senderMatches && recipientMatches;
          });

          if (isMessageDuplicate) {
            console.log('Message already exists in database, skipping processing for recruiter:', this.recruiterName);
            return null;
          }
        }

        if (recentMessage.length === 0) {
          console.log('No messages found for this phone number in workspace, but checking if person exists:', workspaceId, "for recruiter:", this.recruiterName);
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


        const person = await this.workspaceQueryService.executeRawQuery(
          personQuery,
          [],
          workspaceId,
        );

          console.log('This is the person::', person, "for recruiter:", this.recruiterName);

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

    const match = results.find(
      (result): result is MessageResult => result !== null,
    );

    return match?.token ?? null;
  }

  async fetchWhatsappMessageById(messageId: string, apiToken: string) {
    console.log('This is the message id:', messageId, "for recruiter:", this.recruiterName);
    try {
      const whatsappMessageVariable = {
        whatsappMessageId: messageId,
      };

      const response = await this.staticGraphQLService.executeGraphQL(graphqlToFetchWhatsappMessageByWhatsappId, whatsappMessageVariable, apiToken);

      console.log('Response from fetchWhatsappMessageById:', response?.data, "for recruiter:", this.recruiterName);

      return response?.data
    } catch (error) {
      console.log('Error fetching whatsapp message by id:', error, "for recruiter:", this.recruiterName);
      return { error: error };
    }
  }

  async handleDeleteForEveryoneMessage(msg: any, candidateProfile: CandidateNode, apiToken: string) {
    const whatsappMessageToGetDeleted = await this.fetchWhatsappMessageById(
      msg?.message?.protocolMessage?.key?.id,
      apiToken
    );

    console.log('whatsappMessageToGetDeleted:', whatsappMessageToGetDeleted, "for recruiter:", this.recruiterName);
    const messageObj =
      whatsappMessageToGetDeleted?.data?.whatsappMessage?.messageObj;

    console.log('messageObj:', messageObj, "for recruiter:", this.recruiterName);
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
          name: file.fileName,
          fullPath: attachmentObj.data.uploadFile,
          fileCategory: 'TEXT_DOCUMENT',
          candidateId: candidateProfileData.id,
        },
      };

      await new AttachmentProcessingService(this.staticGraphQLService).createOneAttachmentFromFilePath(
        dataToUploadInAttachmentTable,
        apiToken,
      );

      if (file.filePath) {
        try {
          await fs.promises.unlink(file.filePath);
        } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.log(
              'Error cleaning up temporary uploaded attachment:',
              cleanupError,
            );
          }
        }
      }

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
          if (this.sock.ws?.readyState === WebSocket.OPEN) {
            await this.sock.logout();
            console.log('Successfully logged out of WhatsApp socket');
          }
        } catch (logoutErr) {
          console.log('Logout failed (expected if connection already closed):', logoutErr.message);
        }

        try {
          // Only end the socket connection if it's in a valid state
          const wsState = this.sock.ws?.readyState;
          if (wsState === WebSocket.OPEN || wsState === WebSocket.CONNECTING) {
            await this.sock.end();
            console.log('Successfully ended WhatsApp socket connection');
          } else {
            console.log(`Skipping socket.end() - WebSocket is in state ${wsState} (CLOSED/CLOSING)`);
          }
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

  public async softRestart(): Promise<void> {
    try {
      console.log(`Performing soft restart for recruiter: ${this.recruiterName}`);

      // First, clean up the existing socket connection
      if (this.sock) {
        try {
          // Gracefully close the socket if it's open
          if (this.sock.ws?.readyState === WebSocket.OPEN) {
            console.log('Gracefully closing existing WhatsApp socket');
            await this.sock.end();
          }
        } catch (closeErr) {
          console.log('Error closing socket (non-critical):', closeErr.message);
        }

        // Clear socket reference
        this.sock = null;
      }

      // Update connection status
      this.connectionStatus = false;
      this.whatsappLoginQrString = '';

      // Wait a moment before restarting
      await delay(2000);

      // Restart the socket with existing credentials
      console.log('Restarting WhatsApp socket with existing credentials');
      await this.startSock();

    } catch (err) {
      console.error('Error during soft restart:', err);
      throw err;
    }
  }

  private async ensureAuthDirectory(): Promise<void> {
    const authPath = 'baileys_auth_info/' + this.recruiterName;
    try {
      await fs.promises.mkdir(authPath, { recursive: true });
      console.log('Auth directory ensured:', authPath);
    } catch (err) {
      console.error('Error ensuring auth directory:', err);
      throw err;
    }
  }

  public async validateAuthState(): Promise<{ isValid: boolean; needsRecovery: boolean; error?: string }> {
    try {
      const authPath = 'baileys_auth_info/' + this.recruiterId;

      // Check if auth directory exists
      if (!fs.existsSync(authPath)) {
        return { isValid: false, needsRecovery: true, error: 'Auth directory does not exist' };
      }

      // Check for required auth files
      const requiredFiles = ['creds.json', 'keys.json'];
      const missingFiles: string[] = [];

      for (const file of requiredFiles) {
        const filePath = `${authPath}/${file}`;
        if (!fs.existsSync(filePath)) {
          missingFiles.push(file);
        } else {
          // Check if file is readable and has content
          try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            if (!content || content.trim() === '' || content === '{}') {
              missingFiles.push(`${file} (empty or invalid)`);
            }
          } catch (readError) {
            missingFiles.push(`${file} (unreadable)`);
          }
        }
      }

      if (missingFiles.length > 0) {
        return {
          isValid: false,
          needsRecovery: true,
          error: `Missing or invalid auth files: ${missingFiles.join(', ')}`
        };
      }

      // Check if credentials are valid by trying to load them
      try {
        const { state } = await useMultiFileAuthState(authPath);
        const hasValidCreds = state.creds?.me?.id && state.creds?.registered;

        if (!hasValidCreds) {
          return {
            isValid: false,
            needsRecovery: true,
            error: 'Credentials exist but are invalid or unregistered'
          };
        }

        return { isValid: true, needsRecovery: false };

      } catch (authError) {
        return {
          isValid: false,
          needsRecovery: true,
          error: `Auth state loading failed: ${authError.message}`
        };
      }

    } catch (error) {
      return {
        isValid: false,
        needsRecovery: true,
        error: `Auth validation error: ${error.message}`
      };
    }
  }

  public async recoverFromAuthCorruption(): Promise<boolean> {
    try {
      console.log(`Attempting auth recovery for recruiter: ${this.recruiterName}`);

      // First, try to clear and restart with existing auth
      await this.clearAuthAndRestart(false);

      // Wait a moment for restart
      await new Promise(resolve => setTimeout(resolve, 3000));

      // If that doesn't work, try clearing auth completely
      const validation = await this.validateAuthState();
      if (!validation.isValid) {
        console.log(`Auth still invalid after soft restart, clearing auth completely for recruiter: ${this.recruiterName}`);
        await this.clearAuthAndRestart(true);
        return true;
      }

      return true;
    } catch (error) {
      console.error(`Error during auth recovery for recruiter ${this.recruiterName}: ${error.message}`);
      return false;
    }
  }

  private shouldTryDifferentProxy(errorMessage: string, statusCode: number): boolean {
    // Check for proxy-related errors that warrant trying a different proxy
    const proxyErrorPatterns = [
      'Socks5 proxy rejected connection',
      'Socks5 Authentication failed',
      'HostUnreachable',
      'Connection refused',
      'Network is unreachable',
      'No route to host',
      'Connection timed out',
      'Proxy connection failed'
    ];

    const isProxyError = proxyErrorPatterns.some(pattern =>
      errorMessage?.toLowerCase().includes(pattern.toLowerCase())
    );

    // Also check for specific status codes that might indicate proxy issues
    const isProxyStatusCode = statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;

    return isProxyError || isProxyStatusCode;
  }

  async fetchMessageHistory(jid: string, limit: number): Promise<FormattedMessage[]> {
    if (!this.sock) {
      throw new Error('WhatsApp connection not initialized');
    }

    try {
      // First, we need to get the oldest message from the database/store
      const oldestMessage = await this.getOldestMessageInChat(jid);
      console.log(" oldestMessage in fetchMessageHistory:", oldestMessage);
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
              console.log("historyEvent in fetchMessageHistory:", historyEvent);
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
          else{
            console.log("messaging-history.set event not received");
          }
        };

        this.sock.ev.on('messaging-history.set', handleHistorySet);
        console.log("fetching message history for jid:", jid, "for this.recruiterName", this.recruiterName);

        this.sock.fetchMessageHistory(
          jid,
          Math.min(limit, 50),
          oldestMessage.key,
          oldestMessage.messageTimestamp
        ).catch((error: any) => {
          console.log("error in fetching message history:", error);
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
            SELECT "whatsappMessageId", "createdAt", "phoneFrom", "phoneTo"
            FROM ${dataSourceSchema}."_whatsappMessage"
            WHERE ("phoneFrom" ILIKE '%${phoneNumber}%' OR "phoneTo" ILIKE '%${phoneNumber}%')
            AND "whatsappMessageId" IS NOT NULL
            ORDER BY "createdAt" ASC
            LIMIT 1
          `;

          const result = await this.workspaceQueryService.executeRawQuery(
            query,
            [],
            workspaceId,
          );

          return result.length > 0 ? result[0] : null;
        },
        { stopOnFirstResult: false },
      );

      // Find the oldest message across all workspaces
      const validResults = results.filter(result => result !== null);
      if (validResults.length === 0) {
        return null;
      }

      const oldestMessage = validResults.reduce((oldest, current) => {
        return current.createdAt < oldest.createdAt ? current : oldest;
      });

      return {
        key: {
          remoteJid: jid,
          id: oldestMessage.baileysMessageId,
          fromMe: oldestMessage.phoneFrom === this.sock?.user?.id?.split(':')[0]
        },
        messageTimestamp: parseInt(oldestMessage.createdAt)
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

  // Method to get current proxy status for debugging
  public getProxyStatus(): any {
    return {
      useProxy: process.env.WHATSAPP_USE_PROXY !== 'false',
      currentSession: this.currentProxySession,
      retryAttempts: this.proxyRetryAttempts,
      maxRetries: BaileysWhatsappService.MAX_PROXY_RETRIES,
      allSessions: proxyManager.getSessionStatus(),
      hasActiveSessions: proxyManager.hasActiveSessions()
    };
  }

  // Method to fetch chat history from database as fallback
  async fetchChatHistoryFromDatabase(jid: string, limit: number = 50): Promise<FormattedMessage[]> {
    try {
      const phoneNumber = jid.replace('@s.whatsapp.net', '');

      // Get all workspaces and find messages for this phone number
      const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
        async (workspaceId, dataSourceSchema) => {
          const query = `
            SELECT
              "whatsappMessageId",
              "createdAt",
              "phoneFrom",
              "phoneTo",
              "message",
              "messageType",
              "mediaUrl"
            FROM ${dataSourceSchema}."_whatsappMessage"
            WHERE ("phoneFrom" ILIKE '%${phoneNumber}%' OR "phoneTo" ILIKE '%${phoneNumber}%')
            ORDER BY "createdAt" DESC
            LIMIT $1
          `;

          const result = await this.workspaceQueryService.executeRawQuery(
            query,
            [limit],
            workspaceId,
          );

          return result;
        },
        { stopOnFirstResult: false },
      );

      // Flatten and sort all messages from all workspaces
      const allMessages = results.flat();
      const sortedMessages = allMessages
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      // Format messages to match FormattedMessage interface
      const formattedMessages: FormattedMessage[] = sortedMessages.map((msg: any) => ({
        id: msg.whatsappMessageId || '',
        messageTimestamp: typeof msg.createdAt === 'number'
          ? msg.createdAt
          : parseInt(msg.createdAt) || 0,
        message: msg.message || '',
        fromMe: msg.phoneFrom === this.sock?.user?.id?.split(':')[0],
        phoneFrom: msg.phoneFrom || '',
        phoneTo: msg.phoneTo || '',
        messageType: msg.messageType || 'conversation',
        mediaUrl: msg.mediaUrl || null
      }));

      return formattedMessages;

    } catch (error) {
      console.error('Error fetching chat history from database:', error);
      return [];
    }
  }

  // Method to fetch chat history from database with date filters
  async fetchChatHistoryFromDatabaseWithFilters(
    jid: string,
    limit: number = 50,
    fromDate?: string,
    toDate?: string
  ): Promise<FormattedMessage[]> {
    try {
      const phoneNumber = jid.replace('@s.whatsapp.net', '');

      // Build date filter conditions
      let dateFilter = '';
      if (fromDate || toDate) {
        const conditions: string[] = [];
        if (fromDate) {
          conditions.push(`"createdAt" >= '${fromDate}'`);
        }
        if (toDate) {
          conditions.push(`"createdAt" <= '${toDate}'`);
        }
        dateFilter = `AND ${conditions.join(' AND ')}`;
      }

      // Get all workspaces and find messages for this phone number
      const results = await this.workspaceQueryService.executeQueryAcrossWorkspaces(
        async (workspaceId, dataSourceSchema) => {
          const query = `
            SELECT
              "whatsappMessageId",
              "createdAt",
              "phoneFrom",
              "phoneTo",
              "message",
              "messageType",
              "mediaUrl"
            FROM ${dataSourceSchema}."_whatsappMessage"
            WHERE ("phoneFrom" ILIKE '%${phoneNumber}%' OR "phoneTo" ILIKE '%${phoneNumber}%')
            ${dateFilter}
            ORDER BY "createdAt" DESC
            LIMIT $1
          `;

          const result = await this.workspaceQueryService.executeRawQuery(
            query,
            [limit],
            workspaceId,
          );

          return result;
        },
        { stopOnFirstResult: false },
      );

      // Flatten and sort all messages from all workspaces
      const allMessages = results.flat();
      const sortedMessages = allMessages
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      // Format messages to match FormattedMessage interface
      const formattedMessages: FormattedMessage[] = sortedMessages.map((msg: any) => ({
        id: msg.whatsappMessageId || '',
        messageTimestamp: typeof msg.createdAt === 'number'
          ? msg.createdAt
          : parseInt(msg.createdAt) || 0,
        message: msg.message || '',
        fromMe: msg.phoneFrom === this.sock?.user?.id?.split(':')[0],
        phoneFrom: msg.phoneFrom || '',
        phoneTo: msg.phoneTo || '',
        messageType: msg.messageType || 'conversation',
        mediaUrl: msg.mediaUrl || null
      }));

      return formattedMessages;

    } catch (error) {
      console.error('Error fetching chat history from database with filters:', error);
      return [];
    }
  }
}
