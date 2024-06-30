import CandidateEngagement from "src/engine/core-modules/recruitment-agent/services/candidate-engagement/check-candidate-engagement";
import { FetchAndUpdateCandidatesChatsWhatsapps } from "src/engine/core-modules/recruitment-agent/services/candidate-engagement/update-chat";
import * as allDataObjects from 'src/engine/core-modules/recruitment-agent/services/data-model-objects';



export class IncomingWhatsappMessages {

  async receiveIncomingMessagesFromBaileys(requestBody:allDataObjects.BaileysIncomingMessage){
    console.log("This is requestBody::", requestBody)
    // if (!requestBody?.entry[0]?.changes[0]?.value?.statuses) {
    //     console.log("There is a request body for sure", requestBody?.entry[0]?.changes[0]?.value?.messages[0])
    //     const userMessageBody = requestBody?.entry[0]?.changes[0]?.value?.messages[0];
    //     if (userMessageBody) {
    //       console.log("There is a usermessage body in the request", userMessageBody)
    //       if (requestBody?.entry[0]?.changes[0]?.value?.messages[0].type !== "utility") {
    //         console.log("We have a whatsapp incoming message which is a text one we have to do set of things with which is not a utility message")
    //         const phoneNumberTo = requestBody?.entry[0]?.changes[0]?.value?.metadata?.display_phone_number
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
      await new CandidateEngagement().createAndUpdateIncomingCandidateChatMessage(chatReply, candidateProfileData)
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
                console.log("This is the candiate who has sent us candidateProfileData::", candidateProfileData)
                await new CandidateEngagement().createAndUpdateIncomingCandidateChatMessage(chatReply, candidateProfileData)
              }
            }
          } else {
            console.log("Message of type:", requestBody?.entry[0]?.changes[0]?.value?.statuses[0]?.status, ", ignoring it");
          }   
    }
}