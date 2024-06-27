// import { ChatRequestBody, candidateChatMessageType, recruiterProfile, sendWhatsappTemplateMessageObjectType } from "../../../services/data-model-objects";
// import {UpdateChat} from '../candidateEngagement/updateChat';
// import  CandidateEngagement  from "../../../services/candidateEngagement/checkCandidateEngagement";
import * as allDataObjects from "../../../services/data-model-objects";
// import { promisify } from 'util';
// import { response } from 'express';
import fs from "fs";
import path from "path";
// const mimePromise = import('mime');

// const phoneNumberIDs = {
//     "14155793982": "228382133694523",
//     "918591724917": "213381881866663"
// }
const FormData = require("form-data");
import { createReadStream, createWriteStream } from "fs";
import { getContentTypeFromFileName } from "../../../utils/arx-chat-agent-utils";
import { AttachmentProcessingService } from "../../../services/candidate-engagement/attachment-processing";
import CandidateEngagement from "../../../services/candidate-engagement/check-candidate-engagement";
import CandidateEngagementArx from "../../../services/candidate-engagement/check-candidate-engagement";
// import { lookup } from 'mime';
// const mime = require('mime');
const axios = require("axios");
import { getTranscriptionFromWhisper } from "../../../utils/arx-chat-agent-utils";
const { exec } = require("child_process");

let whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API;

if (process.env.FACEBOOK_WHATSAPP_PERMANENT_API) {
  whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_PERMANENT_API;
} else {
  whatsappAPIToken = process.env.FACEBOOK_WHATSAPP_API_TOKEN;
}

const templates = ["hello_world", "recruitment"];
export class FacebookWhatsappChatApi {
  async uploadAndSendFileToWhatsApp(
    attachmentMessage: allDataObjects.AttachmentMessageObject
  ) {
    console.log("Send file");
    console.log("sendFileObj::y::", attachmentMessage);
    const filePath = attachmentMessage?.fileData?.filePath;
    const phoneNumberTo = attachmentMessage?.phoneNumberTo;
    const attachmentText = "Sharing the JD";
    const response = await new FacebookWhatsappChatApi().uploadFileToWhatsApp(
      attachmentMessage
    );
    const mediaID = response?.mediaID;
    const fileName = attachmentMessage?.fileData?.fileName;
    const sendTextMessageObj = {
      phoneNumberFrom: "918411937769",
      attachmentText: attachmentText,
      phoneNumberTo: phoneNumberTo ?? "918411937769",
      mediaFileName: fileName ?? "AttachmentFile",
      mediaID: mediaID,
    };
    new FacebookWhatsappChatApi().sendWhatsappAttachmentMessage(
      sendTextMessageObj
    );
  }
  getTemplateMessageObj(
    sendTemplateMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType
  ) {
    const templateMessageObj = JSON.stringify({
      messaging_product: "whatsapp",
      to: sendTemplateMessageObj.recipient,
      type: "template",
      template: {
        name: sendTemplateMessageObj.template_name,
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: sendTemplateMessageObj.candidateFirstName,
              },
              {
                type: "text",
                text: sendTemplateMessageObj.recruiterName,
              },
              {
                type: "text",
                text: sendTemplateMessageObj.recruiterJobTitle,
              },
              {
                type: "text",
                text: sendTemplateMessageObj.recruiterCompanyName,
              },
              {
                type: "text",
                text: sendTemplateMessageObj.recruiterCompanyDescription,
              },
              {
                type: "text",
                text: sendTemplateMessageObj.jobPositionName,
              },
              {
                type: "text",
                text: sendTemplateMessageObj.jobLocation,
              },
            ],
          },
        ],
      },
    });
    // console.log("This is the template message object created:", templateMessageObj)
    return templateMessageObj;
  }
  async sendWhatsappTextMessage(
    sendTextMessageObj: allDataObjects.ChatRequestBody
  ) {
    console.log("Sending a message to ::", sendTextMessageObj.phoneNumberTo);
    console.log("Sending message text ::", sendTextMessageObj.messages);
    const text_message = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: sendTextMessageObj.phoneNumberTo,
      type: "text",
      text: { preview_url: false, body: sendTextMessageObj.messages },
    };
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url:
        "https://graph.facebook.com/v18.0/" +
        process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID +
        "/messages",
      headers: {
        Authorization: "Bearer " + whatsappAPIToken,
        "Content-Type": "application/json",
      },
      data: text_message,
    };
    // console.log("This is the config in sendWhatsappTextMessage:", config)

    const response = await axios.request(config);

    return response;
  }

  async fetchFileFromTwentyGetLocalPath() {
    const fileUrl =
      "http://localhost:3000/files/attachment/2604e253-36e3-4e87-9638-bdbb661a0547.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHBpcmF0aW9uX2RhdGUiOiIyMDI0LTA1LTI3VDEwOjE3OjM5Ljk2MFoiLCJhdHRhY2htZW50X2lkIjoiZjIwYjE5YzUtZDAwYy00NzBjLWI5YjAtNzY2MTgwOTdhZjkyIiwiaWF0IjoxNzE2NzE4NjU5LCJleHAiOjE3MTY4OTg2NTl9.NP6CvbDKTh3W0T0uP0JKUfnV_PmN6rIz6FanK7Hp_us";
    const response = await axios.get(fileUrl, { responseType: "stream" });
    console.log("Response status received:", response.status);
    console.log("Response.data:", response.data);
    // console.log("Response.data stringified:", JSON.stringify(response))

    const fileName =
      response.headers["content-disposition"]
        ?.split("filename=")[1]
        ?.trim()
        .replace(/"/g, "") ?? "file.pdf";
    console.log("FileName:", fileName);

    const currentDir = process.cwd();
    const filePath = path.resolve(currentDir, fileName);
    console.log("This is the file path:", filePath);

    const writeStream = createWriteStream(filePath);
    response.data.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    console.log("response.headers['']:", response.headers);
    console.log(
      "response.headers['content-type']:",
      response.headers["content-type"]
    );

    const contentType = response.headers["content-type"] || "application/pdf";
    return { filePath, fileName, contentType };
  }

  async uploadFileToWhatsApp(
    attachmentMessage: allDataObjects.AttachmentMessageObject
  ) {
    console.log("This is the upload file to whatsapp in arx chat");

    try {
      // const filePath = '/Users/arnavsaxena/Downloads/CVs-Mx/Prabhakar_Azad_Resume_05122022.doc';
      // Get the file name
      const filePath = attachmentMessage?.fileData?.filePath.slice();

      const fileName = path.basename(filePath);
      // Get the content type
      // const contentType = mime.lookup(fileName) || 'application/octet-stream';
      // const fileData = await fileTypeFromFile(filePath)
      // const contentType = fileData?.mime || 'application/octet-stream';
      const contentType = await getContentTypeFromFileName(fileName);
      console.log("This is the content type:", contentType);
      console.log("This is the file name:", fileName);

      const fileData = createReadStream(filePath);

      const formData = new FormData();
      formData.append("file", fileData, {
        contentType: contentType,
        filename: fileName,
      });

      formData.append("messaging_product", "whatsapp");
      let response;
      try {
        // response = await axios.post(
        //   `https://graph.facebook.com/v19.0/${process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID}/media`,
        //   formData,
        //   {
        //     headers: {
        //       Authorization: `Bearer ${whatsappAPIToken}`,
        //       ...formData.getHeaders(),
        //     },
        //   }
        // );

        const response = await axios.post(
          "http://localhost:3000/whatsapp-test/uploadFile",
          { filePath: filePath }
        );
        console.log("media ID", response?.data?.mediaID);
        console.log("Request successful");

        console.log("****Response data********????:", response.data);
        console.log("media ID", response?.data?.id);
        console.log("Request successful");
        return {
          mediaID: response?.data?.mediaID,
          status: "success",
          fileName: fileName,
          contentType: contentType,
        };
      } catch (err) {
        console.error("Errir heree", response?.data);
        console.error("upload", err.toJSON());
        console.log(err.data);
      }
      // Remove the local file
      // const unlink = promisify(fs.unlink);
      // await unlink(filePath);
    } catch (error) {
      console.error("Error downloading file from WhatsApp:", error);
      throw error;
    }
    // Get the file name and content type from the response headers
  }

  async sendWhatsappAttachmentMessage(
    sendWhatsappAttachmentTextMessageObj: allDataObjects.FacebookWhatsappAttachmentChatRequestBody
  ) {
    console.log("sending whatsapp attachment message");
    const text_message = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: sendWhatsappAttachmentTextMessageObj.phoneNumberTo,
      type: "document",
      document: {
        id: sendWhatsappAttachmentTextMessageObj.mediaID,
        caption: sendWhatsappAttachmentTextMessageObj.attachmentText,
        filename: sendWhatsappAttachmentTextMessageObj.mediaFileName
          ? sendWhatsappAttachmentTextMessageObj.mediaFileName
          : "attachment",
      },
    };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url:
        "https://graph.facebook.com/v18.0/" +
        process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID +
        "/messages",
      headers: {
        Authorization: "Bearer " + whatsappAPIToken,
        "Content-Type": "application/json",
      },
      data: text_message,
    };
    //   console.log("This is the config in sendWhatsappAttachmentMessage:", config)

    try {
      const response = await axios.request(config);
      console.log(
        "Rehis is response data after sendAttachment is called",
        JSON.stringify(response.data)
      );
    } catch (error) {
      console.log(error);
    }
  }

  async sendWhatsappTemplateMessage(
    sendTemplateMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType
  ) {
    console.log(
      "Received this template message object:",
      sendTemplateMessageObj
    );
    let templateMessage = this.getTemplateMessageObj(sendTemplateMessageObj);
    console.log("This is the template message object:", templateMessage);
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url:
        "https://graph.facebook.com/v18.0/" +
        process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID +
        "/messages",
      headers: {
        Authorization: "Bearer " + whatsappAPIToken,
        "Content-Type": "application/json",
      },
      data: templateMessage,
    };
    // console.log("This is the config in sendWhatsappTemplateMessage:", config);
    try {
      const response = await axios.request(config);
      // console.log("This is the response:", response)
      // console.log("This is the response data:", response.data)
      if (response?.data?.messages[0]?.message_status === "accepted") {
        console.log(
          "Message sent successfully and accepted by FACEBOOK API with id::",
          response?.data?.messages[0]?.id
        );
        return response?.data;
        // wamid.HBgMOTE4NDExOTM3NzY5FQIAERgSNjI0NkM1RjlCNzBGMEE5MjY5AA
      }
      console.log("This is the message sent successfully");
    } catch (error) {
      console.log(
        "This is error in facebook graph api when sending messaging template::",
        error
      );
    }
  }

  async downloadWhatsappAttachmentMessage(
    sendTemplateMessageObj: {
      filename: string;
      mime_type: string;
      documentId: string;
    },
    candidateProfileData: allDataObjects.CandidateNode
  ) {
    const constCandidateProfileData = candidateProfileData;
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url:
        "https://graph.facebook.com/v18.0/" + sendTemplateMessageObj.documentId,
      headers: {
        Authorization: "Bearer " + whatsappAPIToken,
        "Content-Type": "application/json",
      },
      responseType: "json",
    };
    // console.log("This is the config in downloadWhatsappAttachmentMessage", config);
    const response = await axios.request(config);
    const url = response.data.url;
    config.url = url;
    config.responseType = "stream";
    const fileDownloadResponse = await axios.request(config);
    console.log("This is the response: bpdy", response.body);
    const fileName = sendTemplateMessageObj.filename; // Set the desired file name
    const filePath = `${process.cwd()}/${fileName}`;
    const writeStream = fs.createWriteStream(filePath);
    fileDownloadResponse.data.pipe(writeStream); // Pipe response stream to file stream
    writeStream.on("finish", async () => {
      console.log("File saved successfully at", filePath);
      const attachmentObj =
        await new AttachmentProcessingService().uploadAttachmentToTwenty(
          filePath
        );
      console.log(attachmentObj);
      // debugger
      // attachmentObj.uploadFile
      // candidateProfileData.id
      const dataToUploadInAttachmentTable = {
        input: {
          authorId: candidateProfileData.jobs.recruiterId,
          name: filePath.replace(`${process.cwd()}/`, ""),
          fullPath: attachmentObj.data.uploadFile,
          type: "TextDocument",
          candidateId: constCandidateProfileData.id,
        },
      };
      await new AttachmentProcessingService().createOneAttachmentFromFilePath(
        dataToUploadInAttachmentTable
      );
    });
    writeStream.on("error", (error) => {
      console.error("Error saving file:", error);
    });
  }
  async sendWhatsappMessageVIAFacebookAPI(
    whatappUpdateMessageObj: allDataObjects.candidateChatMessageType,
    personNode: allDataObjects.PersonNode,
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[]
  ) {
    console.log("Sending message to whatsapp via facebook api");
    console.log(
      "whatappUpdateMessageObj.messageType",
      whatappUpdateMessageObj.messageType
    );
    console.log(
      "whatappUpdateMessageObj.messageType whatappUpdateMessageObj.messages ",
      JSON.stringify(whatappUpdateMessageObj)
    );
    let response;

    if (whatappUpdateMessageObj.messageType === "botMessage") {
      if (
        whatappUpdateMessageObj.messages[0].content.includes(
          "a US Based Recruitment Company"
        ) ||
        whatappUpdateMessageObj.messages[0].content.includes("assist")
      ) {
        console.log(
          "This is the template api message to send in whatappUpdateMessageObj.phoneNumberFrom, ",
          whatappUpdateMessageObj.phoneNumberFrom
        );
        const sendTemplateMessageObj = {
          recipient: whatappUpdateMessageObj.phoneNumberTo.replace("+", ""),
          template_name: templates[1],
          candidateFirstName: whatappUpdateMessageObj.candidateFirstName,
          recruiterName: allDataObjects.recruiterProfile.name,
          recruiterJobTitle: allDataObjects.recruiterProfile.job_title,
          recruiterCompanyName:
            allDataObjects.recruiterProfile.job_company_name,
          recruiterCompanyDescription:
            allDataObjects.recruiterProfile.company_description_oneliner,
          jobPositionName:
            whatappUpdateMessageObj?.candidateProfile?.jobs?.name,
          jobLocation:
            whatappUpdateMessageObj?.candidateProfile?.jobs?.jobLocation,
        };
        response = await this.sendWhatsappTemplateMessage(
          sendTemplateMessageObj
        );
      } else {
        console.log(
          "This is the standard message to send fromL",
          allDataObjects.recruiterProfile.phone
        );
        console.log(
          "This is the standard message to send to phone:",
          whatappUpdateMessageObj.phoneNumberTo
        );

        const sendTextMessageObj: allDataObjects.ChatRequestBody = {
          phoneNumberFrom: allDataObjects.recruiterProfile.phone,
          phoneNumberTo: whatappUpdateMessageObj.phoneNumberTo,
          messages: whatappUpdateMessageObj.messages[0].content,
        };
        response = await this.sendWhatsappTextMessage(sendTextMessageObj);
      }
      // console.log(response);

      const whatappUpdateMessageObjAfterWAMidUpdate =
        await new CandidateEngagementArx().updateChatHistoryObjCreateWhatsappMessageObj(
          response?.data?.messages[0]?.id, // whatsapp message id
          // response,
          personNode,
          mostRecentMessageArr
        );
      await new CandidateEngagementArx().updateCandidateEngagementDataInTable(
        whatappUpdateMessageObjAfterWAMidUpdate
      );

      // update database here. You will personobjm candidate object.

      // response.messages[0].id
    } else {
      console.log("passing a human message so, going to trash it");
    }
  }

  async handleAudioMessage(
    audioMessageObject: {
      filename: string;
      mime_type: string;
      audioId: string;
    },
    candidateProfileData: allDataObjects.CandidateNode
  ) {
    let audioTranscriptionText;
    const constCandidateProfileData = candidateProfileData;
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: "https://graph.facebook.com/v18.0/" + audioMessageObject?.audioId,
      headers: {
        Authorization: "Bearer " + whatsappAPIToken,
        "Content-Type": "application/json",
      },
      responseType: "json",
    };

    await fs.promises.mkdir(
      process.cwd() + "/.voice-messages/" + candidateProfileData?.id,
      { recursive: true }
    );
    // console.log("This is the config in downloadWhatsappAttachmentMessage", config);
    const filePath = `${process.cwd()}/.voice-messages/${candidateProfileData?.id}/${audioMessageObject?.filename}`;
    let uploadFilePath = "";

    try {
      const response = await axios.request(config);
      const url = response.data.url;
      let fileSaved = false;

      await new Promise<void>((resolve, reject) => {
        exec(
          `curl --location '${url}' --header 'Authorization: Bearer ${whatsappAPIToken}' --output ${filePath}`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error executing curl: ${error}`);
              reject(error);
            } else {
              console.log("Curl output:", stdout);
              fileSaved = true;
              resolve();
            }
          }
        );
      });

      if (fileSaved) {
        console.log("File saved successfully at", filePath);
        try {
          // Check if file exists before uploading
          await fs.access(filePath, (err) => {
            console.log(err);
          });
          const attachmentObj =
            await new AttachmentProcessingService().uploadAttachmentToTwenty(
              filePath
            );
          console.log(attachmentObj);
          uploadFilePath = attachmentObj?.data?.uploadFile;
        } catch (uploadError) {
          console.error("Error during file upload:", uploadError);
        }
      } else {
        console.error("File was not saved.");
      }
    } catch (axiosError) {
      console.error("Error with axios request:", axiosError);
    }
    // debugger
    // attachmentObj.uploadFile
    // candidateProfileData.id

    // ------------------
    // const dataToUploadInAttachmentTable = {
    //   input: {
    //     authorId: candidateProfileData?.jobs?.recruiterId,
    //     name: filePath.replace(`${process.cwd()}/`, ""),
    //     fullPath: attachmentObj.data.uploadFile,
    //     type: "AudioFile",
    //     candidateId: constCandidateProfileData?.id,
    //   },
    // };
    //   debugger

    audioTranscriptionText = await getTranscriptionFromWhisper(filePath);

    // await new AttachmentProcessingService().createOneAttachmentFromFilePath(
    //   dataToUploadInAttachmentTable
    // );
    console.log(`DONEE`);
    // } else {
    //   throw new Error("File not saved");
    // }
    // config.url = url;
    // config.responseType = "stream";
    // const fileDownloadResponse = await axios.request(config);

    // console.log(fileDownloadResponse?.data);
    // // debugger
    // // console.log("This is the response:", response.data)
    // console.log("This is the response: bpdy", response.body);
    // const fileName = audioMessageObject?.filename; // Set the desired file name
    // const filePath = `${process.cwd()}/${fileName}`;
    // const writeStream = fs.createWriteStream(filePath);
    // fileDownloadResponse.data.pipe(writeStream); // Pipe response stream to file stream

    // writeStream.on("finish", async () => {
    //   console.log("File saved successfully at", filePath);
    //   const attachmentObj =
    //     await new AttachmentProcessingService().uploadAttachmentToTwenty(
    //       filePath
    //     );
    //   console.log(attachmentObj);
    //   // debugger
    //   // attachmentObj.uploadFile
    //   // candidateProfileData.id
    //   const dataToUploadInAttachmentTable = {
    //     input: {
    //       authorId: candidateProfileData?.jobs?.recruiterId,
    //       name: filePath.replace(`${process.cwd()}/`, ""),
    //       fullPath: attachmentObj.data.uploadFile,
    //       type: "AudioFile",
    //       candidateId: constCandidateProfileData?.id,
    //     },
    //   };
    //   //   debugger

    //   audioTranscriptionText = await getTranscriptionFromWhisper(filePath);

    //   await new AttachmentProcessingService().createOneAttachmentFromFilePath(
    //     dataToUploadInAttachmentTable
    //   );
    // });
    // writeStream.on("error", (error) => {
    //   console.error("Error saving file:", error);
    // });
    console.log("Uploaded here", uploadFilePath);
    return {
      databaseFilePath: uploadFilePath,
      audioTranscriptionText: audioTranscriptionText,
    };
  }
}
