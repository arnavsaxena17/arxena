import CandidateEngagementArx from '../../candidate-engagement/check-candidate-engagement';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../candidate-engagement/update-chat';
import * as allDataObjects from '../../data-model-objects';
import axios from 'axios';

const FormData = require('form-data');
const fs = require('fs');
const baseUrl = 'http://localhost:3000/whatsapp'; // Adjust the base URL as needed

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
    const response = await sendWhatsappTextMessageViaBaileys(sendTextMessageObj, personNode);
    // console.log('99493:: response is here', response);
    const whatappUpdateMessageObjAfterWAMidUpdate = await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(
      // response?.data?.messages[0]?.id ||
      response?.key?.id || 'placeholdermessageid', // whatsapp message id
      // response,
      personNode,
      mostRecentMessageArr,
    );
    let candidateProfileObj = whatappUpdateMessageObj.messageType !== 'botMessage' ? await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatappUpdateMessageObj) : whatappUpdateMessageObj.candidateProfile;

    await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObjAfterWAMidUpdate, true);
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);

    // await updateCandidateEngagementStatus
  } else {
    console.log('This is send whatsapp message via bailsyes api and is a candidate message');
  }
}

export async function sendWhatsappTextMessageViaBaileys(sendTextMessageObj: allDataObjects.ChatRequestBody, personNode: allDataObjects.PersonNode) {
  // console.log('This is the ssendTextMessageObj for baileys to be sent ::', sendTextMessageObj);
  const sendMessageUrl = `${baseUrl}/send`;
  const data = {
    fileBuffer: '',
    fileName: '',
    mimetype: '',
    filePath: '',
    WANumber: sendTextMessageObj.phoneNumberTo.startsWith('+') ? sendTextMessageObj.phoneNumberTo.replace('+', '') : sendTextMessageObj.phoneNumberTo,
    message: sendTextMessageObj.messages,
    fileData: '',
    jid: (sendTextMessageObj.phoneNumberTo.startsWith('+') ? sendTextMessageObj.phoneNumberTo.replace('+', '') : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net',
    recruiterId: personNode?.candidates?.edges[0]?.node?.jobs?.recruiterId,
  };
  let response;
  try {
    console.log('Trying to send message via send API');
    response = await axios.post(sendMessageUrl, data);
    console.log('Send Message Response status:', response.status);
    console.log('Send Message Response:', response.data);
    // console.log('Send Message Response data:', response.data);
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
    await new Promise(resolve => setTimeout(resolve, 10000));
    await tryAgaintoSendWhatsappMessage(sendTextMessageObj);
  }
}

async function tryAgaintoSendWhatsappMessage(sendTextMessageObj: allDataObjects.ChatRequestBody) {
  try {
    const sendMessageUrl = `${baseUrl}/send`;
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
    console.log('Trying to send again message via send API');
    const response = await axios.post(sendMessageUrl, data);
    console.log('Send Message Response in Try sendAgain status:', response.status);
    console.log('Send Message Response data second time:', response.data);
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
  } catch (error: any) {
    console.error('SECOND TIME DID NOT WORK> PLEASE CHECK THE SYSTEM:', error.response?.data || error.message);
  }
}

export async function sendAttachmentMessageViaBaileys(sendTextMessageObj: allDataObjects.AttachmentMessageObject, personNode: allDataObjects.PersonNode) {
  const uploadFileUrl = `${baseUrl}/send-wa-message-file`;
  const data = {
    WANumber: sendTextMessageObj.phoneNumberTo,
    jid: (sendTextMessageObj.phoneNumberTo.startsWith('+') ? sendTextMessageObj.phoneNumberTo.replace('+', '') : sendTextMessageObj.phoneNumberTo) + '@s.whatsapp.net',
    fileData: sendTextMessageObj.fileData,
    message: 'Sharing the JD',
  };

  const payloadToSendToWhiskey = {
    recruiterId: personNode?.candidates?.edges[0]?.node?.jobs?.recruiterId,
    fileToSendData: data,
  };

  try {
    const response = await axios.post(uploadFileUrl, payloadToSendToWhiskey);
    console.log('Upload File Response:', response.data);
  } catch (error: any) {
    console.error('Upload File Error:', error.response?.data || error.message);
  }
}
