import * as allDataObjects from '../../../services/data-model-objects';
import fs from 'fs';
import path from 'path';
const FormData = require('form-data');
import { createReadStream } from 'fs';
import { getContentTypeFromFileName } from '../../../utils/arx-chat-agent-utils';
import { AttachmentProcessingService } from '../../../services/candidate-engagement/attachment-processing';
const axios = require('axios');
import { getTranscriptionFromWhisper } from '../../../utils/arx-chat-agent-utils';
import { WhatsappTemplateMessages } from './whatsapp-template-messages';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../candidate-engagement/update-chat';
const { exec } = require('child_process');
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../../candidate-engagement/filter-candidates';
import { Transformations } from '../../candidate-engagement/transformations';
import { ChatControls } from '../../candidate-engagement/chat-controls';

export class FacebookWhatsappChatApi {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}


  async getWhatsappConfig(workspaceQueryService: WorkspaceQueryService, apiToken: string) {
    const workspaceId = await workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const whatsappAPIToken = await workspaceQueryService.getWorkspaceApiKey(workspaceId, 'facebook_whatsapp_api_token');
    const phoneNumberId = await workspaceQueryService.getWorkspaceApiKey(workspaceId, 'facebook_whatsapp_phone_number_id');

    return {
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      headers: {
        Authorization: `Bearer ${whatsappAPIToken}`,
        'Content-Type': 'application/json'
      }
    };
  }

  async getGraphApiConfig(apiToken: string, filePath: string) {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const whatsappAPIToken = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'facebook_whatsapp_api_token');
    const phoneNumberId = await this.workspaceQueryService.getWorkspaceApiKey(workspaceId, 'facebook_whatsapp_phone_number_id');
    const fileName = path.basename(filePath);
    const contentType = await getContentTypeFromFileName(fileName);
    const formData = new FormData();
    formData.append('file', createReadStream(filePath), {
      contentType,
      filename: fileName
    });
    formData.append('messaging_product', 'whatsapp');
    return {
      url: `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
      headers: { 
        Authorization: `Bearer ${whatsappAPIToken}`,
        ...formData.getHeaders()
      },
      formData
    };
  }
    

  async uploadAndSendFileToWhatsApp(attachmentMessage: allDataObjects.AttachmentMessageObject,candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('Send file');
    console.log('sendFileObj::y::', attachmentMessage);
    const filePath = attachmentMessage?.fileData?.filePath;
    const phoneNumberTo = attachmentMessage?.phoneNumberTo;
    const attachmentText = 'Sharing the JD';
    const response = await this.uploadFileToWhatsApp(attachmentMessage, candidateJob, chatControl, apiToken);
    const mediaID = response?.mediaID;
    const fileName = attachmentMessage?.fileData?.fileName;
    const sendTextMessageObj = {
      phoneNumberFrom: '918411937769',
      attachmentText: attachmentText,
      phoneNumberTo: phoneNumberTo ?? '918411937769',
      mediaFileName: fileName ?? 'AttachmentFile',
      mediaID: mediaID,
    };
    const personObj = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(phoneNumberTo, apiToken);
    const candidate = personObj?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;

    const mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
    mostRecentMessageArr.push({ role: 'user', content: 'Sharing the JD' });
    this.sendWhatsappAttachmentMessage(sendTextMessageObj, personObj,candidateJob, mostRecentMessageArr, chatControl, apiToken);
  }

  async sendWhatsappTextMessage(sendTextMessageObj: allDataObjects.ChatRequestBody, apiToken: string) {
    const baseConfig = await this.getWhatsappConfig(this.workspaceQueryService, apiToken);
    const config = {
      ...baseConfig,
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual', 
        to: sendTextMessageObj.phoneNumberTo.replace('+', ''),
        type: 'text',
        text: { preview_url: false, body: sendTextMessageObj.messages }
      }
    };
    const response = await axios.request(config);
    console.log('Status on sending that whatsaapp message::', response?.status);
    return response;
  }


  async uploadFileToWhatsApp(attachmentMessage: allDataObjects.AttachmentMessageObject, candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    console.log('This is the upload file to whatsapp in arx chat');

    try {
      const filePath = attachmentMessage?.fileData?.filePath.slice();
      const fileName = path.basename(filePath);
      const contentType = await getContentTypeFromFileName(fileName);
      console.log('This is the content type in upload file to whatsapp:', contentType);
      console.log('This is the file name in upload file to whatsapp:', fileName);
      const fileData = createReadStream(filePath);
      const formData = new FormData();
      formData.append('file', fileData, {
        contentType: contentType,
        filename: fileName,
      });
      formData.append('messaging_product', 'whatsapp');
      let response;
      try {
        let response;
        console.log('This is the process.env.SERVER_BASE_URL:', process.env.SERVER_BASE_URL);
        response = await axios.post( process.env.SERVER_BASE_URL + '/whatsapp-controller/uploadFile', { filePath: filePath }, { headers: { Authorization: `Bearer ${apiToken}`, }, }, );
        console.log('This is the response data in upload file to whatsapp:', response.data);
        if (!response?.data?.mediaID) {
          console.error('Failed to upload JD to WhatsApp. Retrying it again...');
          response = await axios.post( process.env.SERVER_BASE_URL + '/whatsapp-controller/uploadFile', { filePath: filePath }, { headers: { Authorization: `Bearer ${apiToken}`, }, }, );
          if (!response?.data?.mediaID) {
            console.error('Failed to upload JD to WhatsApp the second time. Bad luck! :(');
            const phoneNumberTo = attachmentMessage?.phoneNumberTo;
            const personObj = await new FilterCandidates(this.workspaceQueryService).getPersonDetailsByPhoneNumber(phoneNumberTo, apiToken);
            const mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.messageObj;
            mostRecentMessageArr.push({ role: 'user', content: 'Failed to send JD to the candidate.' });
            const candidateNode = personObj?.candidates?.edges?.find(edge => edge.node.jobs.id == candidateJob.id)?.node;

            if (!candidateNode) {
              console.log('Candidate node not found, cannot proceed with sending the message');
              return;
            }
            const whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType = await new Transformations().updateChatHistoryObjCreateWhatsappMessageObj( 'failed', personObj,candidateNode, mostRecentMessageArr, chatControl );
            
            await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObj, candidateJob, apiToken);
          }
        }
        console.log('media ID', response?.data?.mediaID);
        console.log('Request successful');
        console.log('****Response data********????:', response.data);
        console.log('media ID', response?.data?.mediaID);
        console.log('Request successful');
        return { mediaID: response?.data?.mediaID, status: 'success', fileName: fileName, contentType: contentType };
      } catch (err) {
        console.error('Errir heree', response?.data);
        console.error('upload', err.toJSON());
        console.log(err.data);
      }
    } catch (error) {
      console.error('Error downloading file from WhatsApp:', error);
      throw error;
    }
  }

  async uploadFileToWhatsAppUsingControllerApi(filePathArg: string, apiToken: string) {
    try {
      const baseConfig = await this.getWhatsappConfig(this.workspaceQueryService, apiToken);
      const filePath = filePathArg.slice();
      const fileName = path.basename(filePath);
      const contentType = await getContentTypeFromFileName(fileName);
   
      const formData = new FormData();
      formData.append('file', createReadStream(filePath), {
        contentType,
        filename: fileName
      });
      formData.append('messaging_product', 'whatsapp');
   
      const config = {
        ...baseConfig,
        headers: {
          ...baseConfig.headers,
          ...formData.getHeaders()
        }
      };
   
      const { data: { id: mediaId } } = await axios.post(config.url, formData, config);
   
      return {
        mediaID: mediaId,
        status: 'success', 
        fileName,
        contentType
      };
   
    } catch (error) {
      console.error('Error downloading file from WhatsApp:', error);
      throw error;
    }
   }
   async sendWhatsappAttachmentMessage(
    sendWhatsappAttachmentTextMessageObj: allDataObjects.FacebookWhatsappAttachmentChatRequestBody,
    personObj: allDataObjects.PersonNode,
    candidateJob:allDataObjects.Jobs,
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    chatControl: allDataObjects.chatControls,
    apiToken: string,
   ) {
    const baseConfig = await this.getWhatsappConfig(this.workspaceQueryService, apiToken);
    const config = {
      ...baseConfig,
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sendWhatsappAttachmentTextMessageObj.phoneNumberTo,
        type: 'document',
        document: {
          id: sendWhatsappAttachmentTextMessageObj.mediaID,
          caption: sendWhatsappAttachmentTextMessageObj.attachmentText,
          filename: sendWhatsappAttachmentTextMessageObj.mediaFileName || 'attachment'
        }
      }
    };
   
    try {
      const response = await axios.request(config);
      const wamId = response?.data?.messages[0]?.id;
      const candidateNode = personObj?.candidates?.edges?.find(edge => edge.node.jobs.id == candidateJob.id)?.node;

      if (!candidateNode) {
        console.log('Candidate node not found, cannot proceed with sending the message');
        return;
      }
      const whatappUpdateMessageObj = await new Transformations().updateChatHistoryObjCreateWhatsappMessageObj(
        wamId,
        personObj,
        candidateNode,
        mostRecentMessageArr, 
        chatControl,
      );
      if (whatappUpdateMessageObj) {
        await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService)
          .updateCandidateEngagementDataInTable(whatappUpdateMessageObj, candidateJob, apiToken);
      }
        
    } catch (error) {
      console.log(error);
    }
   }

   async sendWhatsappTemplateMessage(sendTemplateMessageObj: allDataObjects.sendWhatsappTemplateMessageObjectType, apiToken: string) {
    const baseConfig = await this.getWhatsappConfig(this.workspaceQueryService, apiToken);
    const templateMessage = new WhatsappTemplateMessages().getTemplateMessageObj(sendTemplateMessageObj);
    
    const config = {
      ...baseConfig,
      data: templateMessage
    };
   
    try {
      const response = await axios.request(config);
      if (response?.data?.messages[0]?.message_status === 'accepted') {
        return response?.data;
      }
    } catch (error) {
      console.log('\nWhatsApp API Error Summary:');
      console.log('Error Message:', error.message);
      console.log('\nRequest Data:', JSON.stringify(error.config.data, null, 2));
      console.log('\nRequest Parameters:', {
        url: error.config.url,
        method: error.config.method,
        auth: error.config.headers.Authorization.substring(0, 20) + '...'
      });
      if (error.response) {
        console.log('\nResponse:', {
          status: error.response.status,
          data: error.response.data
        });
      }
    }
   }
   
   async sendWhatsappUtilityMessage(sendUtilityMessageObj: allDataObjects.sendWhatsappUtilityMessageObjectType, apiToken: string) {
    const baseConfig = await this.getWhatsappConfig(this.workspaceQueryService, apiToken);
    const utilityMessage = new WhatsappTemplateMessages().getUpdatedUtilityMessageObj(sendUtilityMessageObj);
    
    const config = {
      ...baseConfig,
      data: utilityMessage
    };
   
    try {
      const response = await axios.request(config);
      if (response?.data?.messages[0]?.message_status === 'accepted') {
        return response?.data;
      }
    } catch (error) {
      console.log('\nWhatsApp API Error:', {
        message: error.message,
        requestData: JSON.stringify(error.config.data, null, 2),
        params: {
          url: error.config.url,
          method: error.config.method,
          auth: error.config.headers.Authorization.substring(0, 20) + '...'
        },
        response: error.response && {
          status: error.response.status,
          data: error.response.data
        }
      });
    }
   }


   async downloadWhatsappAttachmentMessage(
    sendTemplateMessageObj: {
      filename: string;
      mime_type: string;
      documentId: string;
    },
    candidateProfileData: allDataObjects.CandidateNode,
    apiToken: string,
   ) {
    const baseConfig = await this.getWhatsappConfig(this.workspaceQueryService, apiToken);
    const getDocumentConfig = {
      ...baseConfig,
      method: 'get',
      url: `https://graph.facebook.com/v18.0/${sendTemplateMessageObj.documentId}`,
      responseType: 'json'
    };
   
    const response = await axios.request(getDocumentConfig);
    const downloadConfig = {
      ...getDocumentConfig,
      url: response.data.url,
      responseType: 'stream'
    };
   
    const fileDownloadResponse = await axios.request(downloadConfig);
    const filePath = `${process.cwd()}/${sendTemplateMessageObj.filename}`;
    const writeStream = fs.createWriteStream(filePath);
    fileDownloadResponse.data.pipe(writeStream);
   
    await new Promise((resolve, reject) => {
      writeStream.on('finish', async () => {
        try {
          const attachmentObj = await new AttachmentProcessingService().uploadAttachmentToTwenty(filePath, apiToken);
          await new AttachmentProcessingService().createOneAttachmentFromFilePath({
            input: {
              authorId: candidateProfileData.jobs.recruiterId,
              name: filePath.replace(`${process.cwd()}/`, ''),
              fullPath: attachmentObj?.data?.uploadFile,
              type: 'TextDocument',
              candidateId: candidateProfileData.id
            }
          }, apiToken);
          resolve(null);
        } catch (error) {
          reject(error); 
        }
      });
      writeStream.on('error', reject);
    });
   }
    
   async sendWhatsappMessageVIAFacebookAPI(
    whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType,
    personNode: allDataObjects.PersonNode,
    candidateJob: allDataObjects.Jobs,
    mostRecentMessageArr: allDataObjects.ChatHistoryItem[],
    chatControl: allDataObjects.chatControls,
    apiToken: string,
  ) {
    console.log('Sending message to whatsapp via facebook api', {
      messageType: whatappUpdateMessageObj.messageType,
      chatControls: chatControl,
    });
    if (whatappUpdateMessageObj.messages[0].content.includes('#DONTRESPOND#') || whatappUpdateMessageObj.messages[0].content.includes('DONTRESPOND') || whatappUpdateMessageObj.messages[0]?.content?.includes('DONOTRESPOND')) {
      console.log('Found a #DONTRESPOND# message in STAGE 2, so not sending any message');
      return;
    }
    
    if (whatappUpdateMessageObj?.messageType === 'botMessage') {
      console.log('TEmplate Message or Text Message depends on :', whatappUpdateMessageObj?.messages[0]?.content);
      const response:any = await new ChatControls(this.workspaceQueryService).runChatControlMessageSending(whatappUpdateMessageObj, chatControl, personNode, apiToken);
      const candidateNode = personNode?.candidates?.edges?.find(edge => edge.node.jobs.id == candidateJob.id)?.node;

      if (!candidateNode) {
        console.log('Candidate node not found, cannot proceed with sending the message');
        return;
      }
      const whatappUpdateMessageObjAfterWAMidUpdate = await new Transformations().updateChatHistoryObjCreateWhatsappMessageObj( response?.data?.messages[0]?.id || response.messages[0].id, personNode, candidateNode, mostRecentMessageArr, chatControl);
      await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObjAfterWAMidUpdate, candidateJob, apiToken);
    } else {
      console.log('passing a human message so, going to trash it');
    }
  }



  async handleAudioMessage(audioMessageObject: { 
    filename: string; 
    mime_type: string; 
    audioId: string 
    }, candidateProfileData: allDataObjects.CandidateNode, apiToken: string) {
    const baseConfig = await this.getWhatsappConfig(this.workspaceQueryService, apiToken);
    const audioConfig = {
      ...baseConfig,
      method: 'get',
      url: `https://graph.facebook.com/v18.0/${audioMessageObject.audioId}`,
      responseType: 'json'
    };
    
    const audioDir = `${process.cwd()}/.voice-messages/${candidateProfileData.id}`;
    await fs.promises.mkdir(audioDir, { recursive: true });
    const filePath = `${audioDir}/${audioMessageObject.filename}`;
    
    try {
      const response = await axios.request(audioConfig);
      await new Promise<void>((resolve, reject) => {
        exec(`curl --location '${response.data.url}' --header 'Authorization: Bearer ${baseConfig.headers.Authorization}' --output ${filePath}`, 
          (error, stdout) => {
            error ? reject(error) : resolve();
          });
      });
    
      const attachmentObj = await new AttachmentProcessingService().uploadAttachmentToTwenty(filePath, apiToken);
      const audioTranscriptionText = await getTranscriptionFromWhisper(filePath);
    
      return {
        databaseFilePath: attachmentObj?.data?.uploadFile,
        audioTranscriptionText
      };
    
    } catch (error) {
      console.error('Audio processing error:', error);
      throw error;
    }
    }
}