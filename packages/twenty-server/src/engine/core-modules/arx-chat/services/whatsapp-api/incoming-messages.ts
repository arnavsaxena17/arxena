import CandidateEngagementArx from "../../services/candidate-engagement/check-candidate-engagement";
import { FetchAndUpdateCandidatesChatsWhatsapps } from "../../services/candidate-engagement/update-chat";
import * as allDataObjects from '../../services/data-model-objects';
import {AttachmentProcessingService} from '../candidate-engagement/attachment-processing';


const axios = require('axios');
import fs from 'fs';
import path from 'path';
const { promisify } = require('util');

// Promisify the fs functions for better async/await handling
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);


let whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API

if (process.env.FACEBOOK_WHATSAPP_PERMANENT_API) {
    whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API;
}
else {
    whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_API_TOKEN;
}

export class IncomingWhatsappMessages{

  async receiveIncomingMessagesFromBaileys(requestBody:allDataObjects.BaileysIncomingMessage){
    console.log("This is requestBody::", requestBody)
    const whatsappIncomingMessage: allDataObjects.chatMessageType = {
        phoneNumberFrom: requestBody.phoneNumberFrom,
        phoneNumberTo: requestBody.phoneNumberTo,
        messages: [{"role":"user","content":requestBody.message}],
        messageType : "string"
    };
    const chatReply = requestBody.message;
    console.log("We will first go and get the candiate who sent us the message");
    const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
    console.log("This is the candiate who has sent us the message fromBaileys., we have to update the database that this message has been recemivged::", chatReply);
    if (candidateProfileData != allDataObjects.emptyCandidateProfileObj){
      console.log("This is the candiate who has sent us candidateProfileData::", candidateProfileData)
      await this.createAndUpdateIncomingCandidateChatMessage(chatReply, candidateProfileData)
    }
    else{
      console.log("Message has been received from a candidate however the candidate is not in the database")
    }
  }




  async receiveIncomingMessagesFromFacebook(requestBody:allDataObjects.WhatsAppBusinessAccount){
    console.log("receiveIncomingMessagesFromFacebook is the function being called ---------------------------------- ");
    console.log("This is requestBody::", requestBody)
    debugger;
    if (!requestBody?.entry[0]?.changes[0]?.value?.statuses) {
      console.log("There is a request body for sure", requestBody?.entry[0]?.changes[0]?.value?.messages[0])
      const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];
      debugger;

      if (userMessageBody) {
        console.log("There is a usermessage body in the request", userMessageBody)
        console.log("Request Value: ",requestBody?.entry[0]?.changes[0]?.value );
        debugger;
        if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type == "document") {
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number
          const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];
          const documentMessage = userMessageBody.document;
      
          const documentId = documentMessage.id; // Extract document ID
          const mimeType = documentMessage.mime_type; // Extract mime type





          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{"role":"user","content":userMessageBody.document.caption}],
            messageType : "string"
          };
          

          const chatReply = documentMessage.caption;
          console.log("This the caption to the document: ", chatReply );
          console.log("We will first go and get the candiate who sent us the message");
          const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
          console.log("This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::", chatReply);
          console.log("This is the candiate who has sent us candidateProfileData::", candidateProfileData);
          await this.createAndUpdateIncomingCandidateChatMessage(chatReply, candidateProfileData);


          // Fetch the document URL
          const documentUrl = await getDocumentUrl(documentId);
          console.log("Document URL: ", documentUrl);
          // Download the document
          const filePath = `/Candidate_attachments/${documentId}.${mimeType.split('/')[1]}`;
            // Set a path for the downloaded file
          await downloadDocument(documentUrl, documentId, mimeType, candidateProfileData.id, chatReply);
          console.log("Document downloaded to: ", filePath);

          // What to do with documents candidates send goes here.
          console.log("We got the pdf here.");
          debugger;
        }
        else if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== "utility") {
          debugger;
          console.log("We have a whatsapp incoming message which is a text one we have to do set of things with which is not a utility message")
          const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number
          const whatsappIncomingMessage: allDataObjects.chatMessageType = {
            phoneNumberFrom: userMessageBody.from,
            phoneNumberTo: phoneNumberTo,
            messages: [{"role":"user","content":userMessageBody.text.body}],
            messageType : "string"
          };
          const chatReply = userMessageBody.text.body;
          console.log("We will first go and get the candiate who sent us the message");
          const candidateProfileData = await new FetchAndUpdateCandidatesChatsWhatsapps().getCandidateInformation(whatsappIncomingMessage);
          console.log("This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::", chatReply);
          console.log("This is the candiate who has sent us candidateProfileData::", candidateProfileData);
          debugger;
          await this.createAndUpdateIncomingCandidateChatMessage(chatReply, candidateProfileData);
        }
      }
    } else {
      console.log("Message of type:", requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status, ", ignoring it");
    }   
    debugger;
  }





    async createAndUpdateIncomingCandidateChatMessage(chatReply:any, candidateProfileDataNodeObj:allDataObjects.CandidateNode){  
      console.log("createAndUpdateIncomingCandidateChatMessage Function is being called --------------------------------------------");
      const recruiterProfile =  allDataObjects.recruiterProfile;
      const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;
      debugger;
      // Ensure messagesList is not undefined before sorting
      console.log("This is the messageObj:", messagesList.map((edge:any) => edge.node.messageObj));
      let mostRecentMessageObj;
      debugger;
      if (messagesList) {
        console.log("This is the messagesList:", messagesList);
        messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
        mostRecentMessageObj = messagesList[0]?.node.messageObj;
        debugger;
      }
      else{
        console.log("Just having to take the first one");
        mostRecentMessageObj = candidateProfileDataNodeObj?.whatsappMessages.edges[0].node.messageObj;
        debugger;
      }
      console.log("These are message kwargs length:", mostRecentMessageObj?.length);
      console.log("This is the most recent message object being considered::", mostRecentMessageObj);
      // chatHistory = await this.getChatHistoryFromMongo(mostRecentMessageObj);
      mostRecentMessageObj.push({role: "user", content: chatReply});
      let whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = {
        executorResultObj: {},
        candidateProfile:candidateProfileDataNodeObj,
        candidateFirstName: candidateProfileDataNodeObj.name,
        phoneNumberFrom: candidateProfileDataNodeObj?.phoneNumber,
        phoneNumberTo: recruiterProfile.phone,
        messages: [{ content: chatReply }],
        messageType : "candidateMessage",
        messageObj: mostRecentMessageObj
      };

      debugger;
      await new CandidateEngagementArx().updateCandidateEngagementDataInTable(whatappUpdateMessageObj);
      return whatappUpdateMessageObj;
    } 
}



async function getDocumentUrl(documentId) {
  const url = `https://graph.facebook.com/v18.0/${documentId}?access_token=${whatsappAPIToken}`;
  console.log(documentId);
  console.log(url);

  const response = await fetch(url, {
      method: 'GET',
      headers: {
          'Authorization': `Bearer ${whatsappAPIToken}`,
          'Content-Type': 'application/pdf'
      }
  });
  debugger;
  if (!response.ok) {
    throw new Error(`Error fetching document URL: ${response.statusText}`);
  }

  const data = await response.json();
  debugger;
  return data.url; 
}


async function downloadDocument(documentUrl, documentId, mimeType, candidateID, documentName) {
  const directory = path.join(__dirname, 'downloads', candidateID); // Create a directory path using documentId
  const filePath = path.join(directory, `${documentName.split('.')[0]}.${mimeType.split('/')[1]}`); // Set the file path for the downloaded file

  // Check if the directory exists, if not create it
  if (!(await exists(directory))) {
      await mkdir(directory, { recursive: true });
  }

  console.log("This is where the file is about to be downloaded", directory);
  console.log("This is the file path", filePath);
  debugger;

  try {
      // Download the document
      const response = await axios({
          url: documentUrl,
          method: 'GET',
          responseType: 'stream',
          headers: {
              'Authorization': `Bearer ${whatsappAPIToken}`
          }
      });
      debugger;
      // const response = await axios.get(documentUrl, {
      //   method: 'GET',
      //   responseType: 'stream',
      //   headers: {
      //       'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`
      //   }
      // });

      // Save the document to the file path
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      https://nvm0chps-3000.euw.devtunnels.ms/


      //temp here
      const attachmentProcessingService = new AttachmentProcessingService();
      const docurl = await attachmentProcessingService.UploadFileToGetPath(filePath);
      debugger;
      await attachmentProcessingService.createOneAttachmentfunc(docurl, documentName, candidateID);
      console.log("Called the function createOneAttachmentfunc,.................", candidateID);
      //temp here





      return new Promise((resolve, reject) => {
          writer.on('finish', () => {
              resolve(filePath);
              console.log("Success! File downloaded to:", filePath);
          });

          writer.on('error', (err) => {
              reject(err);
          }); 
      });
  } catch (error) {
    console.error(`Error downloading document: ${error.message}`);
    if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
        console.error('Error response data:', error.response.data);
    } else {
        console.error('Error details:', error);
    }
    throw error;
  }
}