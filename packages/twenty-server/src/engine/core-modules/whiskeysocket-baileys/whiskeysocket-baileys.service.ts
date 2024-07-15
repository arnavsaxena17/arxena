import { Injectable } from '@nestjs/common';
import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import readline from 'readline';
import makeWASocket, {
  AnyMessageContent,
  delay,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  PHONENUMBER_MCC,
  proto,
  useMultiFileAuthState,
  WAMessageContent,
  WAMessageKey,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import { question } from './helpers/auth';
import { makeStore } from './helpers/store';
import MAIN_LOGGER from '@whiskeysockets/baileys/lib/Utils/logger';
import { IncomingWhatsappMessages } from '../arx-chat/services/whatsapp-api/incoming-messages';
import { BaileysIncomingMessage } from '../arx-chat/services/data-model-objects';
import { FileDataDto, MessageDto } from './types/baileys-types';
import { SocksProxyAgent } from 'socks-proxy-agent';
const nodeCache = new NodeCache();

const agent = new SocksProxyAgent(process.env.SMART_PROXY_URL || '');

@Injectable()
export class WhatsappService {
  private readonly logger = MAIN_LOGGER.child({});
  private sock: any;
  private store: any = makeStore();

  constructor() {
    this.startSock();
  }

  private async startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);
    this.sock = makeWASocket({
      version,
      agent: agent,
      logger: this.logger,
      printQRInTerminal: true,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, this.logger), },
      msgRetryCounterCache: nodeCache,
    });

    this.store.bind(this.sock.ev);

    this.sock.ev.process(async events => {

      if (events['connection.update']) {
        const { connection, lastDisconnect } = events['connection.update'];
        if (connection === 'close') {
          if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
            this.startSock();
          } else {
            console.log('Connection closed. You are logged out.');
          }
        }
        console.log('connection update', events['connection.update']);
      }

      if (events['creds.update']) {
        await saveCreds();
      }


      if (events['messages.upsert']) {
        console.log('events::::', events);
        const upsert = events['messages.upsert'];
        console.log("Upsert Type::", upsert.type);
        // console.log("These are events:", JSON.stringify(events, undefined, 2));
        // console.log('recv messages', JSON.stringify(upsert, undefined, 2));
        const selfWhatsappID = this.sock.user.id;
        const selfPhoneNumber = selfWhatsappID.split(':')[0];

        console.log('Phone Number selfWhatsappID:', selfWhatsappID);

        if (upsert.type === 'notify') {
          let phoneNumberTo = '';
          try {
            phoneNumberTo = upsert?.messages[0]?.key?.remoteJid?.replace('@s.whatsapp.net', '');
            console.log();
          } catch {
            phoneNumberTo = '';
          }
          console.log('Phone Number TO upsert?.messages[0]?.key?.remoteJid:', phoneNumberTo);

          console.log('Phone Number TO captured:', selfPhoneNumber);
          for (const msg of upsert.messages) {
            if (!msg.key.fromMe) {
              let data: any = {
                msg: `got message from:${msg?.pushName}(${msg?.key?.remoteJid}) and message is:${msg?.message?.conversation}`,
                fromName: msg?.pushName,
                fromRemoteJid: msg?.key?.remoteJid,
                message: msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '',
              };

              let event = 'message';
              console.log('replying to', msg.key.remoteJid);
              await this.sock.readMessages([msg.key]);
              const baileysWhatsappIncomingObj = {
                phoneNumberFrom: '+' + msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                message: msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '',
                phoneNumberTo: selfPhoneNumber,
                messageTimeStamp: msg?.messageTimestamp,
                fromName: msg?.pushName,
                baileysMessageId: msg?.key?.id,
              };
              await new IncomingWhatsappMessages().receiveIncomingMessagesFromBaileys(baileysWhatsappIncomingObj);
              console.log('baileysWhatsappIncomingObj', baileysWhatsappIncomingObj);
              this.sock?.server?.emit(event, data);
              await this.downloadAllMediaFiles(msg, this.sock, msg.key.remoteJid);
            }
            else{
              console.log('Message is from me:', msg.key.fromMe);
              console.log("This is the message:", msg);
              const baileysWhatsappIncomingObj = {
                phoneNumberTo: '+' + msg?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
                message: msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '',
                phoneNumberFrom: selfPhoneNumber,
                messageTimeStamp: msg?.messageTimestamp,
                fromName: msg?.pushName,
                baileysMessageId: msg?.key?.id,
              };
              await new IncomingWhatsappMessages().receiveIncomingMessagesFromSelfFromBaileys(baileysWhatsappIncomingObj);

            }
          }
        }
      }
    });
  }

  async downloadAllMediaFiles(m: any, socket: any, folder: any) {
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

    let message = m?.message;

    // below code let you know mimeType i.e image/jpeg, video/mp4
    // let type = m.messages[0].message.<imageMessage>.mimetype

    let ogFileName: string = ''; // Change the type of ogFileName from null to string and initialize it with an empty string
    console.log('This is the media message:', m?.message);
    // console.log("This is the media message type:", Object.keys(m?.messages[0]?.message)[0])
    if (messageType == 'imageMessage') {
      ogFileName = `${new Date().getTime()}.jpeg`;
      folder = folder + '/images';
    } else if (messageType == 'videoMessage') {
      ogFileName = `${new Date().getTime()}.mp4`;
      folder = folder + '/videos';
    } else if (messageType == 'messageContextInfo') {
      ogFileName = message?.documentMessage?.fileName || message?.documentWithCaptionMessage?.message?.documentMessage?.fileName || `${new Date().getTime()}.pdf`;
      folder = folder + '/messageContext';
    } else if (messageType == 'documentMessage') {
      ogFileName = message.documentMessage.fileName;
      folder = folder + '/docs';
    } else {
      return;
    }
    console.log('This is the folder path:', folder);
    console.log('This is the ogFileName ogFileName:', ogFileName);
    console.log('This is the ogFileName message?.documentWithCaptionMessage:', message?.documentWithCaptionMessage);
    console.log('This is the ogFileName message?.documentWithCaptionMessage message?.documentWithCaptionMessage?.message?.fileName:', message?.documentWithCaptionMessage?.message?.documentMessage?.fileName);
    // download the message
    const buffer = await downloadMediaMessage( m, 'buffer', {}, { logger: this.logger, reuploadRequest: socket.updateMediaMessage, }, );
    let data: any = { fileName: ogFileName, fileBuffer: buffer, };
    this.handleFileUpload(data, '');
    // downloadMediaFiles(m, socket, messageType);
  }

  async handleFileUpload(file: FileDataDto, userDirectory: string): Promise<FileDataDto> {
    try {
      console.log('userDirectory:', userDirectory);
      console.log('file:', file);
      userDirectory = await this.createDirectoryIfNotExists(userDirectory);
      file.filePath = path.join(userDirectory, file.fileName);
      console.log(file.filePath);
      await fs.promises.writeFile(file.filePath, file.fileBuffer);
      return file;
    } catch (error) {
      throw new Error(`Error handling file upload: ${error}`);
    }
  }

  async createDirectoryIfNotExists(dirPath: string, defaultDir: string = process.env.UPLOAD_DEFAULT_LOCATION || 'FileUploads'): Promise<string> {
    const filePath = path.join(`${defaultDir}/${dirPath}/`);
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

  async sendMessageWTyping(msg: AnyMessageContent, jid: string) {
    await this.sock.presenceSubscribe(jid);
    await delay(500);
    await this.sock.sendPresenceUpdate('composing', jid);
    await delay(2000);
    await this.sock.sendPresenceUpdate('paused', jid);
    const sendMessageResponse = await this.sock.sendMessage(jid, msg);
    // console.log('sendMessageResponse in baileys service::', sendMessageResponse);
    return sendMessageResponse
  }

  async sendMessageFileToBaileys(body: MessageDto) {
    const { jid, message, fileData: { filePath, mimetype, fileName } = {} as any } = body;
    console.log('file media ', { jid, message, filePath, mimetype, fileName });
    try {
      await this.sock.sendMessage( jid, { document: { url: filePath }, caption: message, mimetype, fileName, }, { url: filePath }, );
    } catch (error) {
      console.log('baileys.sendMessage got error');
      // this.handleError(error);
    }
  }
}
