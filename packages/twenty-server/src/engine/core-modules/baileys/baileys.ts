process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
// import {Mimetype} from '@whiskeysockets/baileys'
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as tls from 'tls';
import { HttpsProxyAgent } from 'https-proxy-agent';

import { writeFile } from 'fs/promises';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
const logger = require('pino')();
import { IsString, Matches, validate, IsNotEmpty } from 'class-validator';
import { SocketGateway } from './socket-gateway/socket.gateway';
import { FileDataDto } from './types/baileys-types';
import { formatGoogleCalendarEvent } from 'src/modules/calendar/utils/format-google-calendar-event.util';
// import {  } from 'src/engine/core-modules/recruitment-agent/services/whatsapp-api/baileys/callBaileys';
import { IncomingWhatsappMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import * as allDataObjects from 'src/engine/core-modules/arx-chat/services/data-model-objects';
console.log('Baileys being called!!!');

const agent = new SocksProxyAgent(process.env.SMART_PROXY_URL || '');

export class BaileysBot {
  source: string;
  constructor(source: string) {
    this.source = source;
    console.log('BaileysBot being called from the source of !!!', this.source);
  }
  async initApp(arxSocket: SocketGateway, source: string) {
    console.log('InitApp being calledW by thius source!!!-->', source);
    return new Promise(async (resolve, reject) => {
      console.log('Going to try and save creds for source:', this.source);
      const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);
      const socket: any = await this.getBaileysSocket(state, version);
      // this will be called as soon as the connection are updated
      socket.ev.on('connection.update', async (updatedConnection: any) => {
        await this.handleBaileysConnection(updatedConnection, arxSocket, 'socketConnectionUpdate');
      });
      // this will be called as soon as the message send or received
      socket.ev.on('messages.upsert', async (message: any) => await this.handleMessage(message, arxSocket, socket));
      // this will be called as soon as the credentials are updated
      socket.ev.on('creds.update', saveCreds);

      // socket.ev.on('message-receipt.update', data => console.log('message-receipt.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('chats.phoneNumberShare', data => console.log('chats.phoneNumberShare', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('messages.media-update', data => console.log('messages.media-update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('connection.update', data => console.log('connection.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('messages.update', data => console.log('messages.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('groups.upsert', data => console.log('groups.upsert', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('chats.update', data => console.log('chats.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('chats.upsert', data => console.log('chats.upsert', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('creds.update', data => console.log('creds.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('call', data => console.log("call", JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('contacts.update', data => console.log('contacts.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      // socket.ev.on('groups.update', data => console.log('groups.update', JSON.stringify( data, undefined, 2 ), "\n====================================================" ) );
      resolve(socket);
    });
  }

  getBaileysSocket(state, version) {
    console.log('getBaileysSocket being calledW!!!');
    return new Promise((resolve, reject) => {
      const socket = makeWASocket({
        auth: state,
        agent: agent,
        // fetchAgent: agent,
        version,
        printQRInTerminal: true,
        defaultQueryTimeoutMs: undefined,
        syncFullHistory: false,
      });

      // return new Promise((resolve, reject) => {
      //   const proxyOptions = {
      //     hostname: '127.0.0.1',
      //     port: 24000,
      //     protocol: 'socks5:'
      //   };

      //   const proxyAgent = new SocksProxyAgent('socks5://127.0.0.1:24000'
      // );

      // Custom TLS agent with rejectUnauthorized set to false
      //   const agent = tls.connect({
      //     rejectUnauthorized: false,
      //     socket: proxyAgent // Use the SOCKS proxy agent for the socket
      //   });

      //   const socket = makeWASocket({
      //     auth: state,
      //     agent: agent,
      //     version,
      //     printQRInTerminal: true,
      //     defaultQueryTimeoutMs: undefined,
      //   });
      resolve(socket);
    });
  }
  getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return; // This returns undefined if the object is already in the set
        }
        seen.add(value);
      }
      return value;
    };
  };

  async handleMessage(m: any, arxSocket: SocketGateway, socket: any) {
    // console.log("This is the m object", m)
    // console.log("This is the socket object", socket)
    // console.log("This is the arxSocket socket object", arxSocket)
    console.log(JSON.stringify(m, undefined, 2), '\n========================================');
    console.log('handleMessage being calledW!!!');
    let event = 'message';

    let data: any = {
      msg: `got message from:${m?.messages[0]?.pushName}(${m?.messages[0]?.key?.remoteJid}) and message is:${m?.messages[0]?.message?.conversation}`,
      fromName: m?.messages[0]?.pushName,
      fromRemoteJid: m?.messages[0]?.key?.remoteJid,
      message: m?.messages[0]?.message?.conversation || m.messages[0]?.message?.extendedTextMessage?.text || '',
    };
    console.log('This is the m.messages object', m.messages[0]);
    console.log('This is the mobject', m);

    if (m.messages[0].key.fromMe === true) {
    }
    console.log('This is the data being sent to the socket', data);
    // console.log("This is the calue of arxSocket User now", Object.keys(arxSocket))
    // console.log("This is the calue of arxSocket User baileys keys", Object.keys(arxSocket.baileys))
    // console.log("This is the calue of arxSocket User baileys", arxSocket.baileys)
    // console.log("This is the calue of arxSocket User baileys user", arxSocket.baileys.user)
    // console.log("Incoming phone NUmber", arxSocket.baileys.user.id.replace(":40@s.whatsapp.net",""))
    // console.log("This is the calue of arxSocket User server", Object.keys(arxSocket.server))
    try {
      await this.processBaileysMessages(m, arxSocket, socket);
      arxSocket?.server?.emit(event, data);
      await this.downloadAllMediaFiles(m, socket, data.fromRemoteJid);
    } catch (error) {
      console.log('socket error');
      console.log('Error:', error);
      arxSocket?.server?.emit('err', 'something went wrong reconnect server');
    }
  }

  async processBaileysMessages(m: any, arxSocket: SocketGateway, socket: any) {
    console.log('processBaileysMessages::', m);

    if (m.messages[0].key.fromMe === false) {
      // console.log("a message is received from -->", m?.messages[0]?.pushName)
      // console.log("a message is received from full message-->", m?.messages[0])
      // console.log("a message is received from phone number -->", m?.messages[0]?.key?.remoteJid?.replace("@s.whatsapp.net", ""))
      // console.log("a message timestamp -->", m?.messages[0]?.messageTimestamp)
      // console.log("a message extendedTextMessage -->", m?.messages[0]?.message?.extendedTextMessage)
      // console.log("a message conversation -->", m?.messages[0]?.message?.conversation)
      // console.log("a message extendedTextMessage.text -->", m?.messages[0]?.message?.extendedTextMessage?.text)
      let phoneNumberTo = '';
      try {
        phoneNumberTo = JSON.parse(JSON.stringify(arxSocket, this.getCircularReplacer()))?.baileys?.user?.id?.replace(/:(.*)/, '');
      } catch {
        phoneNumberTo = '';
      }
      console.log('Phone Number TO captured:', phoneNumberTo);
      const baileysWhatsappIncomingObj = {
        phoneNumberFrom: m?.messages[0]?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
        message: m?.messages[0]?.message?.conversation || m.messages[0]?.message?.extendedTextMessage?.text || '',
        phoneNumberTo: phoneNumberTo,
        messageTimeStamp: m.messages[0]?.messageTimestamp,
        fromName: m?.messages[0]?.pushName,
        baileysMessageId: m?.messages[0]?.key?.id,
      };
      console.log('FInal baileysWhatsappIncomingObj:', baileysWhatsappIncomingObj);
      new IncomingWhatsappMessages().receiveIncomingMessagesFromBaileys(baileysWhatsappIncomingObj);
    } else {
      let phoneNumberFrom = '';
      try {
        phoneNumberFrom = JSON.parse(JSON.stringify(arxSocket, this.getCircularReplacer()))?.baileys?.user?.id?.replace(/:(.*)/, '');
      } catch {
        phoneNumberFrom = '';
      }
      console.log('a message is sent from --> ', m?.messages[0]?.pushName);
      const baileysWhatsappOutgoingObj = {
        phoneNumberFrom: phoneNumberFrom,
        phoneNumberTo: m?.messages[0]?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
        message: m?.messages[0]?.message?.extendedTextMessage?.text || m?.messages[0]?.message?.conversation || '',
        messageTimeStamp: m?.messages[0]?.messageTimestamp?.low,
        fromName: m?.messages[0]?.pushName,
      };

      console.log('baileysWhatsappOutgoingObj:', baileysWhatsappOutgoingObj);
      const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateDetailsByPhoneNumber(baileysWhatsappOutgoingObj.phoneNumberTo);
      console.log('This is the candidateProfileData', candidateProfileData);
      if (candidateProfileData && candidateProfileData != allDataObjects.emptyCandidateProfileObj) {
        const messageBeingSent = m?.messages[0]?.message?.extendedTextMessage?.text || m?.messages[0]?.message?.conversation || '';
        const userMessage: allDataObjects.candidateChatMessageType = {
          phoneNumberFrom: phoneNumberFrom,
          phoneNumberTo: m?.messages[0]?.key?.remoteJid?.replace('@s.whatsapp.net', ''),
          messages: [{ text: messageBeingSent }],
          candidateFirstName: candidateProfileData?.name,
          messageObj: candidateProfileData?.whatsappMessages?.edges[0]?.node?.messageObj || {},
          messageType: 'botMessage',
          candidateProfile: candidateProfileData,
          whatsappDeliveryStatus: 'sent',
          whatsappMessageId: m?.messages[0]?.key?.id || 'not given',
        };

        // ! This will just create a message in the database and not update the engagement status. That's why database entry is done inside sendWhatsappMessageVIABaileysAPI
        // await new FetchAndUpdateCandidatesChatsWhatsapps().createAndUpdateWhatsappMessage(candidateProfileData, userMessage);
      } else {
        console.log('Message has been sent to new candidate not in database');
      }
    }
  }

  async downloadMediaFiles(m: any, socket: any, type: any) {
    console.log('   downloadMediaFiles being calledW!!!');
    const messageType = Object.keys(m.messages[0].message)[0];
    // let type = m.messages[0].message.imageMessage.mimetype
    let fileName = type == 'image/jpeg' ? `${new Date().getTime()}.jpeg` : `${new Date().getTime()}.pdf`;
    // download the message
    console.log('Calling download Media Files');
    const buffer = await downloadMediaMessage(
      m.messages[0],
      'buffer',
      {},
      {
        logger,
        // pass this so that baileys can request a reupload of media
        // that has been deleted
        reuploadRequest: socket.updateMediaMessage,
      },
    );
    const directory = type == 'image/jpeg' ? './WAImages' : './WApdf';
    console.log('Going to downlod some times');
    if (!fs.existsSync(directory)) {
      await fs.promises.mkdir(directory);
      await writeFile(directory + '/' + fileName, buffer);
    } else {
      await writeFile(directory + '/' + fileName, buffer);
    }
  }
  async downloadAllMediaFiles(m: any, socket: any, folder: any) {
    let messageType = '';
    try {
      messageType = Object.keys(m.messages[0].message)[0];
    } catch {
      console.log('message type errored');
    }
    // console.log('This si the path:', folder);
    // console.log('This si the download media files path:', folder);
    // console.log('This si the download media files messageType:', messageType);
    // messageType = "imageMessage","videoMessage","documentMessage"

    let message = m?.messages[0]?.message;

    // below code let you know mimeType i.e image/jpeg, video/mp4
    // let type = m.messages[0].message.<imageMessage>.mimetype

    let ogFileName: string = ''; // Change the type of ogFileName from null to string and initialize it with an empty string
    console.log('This is the media message type :', messageType);
    console.log('This is the media message  :', messageType);
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
      console.log('Media message is noone of imageMessage, images, videos or messageCOntent or docs, hence returning:', messageType);
      return;
    }
    console.log('This is the folder path:', folder);
    console.log('This is the ogFileName ogFileName:', ogFileName);
    console.log('This is the ogFileName message?.documentWithCaptionMessage:', message?.documentWithCaptionMessage);
    console.log('This is the ogFileName message?.documentWithCaptionMessage message?.documentWithCaptionMessage?.message?.fileName:', message?.documentWithCaptionMessage?.message?.documentMessage?.fileName);
    // download the message
    const buffer = await downloadMediaMessage( m.messages[0], 'buffer', {}, { logger, reuploadRequest: socket.updateMediaMessage, }, );
    let data: any = {
      fileName: ogFileName,
      fileBuffer: buffer,
    };
    this.handleFileUpload(data, '');
    // downloadMediaFiles(m, socket, messageType);
  }

  async handleBaileysConnection(updatedConnection: any, arxSocket: SocketGateway, handleConnectionsource: string) {
    // console.log("Value of arxSocker!!!", arxSocket);
    console.log('handleBaileysConnection being calledW!!!', updatedConnection, 'by the source of', this.source, 'handleConnectionsource::', handleConnectionsource);
    // {connection,receivedPendingNotifications,qr,isNewLogin,lastDisconnect} = connectionState | updatedConnection
    // lastDisconnect = {error,date}
    const { connection, receivedPendingNotifications, qr, isNewLogin, lastDisconnect } = updatedConnection;
    console.log('handleBaileysConnection being connection!!!--->', connection);
    console.log('handleBaileysConnection being receivedPendingNotifications!!!', receivedPendingNotifications);
    console.log('handleBaileysConnection being qr!!!', qr);
    console.log('handleBaileysConnection being isNewLogin!!!', isNewLogin);
    // console.log("handleConnection being lastDisconnect!!!", lastDisconnect);

    // console.log( "value of updatedConnection::", {connection, receivedPendingNotifications, qr, isNewLogin, lastDisconnect});
    // console.log( "value of lastDisconnect::", JSON.stringify(lastDisconnect, null, 2));

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      const isConnectionRefreshed = (lastDisconnect.error as Boom)?.output?.statusCode == DisconnectReason.connectionReplaced;
      const isLoggedOut = (lastDisconnect.error as Boom)?.output?.statusCode == DisconnectReason.loggedOut;
      console.log('This is the value of should Reconnectent ', {
        shouldReconnect,
      });
      console.log('This is the value of isLoggedOut ', { isLoggedOut });
      console.log('This is the value of isLoggedOut ', {
        isConnectionRefreshed,
      });

      // reconnect if not logged out
      if (shouldReconnect) {
        if (!isConnectionRefreshed) {
          console.log('its saying to init app again because it says should reconnec tand that connections is not refreshed');
          this.initApp(arxSocket, 'because should reconnect and connection is not refreshed');
        } else {
          console.log('Tried to do an init app and not sure if it has workedd ');
        }
      }
      if (isLoggedOut) {
        this.deleteFile('./auth_info_baileys/creds.json');
        this.initApp(arxSocket, 'is loggedout and hence deleting creds and init app again');
      }
    } else if (connection === 'open') {
      console.log('opened connection');
    } else {
      // initApp(arxSocket);
      // (async ()=>{
      //     console.log("There is somethine else wihchi s is not here")
      //     let socket:SocketGateway = arxSocket;
      //     // let b = await initApp(socket)
      //     // this.socket.setBaileys(b)
      // })()
    }
    if (qr) {
      console.log('This is the qr being put in the terminal');
      console.log(qr);
      // // Use qrcode-terminal to generate and display the QR code in the terminal
      // qrcodeTerminal.generate(qr, { small: true }, function(code) {
      //     console.log(code);
      // });

      arxSocket?.server?.emit('qr', qr);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      } else {
        throw new Error('File not found');
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
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
}

export class SendMessageDto {
  constructor(jid: string, message: string) {
    this.jid = jid;
    this.message = message;
  }

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{10}@s\.whatsapp\.net$/)
  jid: string;

  @IsNotEmpty()
  @IsString()
  message: string;
}

// {
//     DisconnectReason:{
//         "401": "loggedOut",
//         "403": "forbidden",
//         "408": "timedOut",
//         "411": "multideviceMismatch",
//         "428": "connectionClosed",
//         "440": "connectionReplaced",
//         "500": "badSession",
//         "503": "unavailableService",
//         "515": "restartRequired",
//         "connectionClosed": 428,
//         "connectionLost": 408,
//         "connectionReplaced": 440,
//         "timedOut": 408,
//         "loggedOut": 401,
//         "badSession": 500,
//         "restartRequired": 515,
//         "multideviceMismatch": 411,
//         "forbidden": 403,
//         "unavailableService": 503
//       }
// }

//! when you logout from device

// connection closed due to
// Error: Stream Errored (conflict)
//     at WebSocketClient.<anonymous> (/home/daksh/code/arxena/baileys-project/wa-baileys/node_modules/@whiskeysockets/baileys/lib/Socket/socket.js:502:13)
//     at WebSocketClient.emit (node:events:518:28)
//     at /home/daksh/code/arxena/baileys-project/wa-baileys/node_modules/@whiskeysockets/baileys/lib/Socket/socket.js:236:35
//     at Object.decodeFrame (/home/daksh/code/arxena/baileys-project/wa-baileys/node_modules/@whiskeysockets/baileys/lib/Utils/noise-handler.js:136:17)
//     at WebSocketClient.onMessageRecieved (/home/daksh/code/arxena/baileys-project/wa-baileys/node_modules/@whiskeysockets/baileys/lib/Socket/socket.js:212:15)
//     at WebSocketClient.emit (node:events:518:28)
//     at WebSocket.<anonymous> (/home/daksh/code/arxena/baileys-project/wa-baileys/node_modules/@whiskeysockets/baileys/lib/Socket/Client/web-socket-client.js:46:100)
//     at WebSocket.emit (node:events:518:28)
//     at Receiver.receiverOnMessage (/home/daksh/code/arxena/baileys-project/wa-baileys/node_modules/ws/lib/websocket.js:1209:20)
//     at Receiver.emit (node:events:518:28) {
//   data: {
//     tag: 'stream:error',
//     attrs: { code: '401' },
//     content: [ [Object] ]
//   },
//   isBoom: true,
//   isServer: false,
//   output: {
//     statusCode: 401,
//     payload: {
//       statusCode: 401,
//       error: 'Unauthorized',
//       message: 'Stream Errored (conflict)'
//     },
//     headers: {}
//   }
// } , reconnecting: { shouldReconnect: false }
