import { FacebookWhatsappChatApi } from "src/engine/core-modules/recruitment-agent/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api";
import { sendWhatsappMessageVIABaileysAPI, sendAttachmentMessageViaBaileys } from "src/engine/core-modules/recruitment-agent/services/whatsapp-api/baileys/callBaileys";
import * as allDataObjects from "src/engine/core-modules/recruitment-agent/services/data-model-objects";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import axios from 'axios';


const baseUrl = 'http://localhost:'+process.env.PORT; // Base URL of your GraphQL server
export class WhatsappAPISelector{
  constructor() {
  }
  async sendWhatsappMessage(whatappUpdateMessageObj) {
    if (process.env.WHATSAPP_API === 'facebook') {
      await new FacebookWhatsappChatApi().sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj);
    } else if (process.env.WHATSAPP_API === 'baileys') {
        await sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj);
    }
    else {
      console.log("No valid whatsapp API selected");
    }
  }
  async sendAttachmentMessageOnWhatsapp(attachmentMessage: allDataObjects.attachmentMessageObj) {
    console.log("attachmentMessage received to send attachment:", attachmentMessage);
    if (process.env.WHATSAPP_API === 'facebook'){
      // Alternative solution for sending attachment message (doesn't take the file path or mediaID as input, but the file itself)
      // const facebookWhatsappAttachmentMessageObj = {
      //   phoneNumberFrom: attachmentMessage.phoneNumberFrom,
      //   phoneNumberTo: attachmentMessage.phoneNumberTo,
      //   mediaFileName: attachmentMessage.fullPath,
      //   attachmentMessage: attachmentMessage.fullPath,
      //   mediaID: "377908408596785"
      // }
      // await new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(facebookWhatsappAttachmentMessageObj);

      const sendWhatsappAttachmentTextMessageObj = {
        "filePath": attachmentMessage.fullPath,
        "phoneNumberTo": attachmentMessage.phoneNumberTo,
        "attachmentMessage": "Sharing the JD with you"
      }
      await new FacebookWhatsappChatApi().uploadAndSendFileToWhatsApp(sendWhatsappAttachmentTextMessageObj);
    }
    else if (process.env.WHATSAPP_API === 'baileys') {
      // await sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj);
      await sendAttachmentMessageViaBaileys(attachmentMessage);
    }
  }


  async  sendJDViaWhatsapp(person:allDataObjects.PersonNode, candidateId:string,attachment:allDataObjects.Attachment){
    const fullPath= attachment?.fullPath || "";
    const name = attachment?.name || "";
    const localFilePath = path?.join(__dirname, 'downloads', name) || fullPath;
    const fileUrl = `${baseUrl}`+'/'+fullPath; // Adjust this URL as needed based on your server configuration
    let fileData;
    try{
      console.log("Attachment:", attachment);
      console.log("path:", fullPath, "name:", name, "fileUrl:", fileUrl);
      console.log("localFilePath:", localFilePath);
      // Download and save the file locally
      fileData = await axios({ url: fileUrl, method: 'GET', responseType: 'arraybuffer' });
      fs.writeFile(localFilePath, fileData.data, error => {});
    }
    catch(error){
      console.log("Error in downloading the file:", error);
    }
  
    const attachmentMessageObj ={
      phoneNumberTo: person.phone,
      phoneNumberFrom: "918411937769",
      fullPath: fullPath,
      fileData: {
        fileName: name,
        filePath: localFilePath,
        fileBuffer: fileData?.data,
        mimetype: mime.lookup(name) || 'application/octet-stream'
      }
    }
    await new WhatsappAPISelector().sendAttachmentMessageOnWhatsapp(attachmentMessageObj)
  }
  
  
}