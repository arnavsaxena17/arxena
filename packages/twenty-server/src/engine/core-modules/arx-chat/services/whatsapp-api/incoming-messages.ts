import CandidateEngagementArx from "../../services/candidate-engagement/check-candidate-engagement";
import { FetchAndUpdateCandidatesChatsWhatsapps } from "../../services/candidate-engagement/update-chat";
import * as allDataObjects from '../../services/data-model-objects';

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
    //         }
    //     }
    // } else {
    //     console.log("Message of type:", requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status, ", ignoring it");
    // }
}
    async receiveIncomingMessagesFromFacebook(requestBody:allDataObjects.WhatsAppBusinessAccount){
        console.log("This is requestBody::", requestBody)
        if (!requestBody?.entry[0]?.changes[0]?.value?.statuses) {
            console.log("There is a request body for sure", requestBody?.entry[0]?.changes[0]?.value?.messages[0])
            const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];

            if (userMessageBody) {
              console.log("There is a usermessage body in the request", userMessageBody)
              if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== "utility") {
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
                await this.createAndUpdateIncomingCandidateChatMessage(chatReply, candidateProfileData);
              }
            }
          } else {
            console.log("Message of type:", requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status, ", ignoring it");
          }   
    }
    async createAndUpdateIncomingCandidateChatMessage(chatReply:string, candidateProfileDataNodeObj:allDataObjects.CandidateNode){  
      const recruiterProfile =  allDataObjects.recruiterProfile;
      const messagesList = candidateProfileDataNodeObj?.whatsappMessages?.edges;
      // Ensure messagesList is not undefined before sorting
      console.log("This is the messageObj:", messagesList.map((edge:any) => edge.node.messageObj));
      let mostRecentMessageObj;
      if (messagesList) {
        console.log("This is the messagesList:", messagesList);
        messagesList.sort((a, b) => new Date(b.node.createdAt).getTime() - new Date(a.node.createdAt).getTime());
        mostRecentMessageObj = messagesList[0]?.node.messageObj;
      }
      else{
        console.log("Just having to take the first one");
        mostRecentMessageObj = candidateProfileDataNodeObj?.whatsappMessages.edges[0].node.messageObj;
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
      await new CandidateEngagementArx().updateAndSendWhatsappMessageAndCandidateEngagementStatusInTable(whatappUpdateMessageObj);
      return whatappUpdateMessageObj;
    } 
}