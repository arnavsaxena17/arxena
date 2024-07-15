import { FacebookWhatsappChatApi } from '../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { sendWhatsappMessageVIABaileysAPI, sendAttachmentMessageViaBaileys } from '../../services/whatsapp-api/baileys/callBaileys';
import * as allDataObjects from '../../services/data-model-objects';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import axios from 'axios';

const baseUrl = 'http://localhost:' + process.env.PORT; // Base URL of your GraphQL server
export class WhatsappAPISelector {
  constructor() {}
  async sendWhatsappMessage(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType, personNode: allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[]) {
    if (process.env.WHATSAPP_API === 'facebook') {
      const response = await new FacebookWhatsappChatApi().sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj, personNode, mostRecentMessageArr);
    } else if (process.env.WHATSAPP_API === 'baileys') {
      await sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj, personNode, mostRecentMessageArr);
    } else {
      console.log('No valid whatsapp API selected');
    }
  }
  async sendAttachmentMessageOnWhatsapp(attachmentMessage: allDataObjects.AttachmentMessageObject) {
    console.log('attachmentMessage received to send attachment:', attachmentMessage);
    if (process.env.WHATSAPP_API === 'facebook') {
      // Alternative solution for sending attachment message (doesn't take the file path or mediaID as input, but the file itself)
      // const facebookWhatsappAttachmentMessageObj = {
      //   phoneNumberFrom: attachmentMessage.phoneNumberFrom,
      //   phoneNumberTo: attachmentMessage.phoneNumberTo,
      //   mediaFileName: attachmentMessage.fullPath,
      //   attachmentMessage: attachmentMessage.fullPath,
      //   mediaID: "377908408596785"
      // }
      // await new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(facebookWhatsappAttachmentMessageObj);

      // const sendWhatsappAttachmentTextMessageObj = {
      //   "filePath":"/Users/arnavsaxena/Downloads/JD - Environment Infra - Group HR Head - Surat.pdf",
      //   "phoneNumberTo": attachmentMessage.phoneNumberTo,
      //   "attachmentMessage":"Sharing the JD with you"
      // }
      await new FacebookWhatsappChatApi().uploadAndSendFileToWhatsApp(attachmentMessage);
    } else if (process.env.WHATSAPP_API === 'baileys') {
      // await sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj);
      await sendAttachmentMessageViaBaileys(attachmentMessage);
    }
  }

  async sendJDViaWhatsapp(
    person: allDataObjects.PersonNode,
    // candidateId: string,
    attachment: allDataObjects.Attachment,
  ) {
    const fullPath = attachment?.fullPath;
    const name = attachment?.name || 'attachment.pdf';
    console.log('This is attachment name:', name);
    const localFilePath = process.cwd() + '/.attachments' + `/${attachment?.jobId}/` + name;
    console.log('This is localFile Path:', localFilePath);
    const fileUrl = `${baseUrl}` + '/files/' + fullPath; // Adjust this URL as needed based on your server configuration
    let fileData;
    try {
      console.log('Attachment:', attachment);
      console.log('path:', fullPath, 'name:', name, 'fileUrl:', fileUrl);
      console.log('localFilePath:', localFilePath);
      // Download and save the file locally
      fileData = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'arraybuffer',
      });
      if (!fileData?.data) {
        throw new Error('No data found in the file');
      }
      // fs.writeFile(localFilePath, fileData?.data, (error) => {
      //   console.log("Error in writing the file:", error);
      // });

      fs.mkdir(path.dirname(localFilePath), { recursive: true }, err => {
        if (err) {
          return console.error(err);
        }

        // Write the file
        fs.writeFile(localFilePath, fileData?.data, err => {
          if (err) {
            return console.error(err);
          }
          console.log('File has been saved!');
        });
      });
    } catch (error) {
      console.log('Error in downloading the file:', error);
    }
    const attachmentMessageObj: allDataObjects.AttachmentMessageObject = {
      phoneNumberTo: person.phone,
      phoneNumberFrom: '918411937769',
      fullPath: fullPath,
      fileData: {
        fileName: name,
        filePath: localFilePath,
        // fileBuffer: fileData?.data,
        mimetype: mime.lookup(name) || 'application/octet-stream',
      },
    };
    await new WhatsappAPISelector().sendAttachmentMessageOnWhatsapp(attachmentMessageObj);
  }
}
