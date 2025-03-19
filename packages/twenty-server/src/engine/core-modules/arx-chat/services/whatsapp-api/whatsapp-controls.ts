import fs from 'fs';
import path from 'path';

import axios from 'axios';
import mime from 'mime-types';
import {
  Attachment,
  AttachmentMessageObject,
  ChatControlsObjType,
  ChatHistoryItem,
  Jobs,
  PersonNode,
  whatappUpdateMessageObjType,
} from 'twenty-shared';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { BaileysWhatsappAPI } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/baileys/callBaileys';
import { FacebookWhatsappChatApi } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// import { Transformations } from '../candidate-engagement/transformations';

export class WhatsappControls {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async sendWhatsappMessageToCandidate(
    messageText: string,
    personNode: PersonNode,
    candidateJob: Jobs,
    mostRecentMessageArr: ChatHistoryItem[],
    functionSource: string,
    chatControl: ChatControlsObjType,
    apiToken: string,
    isChatEnabled?: boolean,
  ) {
    try {
      console.log(
        'Called sendWhatsappMessage ToCandidate to send message via any whatsapp api::',
        functionSource,
        'message text::',
        messageText,
      );
      if (
        mostRecentMessageArr[0].role != 'system' &&
        mostRecentMessageArr.length == 1
      ) {
        console.log(
          'Found a single sneaky message which is coming out:: ',
          messageText,
        );

        return;
      }
      if (
        messageText.includes('#DONTRESPOND#') ||
        (messageText.includes('DONTRESPOND') && messageText)
      ) {
        console.log(
          'Found a #DONTRESPOND# message, so not sending any message',
        );

        return;
      }
      console.log(
        'Going to create whatsaappupdatemessage obj for message text::',
        messageText,
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

      const whatappUpdateMessageObj = await new FilterCandidates(
        this.workspaceQueryService,
      ).updateChatHistoryObjCreateWhatsappMessageObj(
        'sendWhatsappMessageToCandidateMulti',
        personNode,
        candidateNode,
        mostRecentMessageArr,
        chatControl,
        apiToken,
      );

      if (
        !whatappUpdateMessageObj ||
        whatappUpdateMessageObj.messages[0].content?.includes(
          '#DONTRESPOND#',
        ) ||
        (whatappUpdateMessageObj.messages[0].content?.includes('DONTRESPOND') &&
          whatappUpdateMessageObj.messages[0].content)
      ) {
        console.log(
          'Found a #DONTRESPOND# message, so not sending any message',
        );

        return;
      }

      if (
        (!messageText || messageText == '') &&
        (!whatappUpdateMessageObj.messages[0].content ||
          whatappUpdateMessageObj.messages[0].content == '')
      ) {
        console.log('Message text is empty, so not sending any message');
        console.log('Current messageText::', messageText);
        console.log(
          'Current whatappUpdateMessageObj.messages[0].content::',
          whatappUpdateMessageObj.messages[0].content,
        );

        return;
      }

      if (whatappUpdateMessageObj.messages[0].content || messageText) {
        if (
          process.env.WHATSAPP_ENABLED === 'true' &&
          (isChatEnabled === undefined || isChatEnabled)
        ) {
          await this.sendWhatsappMessage(
            whatappUpdateMessageObj,
            personNode,
            candidateJob,
            mostRecentMessageArr,
            chatControl,
            apiToken,
          );
        } else {
          console.log(
            'Whatsapp is not enabled, so not sending message:',
            whatappUpdateMessageObj.messages[0].content,
          );
        }
      }
    } catch (error) {
      console.log('Error in sendWhatsappMessageToCandidate:', error);
    }
  }

  async sendWhatsappMessage(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    personNode: PersonNode,
    candidateJob: Jobs,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    try {
      if (
        whatappUpdateMessageObj.messages[0].content.includes('#DONTRESPOND#') ||
        whatappUpdateMessageObj.messages[0].content.includes('DONTRESPOND') ||
        whatappUpdateMessageObj.messages[0]?.content?.includes('DONOTRESPOND')
      ) {
        console.log(
          'Found a #DONTRESPOND# message in STAGE 2, so not sending any message',
        );

        return;
      }
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

      let whatsapp_key: string | null = 'facebook';

      whatsapp_key = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'whatsapp_key',
      );

      if (whatsapp_key) {
        console.log('whatsapp_key::', whatsapp_key);
      } else {
        console.log('No valid whatsapp API selected');
      }

      if (whatsapp_key === 'facebook') {
        await new FacebookWhatsappChatApi(
          this.workspaceQueryService,
        ).sendWhatsappMessageVIAFacebookAPI(
          whatappUpdateMessageObj,
          personNode,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
      } else if (whatsapp_key === 'baileys') {
        await new BaileysWhatsappAPI(
          this.workspaceQueryService,
        ).sendWhatsappMessageVIABaileysAPI(
          whatappUpdateMessageObj,
          personNode,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
      } else if (whatsapp_key === 'ext-sock-whatsapp') {
        await new ExtSockWhatsappMessageProcessor(
          this.workspaceQueryService,
        ).sendWhatsappMessageVIAExtSockWhatsappAPI(
          whatappUpdateMessageObj,
          personNode,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
      } else {
        console.log('No valid whatsapp API selected');
      }
    } catch (error) {
      console.log('Error in sendWhatsappMessage:', error);
    }
  }

  async sendAttachmentMessageOnWhatsapp(
    attachmentMessage: AttachmentMessageObject,
    personNode: PersonNode,
    candidateJob: Jobs,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log(
      'attachmentMessage received to send attachment:',
      attachmentMessage,
    );

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    let whatsapp_key: string | null = 'facebook';

    whatsapp_key = await this.workspaceQueryService.getWorkspaceApiKey(
      workspaceId,
      'whatsapp_key',
    );

    // const workspace = await this.workspaceQueryService.getWorkspaceById(workspaceId);

    // const whatsappApi = workspace.whatsappApi;

    // if (whatsappApi === 'facebook') {

    if (whatsapp_key === 'facebook') {
      await new FacebookWhatsappChatApi(
        this.workspaceQueryService,
      ).uploadAndSendFileToWhatsApp(
        attachmentMessage,
        candidateJob,
        chatControl,
        apiToken,
      );
    } else if (whatsapp_key === 'ext-sock-whatsapp') {
      await this.sendAttachmentExtSockWhatsapp(
        attachmentMessage,
        personNode,
        candidateJob,
        chatControl,
        apiToken,
      );
    } else if (whatsapp_key === 'baileys') {
      await new BaileysWhatsappAPI(
        this.workspaceQueryService,
      ).sendAttachmentMessageViaBaileys(
        attachmentMessage,
        personNode,
        candidateJob,
        apiToken,
      );
    }
  }

  async sendJDViaWhatsapp(
    person: PersonNode,
    candidateJob: Jobs,
    attachment: Attachment,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    const fullPath = attachment?.fullPath;

    console.log('Full Path::', fullPath);
    const name = attachment?.name || 'attachment.pdf';

    console.log('This is attachment name:', name);
    const localFilePath =
      process.cwd() + '/.attachments' + `/${attachment?.jobId}/` + name;

    console.log('This is localFile Path:', localFilePath);
    // const fileUrl = `${baseUrl}` + '/files/' + fullPath;
    const fileUrl = fullPath;
    let fileData;

    try {
      if (!attachment) {
        console.log(
          'There is no attachment attached, cannot proceed with sending the JD to the candidate',
        );
      }
      console.log('path:', fullPath, 'name:', name, 'fileUrl:', fileUrl);
      console.log('localFilePath:', localFilePath);
      // Download and save the file locally
      fileData = await axios({
        url: fullPath,
        method: 'GET',
        responseType: 'arraybuffer',
      });
      if (!fileData?.data) {
        throw new Error('No data found in the file');
      }
      fs.mkdir(path.dirname(localFilePath), { recursive: true }, (err) => {
        if (err) {
          return console.error(err);
        }
        // Write the file
        fs.writeFile(localFilePath, fileData?.data, (err) => {
          if (err) {
            return console.error(err);
          }
          console.log('File has been saved!');
        });
      });
    } catch (error) {
      console.log('Error in downloading the file:', error);
    }
    const attachmentMessageObj: AttachmentMessageObject = {
      phoneNumberTo:
        person.phones.primaryPhoneNumber.length == 10
          ? '91' + person.phones.primaryPhoneNumber
          : person.phones.primaryPhoneNumber,
      phoneNumberFrom: '918411937769',
      fullPath: fullPath,
      fileData: {
        fileName: name,
        filePath: localFilePath,
        mimetype: mime.lookup(name) || 'application/octet-stream',
        fileBuffer: '',
      },
    };

    await new WhatsappControls(
      this.workspaceQueryService,
    ).sendAttachmentMessageOnWhatsapp(
      attachmentMessageObj,
      person,
      candidateJob,
      chatControl,
      apiToken,
    );
  }

  async sendAttachmentExtSockWhatsapp(
    attachmentMessage: AttachmentMessageObject,
    personNode: PersonNode,
    candidateJob: Jobs,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    if (process.env.WHATSAPP_API === 'ext-sock-whatsapp') {
      try {
        const arxenaSiteBaseUrl =
          process.env.ARXENA_SITE_BASE_URL || 'http://127.0.0.1:5050';

        // Read the file from the local path
        const fileBuffer = await fs.promises.readFile(
          attachmentMessage.fileData.filePath,
        );

        // Create form data
        const formData = new FormData();

        // Add extension_id to form data - extract from apiToken or add as needed
        formData.append('extension_id', 'YOUR_EXTENSION_ID'); // You'll need to get this value

        formData.append(
          'file',
          new Blob([fileBuffer]),
          attachmentMessage.fileData.fileName,
        );

        console.log('attachmentMessage:', attachmentMessage);
        console.log(
          'attachmentMessage phoneNumberTo:',
          attachmentMessage.phoneNumberTo,
        );
        console.log(
          'attachmentMessage phoneNumberFrom:',
          attachmentMessage.phoneNumberFrom,
        );
        formData.append('phoneNumberTo', attachmentMessage.phoneNumberTo);
        formData.append('phoneNumberFrom', attachmentMessage.phoneNumberFrom);
        formData.append('personNode', JSON.stringify(personNode));
        formData.append('candidateJob', JSON.stringify(candidateJob));
        formData.append('chatControl', JSON.stringify(chatControl));
        formData.append('apiToken', apiToken);

        const response = await axios.post(
          `${arxenaSiteBaseUrl}/upload_attachment`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${apiToken}`,
            },
          },
        );

        console.log('Attachment sent to ext-sock-whatsapp:', response.data);
      } catch (error) {
        console.error('Error sending attachment to ext-sock-whatsapp:', error);
        throw error; // Re-throw to handle at higher level if needed
      }
    }
  }
}
