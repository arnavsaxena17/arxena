import { exec } from 'child_process';
import fs, { createReadStream } from 'fs';
import path from 'path';

import axios, { ResponseType } from 'axios';
import FormData from 'form-data';
import {
  AttachmentMessageObject,
  CandidateNode,
  ChatControlsObjType,
  ChatHistoryItem,
  ChatRequestBody,
  FacebookWhatsappAttachmentChatRequestBody,
  Jobs,
  PersonNode,
  sendWhatsappTemplateMessageObjectType,
  SendWhatsappUtilityMessageObjectType,
  whatappUpdateMessageObjType,
  WhatsappMessageType,
} from 'twenty-shared';

import { ChatControls } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/chat-controls';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import {
  getContentTypeFromFileName,
  getTranscriptionFromWhisper,
} from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { AttachmentProcessingService } from 'src/engine/core-modules/arx-chat/utils/attachment-processes';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { WhatsappTemplateMessages } from './whatsapp-template-messages';

export class FacebookWhatsappChatApi {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async getWhatsappConfig(
    workspaceQueryService: WorkspaceQueryService,
    configType: WhatsappMessageType,
    apiToken: string,
  ) {
    const workspaceId =
      await workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const whatsappAPIToken = await workspaceQueryService.getWorkspaceApiKey(
      workspaceId,
      'facebook_whatsapp_api_token',
    );
    const phoneNumberId = await workspaceQueryService.getWorkspaceApiKey(
      workspaceId,
      'facebook_whatsapp_phone_number_id',
    );

    return {
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/v18.0/${phoneNumberId}/${configType}`,
      headers: {
        Authorization: `Bearer ${whatsappAPIToken}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async getGraphApiConfig(apiToken: string, filePath: string) {
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const whatsappAPIToken =
      await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'facebook_whatsapp_api_token',
      );
    const phoneNumberId = await this.workspaceQueryService.getWorkspaceApiKey(
      workspaceId,
      'facebook_whatsapp_phone_number_id',
    );
    const fileName = path.basename(filePath);
    const contentType = await getContentTypeFromFileName(fileName);
    const formData = new FormData();

    formData.append('file', createReadStream(filePath), {
      contentType,
      filename: fileName,
    });
    formData.append('messaging_product', 'whatsapp');

    return {
      url: `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
      headers: {
        Authorization: `Bearer ${whatsappAPIToken}`,
        ...formData.getHeaders(),
      },
      formData,
    };
  }

  async uploadAndSendFileToWhatsApp(
    attachmentMessage: AttachmentMessageObject,
    candidateJob: Jobs,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log('Send file');
    console.log('sendFileObj::y::', attachmentMessage);
    const filePath = attachmentMessage?.fileData?.filePath;
    const phoneNumberTo = attachmentMessage?.phoneNumberTo;
    const attachmentText = 'Sharing the JD';
    const response = await this.uploadFileToWhatsApp(
      attachmentMessage,
      candidateJob,
      chatControl,
      apiToken,
    );
    const mediaID = response?.mediaID;
    const fileName = attachmentMessage?.fileData?.fileName;
    const sendTextMessageObj = {
      phoneNumberFrom: '918411937769',
      attachmentText: attachmentText,
      phoneNumberTo: phoneNumberTo ?? '918411937769',
      mediaFileName: fileName ?? 'AttachmentFile',
      mediaID: mediaID,
    };
    const personObj = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(phoneNumberTo, apiToken);
    const mostRecentMessageArr: ChatHistoryItem[] =
      personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node
        ?.messageObj;

    mostRecentMessageArr.push({ role: 'user', content: 'Sharing the JD' });
    console.log('sednTextMessageObj::', sendTextMessageObj);
    this.sendWhatsappAttachmentMessage(
      sendTextMessageObj,
      personObj,
      candidateJob,
      mostRecentMessageArr,
      chatControl,
      filePath,
      apiToken,
    );
  }

  async sendWhatsappTextMessage(
    sendTextMessageObj: ChatRequestBody,
    apiToken: string,
  ) {
    const configType: WhatsappMessageType = 'messages';
    const baseConfig = await this.getWhatsappConfig(
      this.workspaceQueryService,
      configType,
      apiToken,
    );
    const config = {
      ...baseConfig,
      data: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sendTextMessageObj.phoneNumberTo.replace('+', ''),
        type: 'text',
        text: { preview_url: false, body: sendTextMessageObj.messages },
      },
    };
    const response = await axios.request(config);

    console.log('Status on sending that whatsaapp message::', response?.status);

    return response;
  }

  async uploadFileToWhatsApp(
    attachmentMessage: AttachmentMessageObject,
    candidateJob: Jobs,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log('This is the upload file to whatsapp in arx chat');

    try {
      const filePath = attachmentMessage?.fileData?.filePath.slice();
      const fileName = path.basename(filePath);
      const contentType = await getContentTypeFromFileName(fileName);

      console.log(
        'This is the content type in upload file to whatsapp:',
        contentType,
      );
      console.log(
        'This is the file name in upload file to whatsapp:',
        fileName,
      );
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

        console.log(
          'This is the process.env.SERVER_BASE_URL:',
          process.env.SERVER_BASE_URL,
        );
        response = await axios.post(
          process.env.SERVER_BASE_URL + '/whatsapp-controller/uploadFile',
          { filePath: filePath },
          { headers: { Authorization: `Bearer ${apiToken}` } },
        );
        console.log(
          'This is the response data in upload file to whatsapp:',
          response.data,
        );
        if (!response?.data?.mediaID) {
          console.error(
            'Failed to upload JD to WhatsApp. Retrying it again...',
          );
          response = await axios.post(
            process.env.SERVER_BASE_URL + '/whatsapp-controller/uploadFile',
            { filePath: filePath },
            { headers: { Authorization: `Bearer ${apiToken}` } },
          );
          if (!response?.data?.mediaID) {
            console.error(
              'Failed to upload JD to WhatsApp the second time. Bad luck! :(',
            );
            const phoneNumberTo = attachmentMessage?.phoneNumberTo;
            const personObj = await new FilterCandidates(
              this.workspaceQueryService,
            ).getPersonDetailsByPhoneNumber(phoneNumberTo, apiToken);
            const mostRecentMessageArr: ChatHistoryItem[] =
              personObj?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]
                ?.node?.messageObj;

            mostRecentMessageArr.push({
              role: 'user',
              content: 'Failed to send JD to the candidate.',
            });
            const candidateNode = personObj?.candidates?.edges?.find(
              (edge) => edge.node.jobs.id == candidateJob.id,
            )?.node;

            if (!candidateNode) {
              console.log(
                'Candidate node not found, cannot proceed with sending the message',
              );

              return;
            }
            const whatappUpdateMessageObj: whatappUpdateMessageObjType =
              await new FilterCandidates(
                this.workspaceQueryService,
              ).updateChatHistoryObjCreateWhatsappMessageObj(
                'failed',
                personObj,
                candidateNode,
                mostRecentMessageArr,
                chatControl,
                apiToken,
              );

            await new UpdateChat(
              this.workspaceQueryService,
            ).updateCandidateEngagementDataInTable(
              whatappUpdateMessageObj,
              apiToken,
            );
          }
        }
        console.log('media ID', response?.data?.mediaID);
        console.log('Request successful');
        console.log('****Response data********????:', response.data);
        console.log('media ID', response?.data?.mediaID);
        console.log('Request successful');

        return {
          mediaID: response?.data?.mediaID,
          status: 'success',
          fileName: fileName,
          contentType: contentType,
        };
      } catch (err) {
        console.error('Errir heree', response?.data);
        console.error('upload', err.toJSON());
        console.log(err.data);
      }
    } catch (error) {
      console.log('Error uploadFileToWhatsApp file from WhatsApp:', error);
    }
  }

  async uploadFileToWhatsAppUsingControllerApi(
    filePathArg: string,
    apiToken: string,
  ) {
    try {
      console.log('Upload file using controller api');
      const configType: WhatsappMessageType = 'media';

      const filePath = filePathArg.slice();
      const baseConfig = await this.getGraphApiConfig(apiToken, filePath);
      const fileName = path.basename(filePath);
      const contentType = await getContentTypeFromFileName(fileName);

      const formData = new FormData();

      formData.append('file', createReadStream(filePath), {
        contentType,
        filename: fileName,
      });
      formData.append('messaging_product', 'whatsapp');

      const config = {
        ...baseConfig,
        headers: {
          ...baseConfig.headers,
          ...formData.getHeaders(),
        },
      };
      const {
        data: { id: mediaId },
      } = await axios.post(config.url, formData, config);

      return {
        mediaID: mediaId,
        status: 'success',
        fileName,
        contentType,
      };
    } catch (error) {
      console.log(
        'Error downloading file from WhatsApp Controller API:',
        error,
      );
    }
  }

  async sendWhatsappAttachmentMessage(
    sendWhatsappAttachmentTextMessageObj: FacebookWhatsappAttachmentChatRequestBody,
    personObj: PersonNode,
    candidateJob: Jobs,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    filePath: string,
    apiToken: string,
  ) {
    const configType: WhatsappMessageType = 'messages'; // Changed from 'media' to 'messages'

    const baseConfig = await this.getWhatsappConfig(
      this.workspaceQueryService,
      configType,
      apiToken,
    ); // Use getWhatsappConfig instead
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
          filename:
            sendWhatsappAttachmentTextMessageObj.mediaFileName || 'attachment',
        },
      },
    };

    console.log('This is the config for sending attachment message:', config);

    try {
      const response = await axios.request(config);
      const wamId = response?.data?.messages[0]?.id;
      const candidateNode = personObj?.candidates?.edges?.find(
        (edge) => edge.node.jobs.id == candidateJob.id,
      )?.node;

      if (!candidateNode) {
        console.log(
          'Candidate node not found, cannot proceed with sending the message',
        );

        return;
      }
      const whatappUpdateMessageObj = await new FilterCandidates(
        this.workspaceQueryService,
      ).updateChatHistoryObjCreateWhatsappMessageObj(
        wamId,
        personObj,
        candidateNode,
        mostRecentMessageArr,
        chatControl,
        apiToken,
      );

      if (whatappUpdateMessageObj) {
        await new UpdateChat(
          this.workspaceQueryService,
        ).updateCandidateEngagementDataInTable(
          whatappUpdateMessageObj,
          apiToken,
        );
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendWhatsappTemplateMessage(
    sendTemplateMessageObj: sendWhatsappTemplateMessageObjectType,
    apiToken: string,
  ) {
    const configType: WhatsappMessageType = 'messages';
    const baseConfig = await this.getWhatsappConfig(
      this.workspaceQueryService,
      configType,
      apiToken,
    );

    const templateMessage =
      new WhatsappTemplateMessages().getTemplateMessageObj(
        sendTemplateMessageObj,
      );

    const config = {
      ...baseConfig,
      data: templateMessage,
    };

    try {
      const response = await axios.request(config);

      if (response?.data?.messages[0]?.message_status === 'accepted') {
        return response?.data;
      }
    } catch (error) {
      console.log('\nWhatsApp API Error Summary:');
      console.log('Error Message:', error.message);
      console.log(
        '\nRequest Data:',
        JSON.stringify(error.config.data, null, 2),
      );
      console.log('\nRequest Parameters:', {
        url: error.config.url,
        method: error.config.method,
        auth: error.config.headers.Authorization.substring(0, 20) + '...',
      });
      if (error.response) {
        console.log('\nResponse:', {
          status: error.response.status,
          data: error.response.data,
        });
      }
    }
  }

  async sendWhatsappUtilityMessage(
    sendUtilityMessageObj: SendWhatsappUtilityMessageObjectType,
    apiToken: string,
  ) {
    const configType: WhatsappMessageType = 'messages';

    const baseConfig = await this.getWhatsappConfig(
      this.workspaceQueryService,
      configType,
      apiToken,
    );
    const utilityMessage =
      new WhatsappTemplateMessages().getUpdatedUtilityMessageObj(
        sendUtilityMessageObj,
      );

    const config = {
      ...baseConfig,
      data: utilityMessage,
    };

    try {
      const response = await axios.request(config);

      if (response?.data?.messages[0]?.message_status === 'accepted') {
        console.log(
          'Message to facebook is accepted (utility message',
          response?.data,
        );

        return response?.data;
      }
    } catch (error) {
      console.log('\nWhatsApp API Error:', {
        message: error.message,
        requestData: JSON.stringify(error.config.data, null, 2),
        params: {
          url: error.config.url,
          method: error.config.method,
          auth: error.config.headers.Authorization.substring(0, 20) + '...',
        },
        response: error.response && {
          status: error.response.status,
          data: error.response.data,
        },
      });
    }
  }

  async downloadWhatsappAttachmentMessage(
    sendTemplateMessageObj: {
      filename: string;
      mime_type: string;
      documentId: string;
    },
    candidateProfileData: CandidateNode,
    apiToken: string,
  ) {
    const configType: WhatsappMessageType = 'media';

    const baseConfig = await this.getWhatsappConfig(
      this.workspaceQueryService,
      configType,
      apiToken,
    );
    const getDocumentConfig = {
      ...baseConfig,
      method: 'get',
      url: `https://graph.facebook.com/v18.0/${sendTemplateMessageObj.documentId}`,
      responseType: 'json' as ResponseType,
    };

    const response = await axios.request(getDocumentConfig);
    const downloadConfig = {
      ...getDocumentConfig,
      url: response.data.url,
      responseType: 'stream' as ResponseType,
    };

    const fileDownloadResponse = await axios.request(downloadConfig);
    const filePath = `${process.cwd()}/${sendTemplateMessageObj.filename}`;
    const writeStream = fs.createWriteStream(filePath);

    fileDownloadResponse.data.pipe(writeStream);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', async () => {
        try {
          const attachmentObj =
            await new AttachmentProcessingService().uploadAttachmentToTwenty(
              filePath,
              apiToken,
            );

          await new AttachmentProcessingService().createOneAttachmentFromFilePath(
            {
              input: {
                authorId: candidateProfileData.jobs.recruiterId,
                name: filePath.replace(`${process.cwd()}/`, ''),
                fullPath: attachmentObj?.data?.uploadFile,
                type: 'TextDocument',
                candidateId: candidateProfileData.id,
              },
            },
            apiToken,
          );
          resolve(null);
        } catch (error) {
          reject(error);
        }
      });
      writeStream.on('error', reject);
    });
  }

  async getWhatsappTemplates(apiToken: string) {
    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const whatsappAPIToken =
        await this.workspaceQueryService.getWorkspaceApiKey(
          workspaceId,
          'facebook_whatsapp_api_token',
        );
      console.log('whatsappAPIToken', whatsappAPIToken);
      const phoneNumberId = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'facebook_whatsapp_phone_number_id',
      );
      console.log('phoneNumberId', phoneNumberId);
      const facebookWhatsappAssetId =
        (await this.workspaceQueryService.getWorkspaceApiKey(
          workspaceId,
          'facebook_whatsapp_asset_id',
        )) || '201570686381881';

      const config = {
        method: 'get',
        url: `https://graph.facebook.com/v21.0/${facebookWhatsappAssetId}/message_templates`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whatsappAPIToken}`,
        },
      };
      // Use a Map to track unique templates by ID
      const templatesMap = new Map();
      let nextPageUrl = config.url;

      while (nextPageUrl) {
        const response = await axios.get(nextPageUrl, {
          headers: config.headers,
        });

        // Add only UTILITY templates to map using ID as key to automatically deduplicate
        response.data.data.forEach((template) => {
          if (template.category === 'UTILITY') {
            templatesMap.set(template.name, template);
          }
        });
        nextPageUrl = response.data.paging?.next || null;
      }
      // Convert map values back to array
      const uniqueTemplates = Array.from(templatesMap.values());

      return uniqueTemplates;
    } catch (error) {
      const errorResponse = {
        status: error.response?.status,
        message: error.message,
        details: error.response?.data,
      };

      console.error('Error fetching WhatsApp templates:', errorResponse);
    }
  }

  async sendWhatsappMessageVIAFacebookAPI(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    personNode: PersonNode,
    candidateJob: Jobs,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    try {
      console.log('Sending message to whatsapp via facebook api', {
        messageType: whatappUpdateMessageObj.messageType,
        chatControls: chatControl,
      });

      if (whatappUpdateMessageObj?.messageType === 'botMessage') {
        console.log(
          'TEmplate Message or Text Message depends on :',
          whatappUpdateMessageObj?.messages[0]?.content,
        );
        const response: any = await new ChatControls(
          this.workspaceQueryService,
        ).runChatControlMessageSending(
          whatappUpdateMessageObj,
          candidateJob,
          chatControl,
          personNode,
          apiToken,
        );
        const candidateNode = personNode?.candidates?.edges?.find(
          (edge) => edge.node.jobs.id == candidateJob.id,
        )?.node;

        if (!candidateNode) {
          console.log(
            'Candidate node not found, cannot proceed with sending the message',
          );

          return;
        }

        const whatappUpdateMessageObjAfterWAMidUpdate =
          await new FilterCandidates(
            this.workspaceQueryService,
          ).updateChatHistoryObjCreateWhatsappMessageObj(
            response?.data?.messages[0]?.id || response.messages[0].id,
            personNode,
            candidateNode,
            mostRecentMessageArr,
            chatControl,
            apiToken,
          );

        await new UpdateChat(
          this.workspaceQueryService,
        ).updateCandidateEngagementDataInTable(
          whatappUpdateMessageObjAfterWAMidUpdate,
          apiToken,
        );
      } else {
        console.log('passing a human message so, going to trash it');
      }
    } catch (error) {
      console.log('Error sending message to WhatsApp via Facebook API:', error);
    }
  }

  async handleAudioMessage(
    audioMessageObject: {
      filename: string;
      mime_type: string;
      audioId: string;
    },
    candidateProfileData: CandidateNode,
    apiToken: string,
  ) {
    const configType: WhatsappMessageType = 'media';

    const baseConfig = await this.getWhatsappConfig(
      this.workspaceQueryService,
      configType,
      apiToken,
    );
    const audioConfig = {
      ...baseConfig,
      method: 'get',
      url: `https://graph.facebook.com/v18.0/${audioMessageObject.audioId}`,
      responseType: 'json' as ResponseType,
    };

    const audioDir = `${process.cwd()}/.voice-messages/${candidateProfileData.id}`;

    await fs.promises.mkdir(audioDir, { recursive: true });
    const filePath = `${audioDir}/${audioMessageObject.filename}`;

    try {
      const response = await axios.request(audioConfig);

      await new Promise<void>((resolve, reject) => {
        exec(
          `curl --location '${response.data.url}' --header 'Authorization: Bearer ${baseConfig.headers.Authorization}' --output ${filePath}`,
          (error, stdout) => {
            error ? reject(error) : resolve();
          },
        );
      });

      const attachmentObj =
        await new AttachmentProcessingService().uploadAttachmentToTwenty(
          filePath,
          apiToken,
        );
      const audioTranscriptionText =
        await getTranscriptionFromWhisper(filePath);

      return {
        databaseFilePath: attachmentObj?.data?.uploadFile,
        audioTranscriptionText,
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      throw error;
    }
  }
}
