import { candidateChatMessageType, recruiterProfile, sendWhatsappTemplateMessageObjectType,sendingAndIncomingwhatsappTextMessageType } from "src/engine/core-modules/recruitment-agent/services/data-model-objects";
import {UpdateChat} from '../candidateEngagement/updateChat';
import  CandidateEngagement  from "src/engine/core-modules/recruitment-agent/services/candidateEngagement/checkCandidateEngagement";

// const phoneNumberIDs = {
//     "14155793982": "228382133694523",
//     "918591724917": "213381881866663"
// }
const FormData = require('form-data');
import { createReadStream, createWriteStream } from 'fs';
import { promisify } from 'util';

const axios = require('axios');
const fs = require('fs');



// const phoneNumberToUse:string = process.env.TWENTY_WHATSAPP_PHONE_NUMBER ?? '918591724917';
// console.log("This is the phone number we plan to use:", phoneNumberToUse)

// const phoneNumberIDtoUse = phoneNumberIDs[phoneNumberToUse];


const templates = ['hello_world', 'recruitment']

export class FacebookWhatsappChatApi {
    getTemplateMessageObj(sendTemplateMessageObj:sendWhatsappTemplateMessageObjectType) {
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
        console.log("This is the template message object:", templateMessageObj)
        return templateMessageObj
    }
     sendWhatsappTextMessage(sendTextMessageObj:sendingAndIncomingwhatsappTextMessageType){
        console.log("Sending a message to ::", sendTextMessageObj.phoneNumberTo)
        console.log("Sending message text ::", sendTextMessageObj.text)
        const text_message = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": sendTextMessageObj.phoneNumberTo,
            "type": "text",
            "text": {"preview_url": false, "body": sendTextMessageObj.text},
        }
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/'+process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID+'/messages',
            headers: { 
              'Authorization': 'Bearer '+ process.env.FACEBOOK_WHATSAPP_API_TOKEN, 
              'Content-Type': 'application/json'
            },
            data : text_message
          };
          console.log("This is the config:", config)
          
          axios.request(config)
          .then((response) => {
            console.log("this isresponse::", JSON.stringify(response.data));
          })
          .catch((error) => {
            console.log("This is axios errror::", error);
        });
    }
    
    async uploadFileToWhatsApp() {
        const fileUrl = 'http://localhost:3000/files/attachment/80834132-5b41-46bb-8fed-8f488748a4d5.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmF0aW9uX2RhdGUiOiIyMDI0LTA0LTIxVDEzOjE0OjA0LjA1M1oiLCJhdHRhY2htZW50X2lkIjoiODczYWFhOWItN2Q0YS00NThhLTgyNTAtOGI5NWNiMjEyOWJiIiwiaWF0IjoxNzEzNjE4ODQ0LCJleHAiOjE3MTM3OTg4NDR9.SRMmTzTx0TUviySs6ym_gxDlELyHTUwYhzDg8L1xp_A';
        
        try {
            const response = await axios.get(fileUrl, { responseType: 'stream' });
            const fileName = response.headers['content-disposition']?.split('filename=')[1]?.trim().replace(/"/g, '') ?? 'file';
            const filePath = `${process.cwd()}/${fileName}`;
            const writeStream = createWriteStream(filePath);
            response.data.pipe(writeStream);
    
            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });
    
            // Get the file name and content type from the response headers
            console.log("This is the file name:", fileName);
            const contentType = response.headers['content-type'];
            console.log("This is the content type:", contentType);
    
            const formData = new FormData();
            formData.append('file', createReadStream(filePath), {
                contentType: contentType,
                filename: fileName
            });
            formData.append('messaging_product', 'whatsapp');
    
            try {
                const {
                    data: { id: mediaId },
                } = await axios.post(
                    `https://graph.facebook.com/v18.0/${process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID}/media`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.FACEBOOK_WHATSAPP_API_TOKEN}`,
                            ...formData.getHeaders(),
                        },
                    }
                );
                console.log("media ID", mediaId);
                console.log("Request successful");
            } catch (err) {
                console.error("upload", err.toJSON());
            }
    
            // Remove the local file
            const unlink = promisify(fs.unlink);
            await unlink(filePath);
            console.log("Local file removed")
        } catch (error) {
            console.error('Error uploading file to WhatsApp:', error);
            throw error;
        }
    }
    
    
     sendWhatsappAttachmentMessage(sendTextMessageObj:sendingAndIncomingwhatsappTextMessageType){
    
        const text_message = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": sendTextMessageObj.phoneNumberTo,
            "type": "document",
            "document": {
                "id": "446455208056291",
                "caption": sendTextMessageObj.text,
                "filename": "sample.pdf",
            }
        }
    
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/'+process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID+'/messages',
            headers: { 
              'Authorization': 'Bearer '+ process.env.FACEBOOK_WHATSAPP_API_TOKEN, 
              'Content-Type': 'application/json'
            },
            data : text_message
          };
          console.log("This is the config:", config)
          
          axios.request(config)
          .then((response) => {
            console.log(JSON.stringify(response.data));
          })
          .catch((error) => {
            console.log(error);
        });
    }   
    
    
    
     sendWhatsappTemplateMessage(sendTemplateMessageObj:sendWhatsappTemplateMessageObjectType){
        console.log("Received this template message object:", sendTemplateMessageObj)
        let templateMessage = this.getTemplateMessageObj(sendTemplateMessageObj);
        console.log("This is the template message object:", templateMessage)
    
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/'+process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID+'/messages',
            headers: {
                Authorization: 'Bearer ' + process.env.FACEBOOK_WHATSAPP_API_TOKEN,
                'Content-Type': 'application/json'
            },
            data : templateMessage
    
        };
        console.log("This is the config:", config);
        axios.request(config).then((response) => {
                // console.log("This is the response:", response)
                // console.log("This is the response data:", response.data)
                if(response?.data?.messages[0]?.message_status === "accepted"){
                    console.log("Message sent successfully and accepted by FACEBOOK API with id::", response?.data?.messages[0]?.id)
                    // wamid.HBgMOTE4NDExOTM3NzY5FQIAERgSNjI0NkM1RjlCNzBGMEE5MjY5AA
                }
                console.log("This is the  message sent successfully")
            }).catch((error) => {
                console.log("This is error in facebook graph api when sending messageing template::", error);
                debugger;
            });
    }
    
    
    downloadWhatsappAttachmentMessage(sendTemplateMessageObj) {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://graph.facebook.com/v18.0/432131722836314',
            headers: {
                Authorization: 'Bearer ' + process.env.FACEBOOK_WHATSAPP_API_TOKEN,
                'Content-Type': 'application/json'
            },
            responseType: 'stream' // Ensure response is treated as a stream
        };
        console.log("This is the config:", config);
        axios.request(config)
            .then((response) => {
                // console.log("This is the response:", response.data)
                console.log("This is the response: bpdy", response.body)
                const fileName = 'attachment.pdf'; // Set the desired file name
                const filePath = `${process.cwd()}/${fileName}`;
                const writeStream = fs.createWriteStream(filePath);
                response.data.pipe(writeStream); // Pipe response stream to file stream
    
                writeStream.on('finish', () => {
                    console.log('File saved successfully');
                });
                writeStream.on('error', (error) => {
                    console.error('Error saving file:', error);
                });
            })
            .catch((error) => {
                console.log(error);
            });
    }
    async sendWhatsappMessageVIAFacebookAPI(whatappUpdateMessageObj: candidateChatMessageType) {
        console.log("Sending message to whatsapp via facebook api")
        console.log("whatappUpdateMessageObj.messageType",whatappUpdateMessageObj.messageType)
        if (whatappUpdateMessageObj.messageType === "botMessage") {
            if (whatappUpdateMessageObj.messages[0].content.includes("a US Based Recruitment Company")) {
                console.log("This is the template api message to send in whatappUpdateMessageObj.phoneNumberFrom, ", whatappUpdateMessageObj.phoneNumberFrom)

                const sendTemplateMessageObj = {
                    recipient: whatappUpdateMessageObj.phoneNumberTo,
                    template_name: templates[1],
                    candidateFirstName: whatappUpdateMessageObj.candidateFirstName,
                    recruiterName: recruiterProfile.name,
                    recruiterJobTitle: recruiterProfile.job_title,
                    recruiterCompanyName: recruiterProfile.job_company_name,
                    recruiterCompanyDescription: recruiterProfile.company_description_oneliner,
                    jobPositionName: whatappUpdateMessageObj?.candidateProfile?.jobs?.name,
                    jobLocation: whatappUpdateMessageObj?.candidateProfile?.jobs?.jobLocation
                }
                this.sendWhatsappTemplateMessage(sendTemplateMessageObj);
            }
            else{
                console.log("This is the standard message to send fromL", recruiterProfile.phone)
                console.log("This is the standard message to send to phone:", whatappUpdateMessageObj.phoneNumberTo);
    
                const sendTextMessageObj = {
                    phoneNumberFrom: recruiterProfile.phone,
                    phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
                    text: whatappUpdateMessageObj.messages[0].content,
                };
                this.sendWhatsappTextMessage(sendTextMessageObj);
            }
    
    
        }
        console.log("This is the candidate profile", whatappUpdateMessageObj?.candidateProfile)
    
    }
    
    
    

}
