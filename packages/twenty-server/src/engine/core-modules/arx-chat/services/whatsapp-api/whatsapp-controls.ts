import { FacebookWhatsappChatApi } from "../../services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api";
import { sendWhatsappMessageVIABaileysAPI, sendAttachmentMessageViaBaileys } from "../../services/whatsapp-api/baileys/callBaileys";
import * as allDataObjects from "../../services/data-model-objects";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import axios from 'axios';


const baseUrl = 'http://localhost:' + process.env.PORT; // Base URL of your GraphQL server
export class WhatsappAPISelector{
  constructor() {
  }
  async sendWhatsappMessage(whatappUpdateMessageObj:allDataObjects.candidateChatMessageType) {
    if (process.env.WHATSAPP_API === 'facebook') {
      await new FacebookWhatsappChatApi().sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj);
    } else if (process.env.WHATSAPP_API === 'baileys') {
        await sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj);
    }
    else {
      console.log("No valid whatsapp API selected");
    }
  }
  async sendAttachmentMessageOnWhatsapp(attachmentMessage: any) {
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
        "fileName": attachmentMessage.fileData.fileName,
        "filePath": attachmentMessage.fullPath,
        "phoneNumberTo": attachmentMessage.phoneNumberTo,
        "attachmentMessage":"Sharing the JD with you"
      }
      await new FacebookWhatsappChatApi().uploadAndSendFileToWhatsApp(sendWhatsappAttachmentTextMessageObj);
      debugger;
    }
    else if (process.env.WHATSAPP_API === 'baileys') {
      // await sendWhatsappMessageVIABaileysAPI(whatappUpdateMessageObj);
      await sendAttachmentMessageViaBaileys(attachmentMessage);
    }
  }



  async  sendJDViaWhatsapp(person:allDataObjects.PersonNode, candidateId:string,attachment: any){
    const fullPathh= attachment?.node.fullPath || "";
    const fullPath = fullPathh.split('?')[0];
    const name = attachment?.node.name || "";
    console.log("This is attachment name:", name)
    const localFilePath = path?.join(__dirname, 'downloads', name) || fullPath;
    console.log("This is localFile Path:", localFilePath)
    const fileUrl = fullPath; // Adjust this URL as needed based on your server configuration
    let fileData;
    debugger;

    try{
      console.log("Attachment:", attachment);
      console.log("path:", fullPath, "name:", name, "fileUrl:", fileUrl);
      console.log("localFilePath:", localFilePath);
      // Download and save the file locally
      fileData = await axios({ url: fileUrl, method: 'GET', responseType: 'arraybuffer' });
      fs.writeFile(localFilePath, fileData.data, error => {});
      debugger;
    }
    catch(error){
      console.log("Error in downloading the file:", error);
    }
  
    const attachmentMessageObj ={
      phoneNumberTo: person.phone,
      phoneNumberFrom: "918411937769",
      fullPath: fileUrl,
      // fileName: name,
      fileData: {
        fileName: name,
        filePath: fileUrl,
        fileBuffer: fileData?.data,
        mimetype: mime.lookup(name) || 'application/octet-stream'
      }
    }
    debugger;
    await new WhatsappAPISelector().sendAttachmentMessageOnWhatsapp(attachmentMessageObj)
  }
  
  
}