import * as allDataObjects from "../../data-model-objects";
import axios from "axios";

const FormData = require('form-data');
const fs = require('fs');
const baseUrl = 'http://localhost:4000/baileys'; // Adjust the base URL as needed


export async function sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType) {
    console.log("Sending message to whatsapp via baileys api");
    console.log("whatappUpdateMessageObj.messageType",whatappUpdateMessageObj.messageType)
    if (whatappUpdateMessageObj.messageType === "botMessage") {
        console.log("This is the standard message to send fromL", allDataObjects.recruiterProfile.phone);
        console.log("This is the standard message to send to phone:", whatappUpdateMessageObj.phoneNumberTo);
        const sendTextMessageObj:allDataObjects.ChatRequestBody = {
            phoneNumberFrom: allDataObjects.recruiterProfile.phone,
            phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
            messages: whatappUpdateMessageObj.messages[0].content,
        };
        await sendWhatsappTextMessageViaBaileys(sendTextMessageObj);
    }
    else{
      console.log("This is send whatsapp message via bailsyes api and is a candidate message");
    }
}
export async function sendWhatsappTextMessageViaBaileys(sendTextMessageObj:allDataObjects.ChatRequestBody){
  console.log("This is the ssendTextMessageObj for baileys to be sent ::", sendTextMessageObj);
  const sendMessageUrl = `${baseUrl}/send-wa-message`;
  const data = {
    fileBuffer: "",
    fileName: "",
    mimetype: "",
    filePath: "",
    WANumber: sendTextMessageObj.phoneNumberTo,
    message: sendTextMessageObj.messages,
    fileData: "",
    jid: sendTextMessageObj.phoneNumberTo+'@s.whatsapp.net'
  };
  try {
    console.log("Trying a first time")
    const response = await axios.post(sendMessageUrl, data);
    console.log('Send Message Response status:', response.status);
    console.log('Send Message Response data:', response.data);
    if (response.status !== 200){
      const response = await axios.post(sendMessageUrl, data);
      console.log("Trying a second time because not worked the first time", response.status)
      if(response.status !== 200){
        const response = await axios.post(sendMessageUrl, data);
        if(response.status !== 200){
          console.log("Even third time not worked. SO FUCKEDUP. FIND ANOTHER WAY", response.status)
        }
        else{
          console.log("WORKED THE THIRD TIME")
        }
      }
      else{
        console.log("WORKED THE SECOND TIME")
      }
    }
  } catch (error: any) {
    console.error('Send Message Error in the first time. Will try to send a test message and then send again:', error.response?.data || error.message);
    // await tryAgaintoSendWhatsappMessage(sendMessageUrl, data)
  }
}

export async function sendAttachmentMessageViaBaileys(sendTextMessageObj:allDataObjects.BaileysAttachmentObject) {
  const uploadFileUrl = `${baseUrl}/send-wa-message-file`;
  const data = {
    WANumber: sendTextMessageObj.phoneNumberTo,
    jid: sendTextMessageObj.phoneNumberTo + '@s.whatsapp.net',
    fileData: sendTextMessageObj.fileData,
    message: 'Here is your requested document.'
  };

  try {
    const response = await axios.post(uploadFileUrl, data);
    console.log('Upload File Response:', response.data);
  } catch (error) {
    console.error('Upload File Error:', error.response?.data || error.message);
  }
}