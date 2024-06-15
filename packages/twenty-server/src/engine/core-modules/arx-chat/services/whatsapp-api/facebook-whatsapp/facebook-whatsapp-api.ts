// import { ChatRequestBody, candidateChatMessageType, recruiterProfile, sendWhatsappTemplateMessageObjectType } from "../../../services/data-model-objects";
// import {UpdateChat} from '../candidateEngagement/updateChat';
// import  CandidateEngagement  from "../../../services/candidateEngagement/checkCandidateEngagement";
import *  as allDataObjects from '../../../services/data-model-objects'; 
// import { promisify } from 'util';
// import { response } from 'express';
import fs from 'fs';
import path from 'path';
// const mimePromise = import('mime');



// const phoneNumberIDs = {
//     "14155793982": "228382133694523",
//     "918591724917": "213381881866663"
// }
const FormData = require('form-data');
import { createReadStream, createWriteStream } from 'fs';
import { getContentTypeFromFileName } from '../../../utils/arx-chat-agent-utils';
import { AttachmentProcessingService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/attachment-processing';
// import { lookup } from 'mime';
// const mime = require('mime');
const axios = require('axios');

let whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API

if (process.env.FACEBOOK_WHATSAPP_PERMANENT_API) {
    whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API;
}
else {
    whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_API_TOKEN;
}

const templates = ['hello_world', 'recruitment']
export class FacebookWhatsappChatApi {
  async uploadAndSendFileToWhatsApp  (sendFileObj: allDataObjects.SendAttachment) {
    console.log("Send file")
    console.log("sendFileObj::y::", sendFileObj)
    const filePath = sendFileObj?.filePath
    const phoneNumberTo = sendFileObj?.phoneNumberTo
    const attachmentMessage = sendFileObj?.attachmentMessage
    const response = await new FacebookWhatsappChatApi().uploadFileToWhatsApp(filePath)
    const mediaID = response?.mediaID
    const fileName = response?.fileName
    const sendTextMessageObj = {
      "phoneNumberFrom": "918411937769",
      "attachmentMessage": attachmentMessage,
      "phoneNumberTo": phoneNumberTo ?? "918411937769",
      "mediaFileName" : fileName ?? "AttachmentFile",
      "mediaID" : mediaID
    }
    new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(sendTextMessageObj)

  }
    getTemplateMessageObj(sendTemplateMessageObj:allDataObjects.sendWhatsappTemplateMessageObjectType) {
        const templateMessageObj = JSON.stringify({
            "messaging_product": "whatsapp",
            "to": sendTemplateMessageObj.recipient,
            "type": "template",
            "template": {
                "name": sendTemplateMessageObj.template_name,
                "language": {
                    "code": "en"
                },
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {
                                "type": "text",
                                "text": sendTemplateMessageObj.candidateFirstName
                            },
                            {
                                "type": "text",
                                "text": sendTemplateMessageObj.recruiterName
                            },
                            {
                                "type": "text",
                                "text": sendTemplateMessageObj.recruiterJobTitle
                            },
                            {
                                "type": "text",
                                "text": sendTemplateMessageObj.recruiterCompanyName
                            },
                            {
                                "type": "text",
                                "text": sendTemplateMessageObj.recruiterCompanyDescription
                            },
                            {
                                "type": "text",
                                "text": sendTemplateMessageObj.jobPositionName
                            },
                            {
                                "type": "text",
                                "text": sendTemplateMessageObj.jobLocation
                            }
                        ]
                    }
                ]
            }
        })
        // console.log("This is the template message object created:", templateMessageObj)
        return templateMessageObj
    }
    async sendWhatsappTextMessage(sendTextMessageObj:allDataObjects.ChatRequestBody){
        console.log("Sending a message to ::", sendTextMessageObj.phoneNumberTo)
        console.log("Sending message text ::", sendTextMessageObj.messages)
        const text_message = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": sendTextMessageObj.phoneNumberTo,
            "type": "text",
            "text": {"preview_url": false, "body": sendTextMessageObj.messages},
        }
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/'+process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID+'/messages',
            headers: { 
              'Authorization': 'Bearer '+ whatsappAPIToken, 
              'Content-Type': 'application/json'
            },
            data : text_message
          };
        //   console.log("This is the config in sendWhatsappTextMessage:", config)
          
          axios.request(config)
          .then((response) => {
            console.log("this isresponse::", JSON.stringify(response.data));
          })
          .catch((error) => {
            console.log("This is axios errror::", error);
        });
    }
    

    async fetchFileFromTwentyGetLocalPath(){
        const fileUrl = 'http://localhost:3000/files/attachment/2604e253-36e3-4e87-9638-bdbb661a0547.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmF0aW9uX2RhdGUiOiIyMDI0LTA1LTI3VDEwOjE3OjM5Ljk2MFoiLCJhdHRhY2htZW50X2lkIjoiZjIwYjE5YzUtZDAwYy00NzBjLWI5YjAtNzY2MTgwOTdhZjkyIiwiaWF0IjoxNzE2NzE4NjU5LCJleHAiOjE3MTY4OTg2NTl9.NP6CvbDKTh3W0T0uP0JKUfnV_PmN6rIz6FanK7Hp_us';
            const response = await axios.get(fileUrl, { responseType: 'stream' });
            console.log("Response status received:", response.status);
            console.log("Response.data:", response.data)
            // console.log("Response.data stringified:", JSON.stringify(response))
    
            const fileName = response.headers['content-disposition']?.split('filename=')[1]?.trim().replace(/"/g, '') ?? 'file.pdf';
            console.log("FileName:", fileName);
    

            const currentDir = process.cwd();
            const filePath = path.resolve(currentDir, fileName);
                console.log("This is the file path:", filePath);
    
            const writeStream = createWriteStream(filePath);
            response.data.pipe(writeStream);
    
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
            console.log("response.headers['']:", response.headers)
            console.log("response.headers['content-type']:", response.headers['content-type'])
    
            const contentType = response.headers['content-type'] || 'application/pdf';
            return {filePath, fileName, contentType};
            
    }

    async uploadFileToWhatsApp(filePath) {
        console.log("This is the upload file to whatsapp")
        
        try {
            // const filePath = '/Users/arnavsaxena/Downloads/CVs-Mx/Prabhakar_Azad_Resume_05122022.doc';
            // Get the file name
            const fileName = path.basename(filePath);
            // Get the content type
            // const contentType = mime.lookup(fileName) || 'application/octet-stream';
            // const fileData = await fileTypeFromFile(filePath)
            // const contentType = fileData?.mime || 'application/octet-stream';
            const contentType = await getContentTypeFromFileName(fileName);
            console.log("This is the content type:", contentType);
            console.log("This is the file name:", fileName);
    
            const formData = new FormData();
            formData.append('file', createReadStream(filePath), {
                contentType: contentType,
                filename: fileName
            });

            formData.append('messaging_product', 'whatsapp');
            try {
                const { data: { id: mediaId } } = await axios.post(`https://graph.facebook.com/v18.0/${process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID}/media`,
                    formData, {
                        headers: {
                            Authorization: `Bearer ${whatsappAPIToken}`,
                            ...formData.getHeaders(),
                        },
                    }
                );
                console.log("media ID", mediaId);
                console.log("Request successful");
                return {"mediaID": mediaId, "status": "success", "fileName": fileName, "contentType": contentType};

            } catch (err) {
                console.error("upload", err.toJSON());
            }
            // Remove the local file
            // const unlink = promisify(fs.unlink);
            // await unlink(filePath);
        } catch (error) {
            console.error('Error downloading file from WhatsApp:', error);
            throw error;
        }
        // Get the file name and content type from the response headers
    }
        
    async sendWhatsappAttachmentMessage(sendWhatsappAttachmentTextMessageObj:allDataObjects.FacebookWhatsappAttachmentChatRequestBody){
        console.log("sending whatsapp attachment message")
        const text_message = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": sendWhatsappAttachmentTextMessageObj.phoneNumberTo,
            "type": "document",
            "document": {
                "id": sendWhatsappAttachmentTextMessageObj.mediaID,
                "caption": sendWhatsappAttachmentTextMessageObj.attachmentMessage,
                "filename":sendWhatsappAttachmentTextMessageObj.mediaFileName ? sendWhatsappAttachmentTextMessageObj.mediaFileName : "attachment",
            }
        }

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/'+process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID+'/messages',
            headers: { 
              'Authorization': 'Bearer '+ whatsappAPIToken, 
              'Content-Type': 'application/json'
            },
            data : text_message
          };
        //   console.log("This is the config in sendWhatsappAttachmentMessage:", config)
          
        try {
            const response = await axios.request(config);
            console.log("Rehis is response data after sendAttachment is called",JSON.stringify(response.data));
        } catch (error) {
            console.log(error);
        }
    }   
    
    
    
     async sendWhatsappTemplateMessage(sendTemplateMessageObj:allDataObjects.sendWhatsappTemplateMessageObjectType){
        console.log("Received this template message object:", sendTemplateMessageObj)
        let templateMessage = this.getTemplateMessageObj(sendTemplateMessageObj);
        console.log("This is the template message object:", templateMessage)
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/'+process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID+'/messages',
            headers: {
                Authorization: 'Bearer ' + whatsappAPIToken,
                'Content-Type': 'application/json'
            },
            data : templateMessage
    
        };
        // console.log("This is the config in sendWhatsappTemplateMessage:", config);
        try {
            const response = await axios.request(config);
            // console.log("This is the response:", response)
            // console.log("This is the response data:", response.data)
            if (response?.data?.messages[0]?.message_status === "accepted") {
              console.log("Message sent successfully and accepted by FACEBOOK API with id::", response?.data?.messages[0]?.id);
              // wamid.HBgMOTE4NDExOTM3NzY5FQIAERgSNjI0NkM1RjlCNzBGMEE5MjY5AA
            }
            console.log("This is the message sent successfully");
          } catch (error) {
            console.log("This is error in facebook graph api when sending messaging template::", error);
          }
        
    }
    
    
    async downloadWhatsappAttachmentMessage(sendTemplateMessageObj:{
        filename: string,
        mime_type: string,
        documentId: string

    }, candidateProfileData: allDataObjects.CandidateNode) {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/' + sendTemplateMessageObj.documentId,
            headers: {
                Authorization: 'Bearer ' + whatsappAPIToken,
                'Content-Type': 'application/json'
            },
            responseType:'json'
        };
        // console.log("This is the config in downloadWhatsappAttachmentMessage", config);
        const response = await axios.request(config)

        const url = response.data.url;
        config.url = url;
        config.responseType = 'stream'
        const fileDownloadResponse = await axios.request(config)


        // console.log("This is the response:", response.data)
        console.log("This is the response: bpdy", response.body)
        const fileName = sendTemplateMessageObj.filename; // Set the desired file name
        const filePath = `${process.cwd()}/${fileName}`;
        const writeStream = fs.createWriteStream(filePath);
        fileDownloadResponse.data.pipe(writeStream); // Pipe response stream to file stream
        writeStream.on('finish',async () => {
            console.log('File saved successfully at',filePath );
            const attachmentObj = await new AttachmentProcessingService().uploadAttachmentToTwenty(filePath)
            // attachmentObj.uploadFile
            // candidateProfileData.id
            // {
            //     "input": {
            //       "authorId": "20202020-0687-4c41-b707-ed1bfca972a7",
            //       "name": fileName,
            //       "fullPath": attachmentObj.uploadFile,
            //       "type": "TextDocument",
            //       "candidateId":  allDataObjects.CandidateNode,
              
            //     }
            //   }
        });
        writeStream.on('error', (error) => {
            console.error('Error saving file:', error);
        });
    

        
    }
    async sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj: allDataObjects.candidateChatMessageType) {
        console.log("Sending message to whatsapp via facebook api")
        console.log("whatappUpdateMessageObj.messageType",whatappUpdateMessageObj.messageType)
        console.log("whatappUpdateMessageObj.messageType whatappUpdateMessageObj.messages ",JSON.stringify(whatappUpdateMessageObj))
        if (whatappUpdateMessageObj.messageType === "botMessage") {
            if (whatappUpdateMessageObj.messages[0].content.includes("a US Based Recruitment Company") || whatappUpdateMessageObj.messages[0].content.includes("assist")) {
                console.log("This is the template api message to send in whatappUpdateMessageObj.phoneNumberFrom, ", whatappUpdateMessageObj.phoneNumberFrom)
                const sendTemplateMessageObj = {
                    recipient: whatappUpdateMessageObj.phoneNumberTo,
                    template_name: templates[1],
                    candidateFirstName: whatappUpdateMessageObj.candidateFirstName,
                    recruiterName: allDataObjects.recruiterProfile.name,
                    recruiterJobTitle: allDataObjects.recruiterProfile.job_title,
                    recruiterCompanyName: allDataObjects.recruiterProfile.job_company_name,
                    recruiterCompanyDescription: allDataObjects.recruiterProfile.company_description_oneliner,
                    jobPositionName: whatappUpdateMessageObj?.candidateProfile?.jobs?.name,
                    jobLocation: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobLocation
                }
                await this.sendWhatsappTemplateMessage(sendTemplateMessageObj);
            }
            else{
                console.log("This is the standard message to send fromL", allDataObjects.recruiterProfile.phone)
                console.log("This is the standard message to send to phone:", whatappUpdateMessageObj.phoneNumberTo);
    
                const sendTextMessageObj:allDataObjects.ChatRequestBody = {
                    phoneNumberFrom: allDataObjects.recruiterProfile.phone,
                    phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
                    messages: whatappUpdateMessageObj.messages[0].content,
                };
                await this.sendWhatsappTextMessage(sendTextMessageObj);
            }
        }
        else{

            console.log("passing a human message so, going to trash it")
        }
    }
}
