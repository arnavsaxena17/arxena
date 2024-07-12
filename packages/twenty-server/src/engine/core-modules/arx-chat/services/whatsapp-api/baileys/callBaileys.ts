import CandidateEngagementArx from '../../candidate-engagement/check-candidate-engagement';
import * as allDataObjects from '../../data-model-objects';
import axios from 'axios';

const FormData = require('form-data');
const fs = require('fs');
const baseUrl = 'http://localhost:4000/baileys'; // Adjust the base URL as needed

export async function sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType, personNode: allDataObjects.PersonNode, mostRecentMessageArr: allDataObjects.ChatHistoryItem[]) {
  console.log('Sending message to whatsapp via baileys api');
  console.log('whatappUpdateMessageObj.messageType', whatappUpdateMessageObj.messageType);
  if (whatappUpdateMessageObj.messageType === 'botMessage') {
    console.log('This is the standard message to send fromL', allDataObjects.recruiterProfile.phone);
    console.log('This is the standard message to send to phone:', whatappUpdateMessageObj.phoneNumberTo);
    const sendTextMessageObj: allDataObjects.ChatRequestBody = {
      phoneNumberFrom: allDataObjects.recruiterProfile.phone,
      phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
      messages: whatappUpdateMessageObj.messages[0].content,
    };
    const response = await sendWhatsappTextMessageViaBaileys(sendTextMessageObj);
    console.log('99493:: response is here', response);
    const whatappUpdateMessageObjAfterWAMidUpdate = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(
      // response?.data?.messages[0]?.id ||
      response?.key?.id || 'placeholdermessageid', // whatsapp message id
      // response,
      personNode,
      mostRecentMessageArr,
    );
    await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObjAfterWAMidUpdate);
  } else {
    console.log('This is send whatsapp message via bailsyes api and is a candidate message');
  }
}

export async function sendWhatsappTextMessageViaBaileys(sendTextMessageObj: allDataObjects.ChatRequestBody) {
  console.log('This is the ssendTextMessageObj for baileys to be sent ::', sendTextMessageObj);
  const sendMessageUrl = `${baseUrl}/send-wa-message`;
  const data = {
    fileBuffer: '',
    fileName: '',
    mimetype: '',
    filePath: '',
    WANumber: sendTextMessageObj.phoneNumberTo.startsWith('+') ? sendTextMessageObj.phoneNumberTo.replace('+', '') : sendTextMessageObj.phoneNumberTo,
    message: sendTextMessageObj.messages,
    fileData: '',
    jid: (sendTextMessageObj.phoneNumberTo.startsWith('+') ? sendTextMessageObj.phoneNumberTo.replace('+', '') : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net',
  };
  let response;
  try {
    console.log('Trying a first time');
    response = await axios.post(sendMessageUrl, data);
    console.log('Send Message Response status:', response.status);
    console.log('Send Message Response data:', response.data);
    // if (response.status !== 200 || 201) {
    //   const response = await axios.post(sendMessageUrl, data);
    //   console.log('Trying a second time because not worked the first time', response.status);
    //   if (response.status !== 200 || 201) {
    //     const response = await axios.post(sendMessageUrl, data);
    //     if (response.status !== 200 || 201) {
    //       console.log('Even third time not worked. SO FUCKEDUP. FIND ANOTHER WAY', response.status);
    //     } else {
    //       console.log('WORKED THE THIRD TIME');
    //     }
    //   } else {
    //     console.log('WORKED THE SECOND TIME');
    //   }
    // }
    return response.data;
  } catch (error: any) {
    console.error('Send Message Error in the first time. Will try to send a test message and then send again:', error.response?.data || error.message);
    // await tryAgaintoSendWhatsappMessage(sendMessageUrl, data)
  }
}

export async function sendAttachmentMessageViaBaileys(sendTextMessageObj: allDataObjects.AttachmentMessageObject) {
  const uploadFileUrl = `${baseUrl}/send-wa-message-file`;
  const data = {
    WANumber: sendTextMessageObj.phoneNumberTo,
    jid: (sendTextMessageObj.phoneNumberTo.startsWith('+') ? sendTextMessageObj.phoneNumberTo.replace('+', '') : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net' + '@s.whatsapp.net',
    fileData: sendTextMessageObj.fileData,
    message: 'Sharing the JD',
  };

  try {
    const response = await axios.post(uploadFileUrl, data);
    console.log('Upload File Response:', response.data);
  } catch (error: any) {
    console.error('Upload File Error:', error.response?.data || error.message);
  }
}
