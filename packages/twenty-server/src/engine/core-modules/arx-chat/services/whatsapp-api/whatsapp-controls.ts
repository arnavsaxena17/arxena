import { FacebookWhatsappChatApi } from '../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { sendWhatsappMessageVIABaileysAPI, sendAttachmentMessageViaBaileys } from '../../services/whatsapp-api/baileys/callBaileys';
import * as allDataObjects from '../../services/data-model-objects';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import axios from 'axios';
import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';

const baseUrl = 'http://localhost:' + process.env.PORT; // Base URL of your GraphQL server
export class WhatsappAPISelector {

  async sendWhatsappMessageToCandidate(messageText: string,personNode:allDataObjects.PersonNode,  mostRecentMessageArr: allDataObjects.ChatHistoryItem[], functionSource: string,chatControl:allDataObjects.chatControls, isChatEnabled?: boolean, ) {
    console.log('Called sendWhatsappMessage ToCandidate to send message via any whatsapp api::', functionSource, "message text::", messageText);
    if (mostRecentMessageArr[0].role != 'system' && mostRecentMessageArr.length==1) {
      console.log('Found a single sneaky message which is coming out:: ', messageText);
      return;
    }
    if (messageText.includes('#DONTRESPOND#') || messageText.includes('DONTRESPOND') && messageText) {
      console.log('Found a #DONTRESPOND# message, so not sending any message');
      return;
    }
    console.log("Going to create whatsaappupdatemessage obj for message text::", messageText)
    const whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj('sendWhatsappMessageToCandidateMulti', personNode, mostRecentMessageArr);
    if (whatappUpdateMessageObj.messages[0].content?.includes('#DONTRESPOND#') || whatappUpdateMessageObj.messages[0].content?.includes('DONTRESPOND') && whatappUpdateMessageObj.messages[0].content) {
      console.log('Found a #DONTRESPOND# message, so not sending any message');
      return;
    }
    if ((!messageText || messageText == "") && (!whatappUpdateMessageObj.messages[0].content || whatappUpdateMessageObj.messages[0].content=="") ) {
      console.log('Message text is empty, so not sending any message');
      console.log('Current messageText::', messageText);
      console.log('Current whatappUpdateMessageObj.messages[0].content::', whatappUpdateMessageObj.messages[0].content);
      return;
    }
    if (whatappUpdateMessageObj.messages[0].content ||  messageText) {
      if (process.env.WHATSAPP_ENABLED === 'true' && (isChatEnabled === undefined || isChatEnabled)) {
        await new WhatsappAPISelector().sendWhatsappMessage(whatappUpdateMessageObj, personNode, mostRecentMessageArr, chatControl);
      } else {
        console.log('Whatsapp is not enabled, so not sending message:', whatappUpdateMessageObj.messages[0].content);
      }
    }
  }

  async sendWhatsappMessage(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType, personNode: allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[], chatControl: allDataObjects.chatControls) {
    if (process.env.WHATSAPP_API === 'facebook') {
      const response = await new FacebookWhatsappChatApi().sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj, personNode, mostRecentMessageArr, chatControl);
    } else if (process.env.WHATSAPP_API === 'baileys') {
      await sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj, personNode, mostRecentMessageArr);
    } else {
      console.log('No valid whatsapp API selected');
    }
  }
  async sendAttachmentMessageOnWhatsapp(attachmentMessage: allDataObjects.AttachmentMessageObject, personNode: allDataObjects.PersonNode) {
    console.log('attachmentMessage received to send attachment:', attachmentMessage);
    if (process.env.WHATSAPP_API === 'facebook') {
      await new FacebookWhatsappChatApi().uploadAndSendFileToWhatsApp(attachmentMessage);
    } else if (process.env.WHATSAPP_API === 'baileys') {
      await sendAttachmentMessageViaBaileys(attachmentMessage, personNode);
    }
  }

  async sendJDViaWhatsapp( person: allDataObjects.PersonNode, attachment: allDataObjects.Attachment, ) {
    const fullPath = attachment?.fullPath;
    const name = attachment?.name || 'attachment.pdf';
    console.log('This is attachment name:', name);
    const localFilePath = process.cwd() + '/.attachments' + `/${attachment?.jobId}/` + name;
    console.log('This is localFile Path:', localFilePath);
    const fileUrl = `${baseUrl}` + '/files/' + fullPath;
    let fileData;
    try {
      if (!attachment) {
        console.log("There is no attachment attached, cannot proceed with sending the JD to the candidate")
      }
      console.log('path:', fullPath, 'name:', name, 'fileUrl:', fileUrl);
      console.log('localFilePath:', localFilePath);
      // Download and save the file locally
      fileData = await axios({ url: fileUrl, method: 'GET', responseType: 'arraybuffer' });
      if (!fileData?.data) {
        throw new Error('No data found in the file');
      }
      fs.mkdir(path.dirname(localFilePath), { recursive: true }, err => {
        if (err) { return console.error(err); }
        // Write the file
        fs.writeFile(localFilePath, fileData?.data, err => {
          if (err) { return console.error(err); }
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
        mimetype: mime.lookup(name) || 'application/octet-stream',
      },
    };
    await new WhatsappAPISelector().sendAttachmentMessageOnWhatsapp(attachmentMessageObj, person);
  }
}
