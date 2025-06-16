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
  useMultiFileAuthState,
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
} from 'twenty-shared';

import { FilterCandidates } from '../arx-chat/services/candidate-engagement/filter-candidates';
import { IncomingWhatsappMessages } from '../arx-chat/services/whatsapp-api/incoming-messages';
import { axiosRequest } from '../arx-chat/utils/arx-chat-agent-utils';
import { AttachmentProcessingService } from '../arx-chat/utils/attachment-processes';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';

// import { IEventsGateway } from './events-gateway-module/events-gateway.interface';
// import { makeStore } from './helpers/store';
import { IEventsGateway } from 'src/engine/core-modules/whiskeysocket-baileys/events-gateway-module/events-gateway.interface';
import { FileDataDto, MessageDto } from './types/baileys-types';

const nodeCache = new NodeCache();

const agent = new SocksProxyAgent(process.env.SMART_PROXY_URL || '');

const apiToken = process.env.TWENTY_JWT_SECRET || '';
// WhatsappService(USER).eventsGateway.emitEvent();

@Injectable()
export class WhatsappService {
  private readonly logger = MAIN_LOGGER.child({});
  private sock: any;
  // private store: any = makeStore();
  public whatsappLoginQrString = '';

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private eventsGateway: IEventsGateway,
    private sessionId: string,
    private socketClientId: string,
    private connectionStatus = false,
  ) {
    this.sessionId = sessionId;
    this.startSock();
    // const workspaceMemberId = this.eventsGateway.workspaceMemberId;
  }

  setSocketClientId(socketClientId: string) {
    console.log('setting socketClientId', socketClientId);
    this.socketClientId = socketClientId;
  }

  sendConnectionUpdate() {
    console.log('sending connection update', this.connectionStatus);
    this.eventsGateway.emitEventTo(
      'isWhatsappLoggedIn',
      this.connectionStatus,
      this.socketClientId,
    );
  }

  private async startSock() {
    if (this.sock) {
      console.log('Socket already exists, closing existing connection');
      this.sock.end();
      this.sock = null;
      await delay(2000); // Wait for socket to properly close
    }

    try {
      await this.ensureAuthDirectory();
      
      const { state, saveCreds } = await useMultiFileAuthState(
        'baileys_auth_info/' + this.sessionId,
      );
      const { version, isLatest } = await fetchLatestBaileysVersion();

      console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);
      this.sock = makeWASocket({
        version,
        agent: agent,
        logger: this.logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger),
        },
        msgRetryCounterCache: nodeCache,
        syncFullHistory: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        browser: ['Twenty CRM', 'Chrome', '1.0.0'],
        getMessage: async (key) => {
          // if (this.store) {
          //   const msg = await this.store.loadMessage(key.remoteJid, key.id);
          //   return msg?.message || undefined;
          // }
          return undefined;
        },
        markOnlineOnConnect: false,
        retryRequestDelayMs: 2000,
        mobile: true,
        patchMessageBeforeSending: (message) => {
          const requiresPatch = !!(
            message.buttonsMessage ||
            message.templateMessage ||
            message.listMessage
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

      // this.store.bind(this.sock.ev);

      this.sock.ev.process(async (events) => {
        console.log('Processing events:', Object.keys(events));

        if (events['connection.update']) {
          const { connection, lastDisconnect, qr } = events['connection.update'];
          console.log('Connection update:', { connection, lastDisconnect: lastDisconnect?.error?.output, qr: !!qr });

          if (qr) {
            console.log('Sending QR through socket to', this.socketClientId);
            this.whatsappLoginQrString = qr;
            this?.eventsGateway?.emitEventTo('qr', qr, this.socketClientId);
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            console.log('Connection closed with status:', statusCode);
            
            // Handle different disconnect scenarios
            if (statusCode === DisconnectReason.loggedOut || statusCode === 515) {
              console.log('User logged out or stream error - clearing auth and restarting');
              await this.clearAuthAndRestart();
            } else if (statusCode === DisconnectReason.connectionClosed) {
              console.log('Connection closed - attempting immediate reconnect');
              await delay(2000); // Add small delay before reconnect
              this.startSock();
            } else if (statusCode === DisconnectReason.connectionLost) {
              console.log('Connection lost - attempting reconnect with delay');
              await delay(5000);
              this.startSock();
            } else if (statusCode === DisconnectReason.connectionReplaced) {
              console.log('Connection replaced - not reconnecting');
              return;
            } else {
              console.log('Unknown disconnect reason - attempting reconnect with delay');
              await delay(3000);
              this.startSock();
            }
          }

          if (connection === 'open') {
            console.log('Connection opened successfully');
            this.connectionStatus = true;
            this?.eventsGateway?.emitEventTo('isWhatsappLoggedIn', true, this.socketClientId);
            
            // Subscribe to presence updates after successful connection
            const chats = await this.sock.groupFetchAllParticipating();
            console.log('Successfully fetched group participants');
            
            // Fetch initial app state
            await this.sock.fetchLatestBaileysVersion();
            console.log('Successfully fetched latest version');
          }
        }

        if (events['creds.update']) {
          console.log('Credentials updated - saving');
          await saveCreds();
        }

        if (events['messages.upsert']) {
          // console.log('events::::', events);
          const upsert = events['messages.upsert'];

          console.log('Upsert Type::', upsert.type);
          console.log('Upsert::', upsert);
          // console.log("These are events:", JSON.stringify(events, undefined, 2));
          // console.log('recv messages', JSON.stringify(upsert, undefined, 2));
          const selfWhatsappID = this.sock?.user?.id;
          const selfPhoneNumber = selfWhatsappID?.split(':')[0];

          console.log('Phone Number selfWhatsappID:', selfWhatsappID);

          if (upsert.type === 'notify' || upsert.type === 'append') {
            let phoneNumberTo = '';

            try {
              phoneNumberTo = upsert?.messages[0]?.key?.remoteJid?.replace(
                '@s.whatsapp.net',
                '',
              );
              console.log();
            } catch {
              phoneNumberTo = '';
            }
            console.log(
              'Phone Number TO upsert?.messages[0]?.key?.remoteJid:',
              phoneNumberTo,
            );

            console.log('Phone Number TO  captured:', selfPhoneNumber);
            for (const msg of upsert.messages) {
              if (!msg.key.fromMe) {
                // console.log('This is the message:', msg);

                const data: any = {
                  msg: `got message from:${msg?.pushName}(${msg?.key?.remoteJid}) and message is:${msg?.message?.conversation}`,
                  fromName: msg?.pushName,
                  fromRemoteJid: msg?.key?.remoteJid,
                  message:
                    msg?.message?.conversation ||
                    msg?.message?.extendedTextMessage?.text ||
                    '',
                };
                // this.eventsGateway.emitEventTo('received', msg?.message?.conversation || msg?.message?.extendedTextMessage?.text, this.socketClientId);

                const event = 'message';

                console.log('replying to', msg.key.remoteJid);
                const whatsappIncomingMessage: chatMessageType = {
                  phoneNumberFrom:
                    '+' + msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                  phoneNumberTo: phoneNumberTo,
                  messages: [],
                  messageType: 'string',
                };

                const candidateProfileData = await new FilterCandidates(
                  this.workspaceQueryService,
                ).getCandidateInformation(whatsappIncomingMessage, apiToken);

                if (msg?.message?.protocolMessage?.type === 0) {
                  await this.handleDeleteForEveryoneMessage(
                    msg,
                    candidateProfileData,
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
                  const whatsappMessageReacted: {
                    data: {
                      whatsappMessage: {
                        id: string;
                        candidateId: string;
                        whatsappMessageId: string;
                        message: string;
                      };
                    };
                  } = await this.fetchWhatsappMessageById(
                    msg?.message?.reactionMessage?.key?.id,
                  );

                  console.log('whatsappMessageReacted:', whatsappMessageReacted);
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
                // await this.sock.readMessages([msg.key]);

                const baileysWhatsappIncomingObj = {
                  phoneNumberFrom:
                    '+' + msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                  message: textMessageToSend,
                  phoneNumberTo: selfPhoneNumber,
                  messageTimeStamp: msg?.messageTimestamp,
                  fromName: msg?.pushName,
                  baileysMessageId: msg?.key?.id,
                };

                console.log(
                  'baileysWhatsappIncomingObj',
                  baileysWhatsappIncomingObj,
                );
                console.log('msg', msg);
                await this.downloadAllMediaFiles(
                  msg,
                  this.sock,
                  msg.key.remoteJid,
                  candidateProfileData,
                );
                await new IncomingWhatsappMessages(
                  this.workspaceQueryService,
                ).receiveIncomingMessages(
                  baileysWhatsappIncomingObj,
                  apiToken,
                );
                // console.log('baileysWhatsappIncomingObj', baileysWhatsappIncomingObj);
                this.sock?.server?.emit(event, data);
              } else {
                console.log('Message is from me:', msg.key.fromMe);
                // console.log('This is the message:', msg);
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

                await new IncomingWhatsappMessages(
                  this.workspaceQueryService,
                ).receiveIncomingMessagesFromSelfFromBaileys(
                  baileysWhatsappIncomingObj,
                  apiToken,
                );
              }
            }
          }

          if (upsert.type === 'append') {
            for (const msg of upsert.messages) {
              console.log('Append Message:', msg);
            }
          }
        }

        if (events['chats.update']) {
          // console.log('events::::', events);
          const chatUpdate = events['chats.update'];

          console.log('chats.update::', chatUpdate);
        }

        if (events['chats.upsert']) {
          // console.log('events::::', events);
          const chatUpsert = events['chats.upsert'];

          console.log('chats.upsert::', chatUpsert);
        }

        // socket.ev.on('chats.update', data => console.log('chats.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
        // socket.ev.on('chats.upsert', data => console.log('chats.upsert', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      });
    } catch (error) {
      console.log('Error starting socket:', error);
    }
  }

  async fetchWhatsappMessageById(messageId: string) {
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

  async handleDeleteForEveryoneMessage(msg, candidateProfile: CandidateNode) {
    // console.log('This is the message:', msg);
    console.log('This is the candidateProfile:', candidateProfile);
    const whatsappMessageToGetDeleted = await this.fetchWhatsappMessageById(
      msg?.message?.protocolMessage?.key?.id,
    );

    console.log('whatsappMessageToGetDeleted:', whatsappMessageToGetDeleted);
    const messageObj =
      whatsappMessageToGetDeleted?.data?.whatsappMessage?.messageObj;

    console.log('messageObj:', messageObj);
    const messagesAfterDeletingTheCurrentMessage = messageObj?.slice(
      0,
      messageObj?.length - 1,
    );

    console.log(
      'messagesAfterDeletingTheCurrentMessage:',
      messagesAfterDeletingTheCurrentMessage,
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

      console.log('latestMessageObject:', latestMessageObject);
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
  ) {
    let messageType = '';

    try {
      messageType = Object.keys(m.message)[0];
    } catch {
      console.log('message type errored');
    }
    console.log('This si the path:', folder);
    console.log('This si the download media files path:', folder);
    console.log('This si the download media files messageType:', messageType);
    // messageType = "imageMessage","videoMessage","documentMessage"

    const message = m?.message;

    // below code let you know mimeType i.e image/jpeg, video/mp4
    // let type = m.messages[0].message.<imageMessage>.mimetype

    let ogFileName = ''; // Change the type of ogFileName from null to string and initialize it with an empty string

    // console.log('This is the media message:', m?.message);
    // console.log("This is the media message type:", Object.keys(m?.messages[0]?.message)[0])
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
    console.log('This is the folder path:', folder);
    console.log('This is the ogFileName ogFileName:', ogFileName);
    console.log(
      'This is the ogFileName message?.documentWithCaptionMessage:',
      message?.documentWithCaptionMessage,
    );
    console.log(
      'This is the ogFileName message?.documentWithCaptionMessage message?.documentWithCaptionMessage?.message?.fileName:',
      message?.documentWithCaptionMessage?.message?.documentMessage?.fileName,
    );
    // download the message
    try {
      if (candidateProfileData != emptyCandidateProfileObj) {
        console.log('Candidate is in the database, seee');
        console.log(
          'Candidate is in socket.updateMediaMessageseee',
          socket.updateMediaMessage,
        );
        // console.log('This is the candiate who has sent us candidateProfileData::', candidateProfileData);
        const buffer = await downloadMediaMessage(
          m,
          'buffer',
          {},
          { logger: this.logger, reuploadRequest: socket.updateMediaMessage },
        );
        const data: any = { fileName: ogFileName, fileBuffer: buffer };

        console.log('Got the data for upload attachemnets:', data);
        this.handleFileUpload(
          data,
          './.attachments/' + folder,
          candidateProfileData,
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
    // downloadMediaFiles(m, socket, messageType);
  }

  async handleFileUpload(
    file: FileDataDto,
    userDirectory: string,
    candidateProfileData,
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

  private async clearAuthAndRestart(): Promise<void> {
    const authPath = 'baileys_auth_info/' + this.sessionId;
    try {
      // Close existing socket if any
      if (this.sock) {
        this.sock.end();
        this.sock = null;
      }

      // Clear connection status
      this.connectionStatus = false;
      this?.eventsGateway?.emitEventTo('isWhatsappLoggedIn', false, this.socketClientId);

      // Remove auth files
      await fs.promises.rm(authPath, { recursive: true, force: true });
      console.log('Auth directory cleared successfully');

      // Wait before restart
      await delay(2000);
      await this.startSock();
    } catch (err) {
      console.error('Error clearing auth directory:', err);
      throw err;
    }
  }

  private async ensureAuthDirectory(): Promise<void> {
    const authPath = 'baileys_auth_info/' + this.sessionId;
    try {
      await fs.promises.access(authPath);
    } catch {
      await fs.promises.mkdir(authPath, { recursive: true });
      console.log('Created auth directory:', authPath);
    }
  }

  initializeSession(sessionId: string, socketClientId: string, eventsGateway: IEventsGateway): void {
    this.sessionId = sessionId;
    this.socketClientId = socketClientId;
    this.eventsGateway = eventsGateway;
    this.startSock();
  }
}
