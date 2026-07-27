import { Injectable, Optional } from '@nestjs/common';
import axios from 'axios';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { LinkedinUnipileMessagingService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile/linkedin-unipile-messaging.service';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { BaileysWhatsappAPI } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/baileys/callBaileys';
import { FacebookWhatsappChatApi } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/facebook-whatsapp/facebook-whatsapp-api';
import { WhatsappOutboundRateLimiterService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { WhatsappUnipileMessagingService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-unipile-messaging.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
  Attachment,
  AttachmentMessageObject,
  CandidateNode,
  ChatControlsObjType,
  ChatHistoryItem,
  getAttachmentDownloadUrl,
  Project,
  whatappUpdateMessageObjType,
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessagingControls {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService?: WorkspaceMemberProfileUnipileService,
    @Optional()
    private readonly whatsappOutboundRateLimiter?: WhatsappOutboundRateLimiterService,
  ) {}

  private createWhatsappUnipileMessagingService(): WhatsappUnipileMessagingService {
    return new WhatsappUnipileMessagingService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.workspaceMemberProfileUnipileService,
      this.whatsappOutboundRateLimiter,
    );
  }

  /**
   * Writes a failed outbound row to WhatsApp message history so the candidate chat drawer
   * shows the attempt and reason after refresh (skips engagement side-effects).
   */
  private async persistFailedOutboundChatMessage(
    candidate: CandidateNode | undefined,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    failureReason: string,
  ): Promise<void> {
    if (!candidate?.id) {
      return;
    }
    const attempted =
      whatappUpdateMessageObj.messages[0]?.content ||
      whatappUpdateMessageObj.messages[0]?.text ||
      '';
    if (!String(attempted).trim()) {
      return;
    }
    const reason = failureReason?.trim() || 'Send failed';
    try {
      const updateChat = UpdateChat.create(
        this.workspaceQueryService,
        this.staticGraphQLService,
      );
      const failedObj: whatappUpdateMessageObjType = {
        ...whatappUpdateMessageObj,
        id: uuidv4(),
        messages: [
          {
            content: `${String(attempted).trim()}\n\n— Send failed: ${reason}`,
          },
        ],
        whatsappDeliveryStatus: 'failed',
        whatsappMessageId: `send_failed_${uuidv4()}`,
      };
      await updateChat.updateCandidateEngagementDataInTable(
        candidate,
        failedObj,
        apiToken,
        true,
      );
    } catch (err) {
      console.error('persistFailedOutboundChatMessage:', err);
    }
  }

  private async failSendAndPersist(
    candidate: CandidateNode | undefined,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    detail: string | undefined,
    fallbackUserMessage: string,
  ): Promise<{ status: 'failed'; message: string }> {
    const message = detail?.trim() ? detail.trim() : fallbackUserMessage;
    await this.persistFailedOutboundChatMessage(
      candidate,
      whatappUpdateMessageObj,
      apiToken,
      message,
    );
    return { status: 'failed', message };
  }
  async sendWhatsappMessageToCandidate(
    messageText: string,
    candidate: CandidateNode,
    candidateJob: Project,
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
          'Found a single sneaky message #DONTRESPOND# which is coming out:: ',
          messageText,
        );

        return;
      }

      console.log(
        'Going to create whatsaappupdatemessage obj for message text::',
        messageText,
      );
      
      // const candidateNode = personNode?.candidates?.edges?.find(
      //   (edge) => edge.node.projects.id == candidateJob.id,
      // )?.node;

      if (!candidate) {
        console.log(
          'Candidate node not found, cannot proceed with sending the message',
        );

        return;
      }

      const whatappUpdateMessageObj = await new FilterCandidates(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).updateChatHistoryObjCreateWhatsappMessageObj(
        'sendWhatsappMessageToCandidateMulti',
        candidate,
        mostRecentMessageArr,
        chatControl,
        apiToken,
      );

      const saveDontRespondMessages =
        process.env.SAVE_DONTRESPOND_MESSAGES !== 'false';

      if (
        !whatappUpdateMessageObj ||
        (!saveDontRespondMessages &&
          (whatappUpdateMessageObj.messages[0].content?.includes(
            '#DONTRESPOND#',
          ) ||
            whatappUpdateMessageObj.messages[0].content?.includes(
              'DONTRESPOND',
            )))
      ) {
        console.log(
          'Found a #DONTRESPOND# message and SAVE_DONTRESPOND_MESSAGES is false, so not saving or sending any message',
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
            candidate,
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

  private async getMessagingChannelAndWhatsappKey(
    candidate: CandidateNode,
    apiToken: string,
  ): Promise<{ messagingChannel: string; whatsapp_key: string }> {
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    let whatsapp_key: string | null = 'whatsapp-official';

    whatsapp_key = await this.workspaceQueryService.getWorkspaceApiKey(
      workspaceId,
      'whatsapp_key',
    );

    if (whatsapp_key) {
      console.log('whatsapp_key in getMessagingChannel AndWhatsappKey ::', whatsapp_key);
    } else {
      console.log('No valid whatsapp API selected');
    }

    const messagingChannel = candidate?.messagingChannel || 'whatsapp-official';
    console.log("messagingChannel in getMessagingChannel AndWhatsappKey ::", messagingChannel);

    if (messagingChannel === 'linkedin') {
      whatsapp_key = 'linkedin';
    } else if (messagingChannel === 'linkedin-premium') {
      whatsapp_key = 'linkedin-premium';
    } else if (messagingChannel === 'linkedin-inmail') {
      whatsapp_key = 'linkedin-inmail';
    } else if (messagingChannel === 'whatsapp-web') {
      whatsapp_key = 'whatsapp-web';
    } else if (messagingChannel === 'whatsapp-official') {
      whatsapp_key = 'whatsapp-official';
    } else if (messagingChannel === 'baileys') {
      whatsapp_key = 'baileys';
    } else if (messagingChannel === 'whatsapp-unipile') {
      whatsapp_key = 'whatsapp-unipile';
    } else {
      whatsapp_key = 'whatsapp-official';
    }
    console.log("whatsapp_key in getMessagingChannel And WhatsappKey ::", whatsapp_key);

    return { messagingChannel, whatsapp_key };
  }

  async sendWhatsappMessage(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    candidate: CandidateNode,
    candidateJob: Project,
    mostRecentMessageArr: ChatHistoryItem[],
    chatControl: ChatControlsObjType,
    apiToken: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    try {
      if (
        whatappUpdateMessageObj.messages[0].content.includes('#DONTRESPOND#') ||
        whatappUpdateMessageObj.messages[0].content.includes('DONTRESPOND') ||
        whatappUpdateMessageObj.messages[0]?.content?.includes('DONOTRESPOND')
      ) {
        console.log(
          'Found a #DONTRESPOND# message in STAGE 2, so not sending any message',
        );

        return { status: 'success' };
      }

      const { messagingChannel, whatsapp_key } = await this.getMessagingChannelAndWhatsappKey(
        candidate,
        apiToken,
      );

      console.log(
        'whatsapp_key in sendWhatsappMessage :::',
        whatsapp_key,
        'personNode.candidates.edges[0].node.messagingChannel::',
        candidate.messagingChannel,
      );

      console.log('whatsapp_key in sendWhatsappMessage :::', whatsapp_key);
      if (whatsapp_key === 'whatsapp-official') {
        await new FacebookWhatsappChatApi(
          this.workspaceQueryService,
          this.staticGraphQLService,
          ).sendWhatsappMessageVIAFacebookAPI(
          whatappUpdateMessageObj,
          candidate,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
        return { status: 'success' };
      } else if (whatsapp_key === 'baileys') {
        const response = await new BaileysWhatsappAPI(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).sendWhatsappMessageVIABaileysAPI(
          whatappUpdateMessageObj,
          candidate,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
        
        if (response?.status === 'failed') {
          return this.failSendAndPersist(
            candidate,
            whatappUpdateMessageObj,
            apiToken,
            response.message,
            'Failed to send message via Baileys',
          );
        }
        return { status: 'success' };
      } else if (whatsapp_key === 'whatsapp-web') {
        await new ExtSockWhatsappMessageProcessor(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).sendWhatsappMessageVIAExtSockWhatsappAPI(
          whatappUpdateMessageObj,
          candidate,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
        return { status: 'success' };
      } else if (whatsapp_key === 'linkedin') {

        const response = await new LinkedinUnipileMessagingService(
          this.workspaceQueryService,
          this.staticGraphQLService,
          undefined,
          undefined,
          this.workspaceMemberProfileUnipileService,
        ).sendLinkedinMessageVIAUnipileAPI(
          whatappUpdateMessageObj,
          candidate,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );

        if (response?.status === 'failed') {
          return this.failSendAndPersist(
            candidate,
            whatappUpdateMessageObj,
            apiToken,
            response.message,
            'Failed to send message via LinkedIn Unipile',
          );
        }

        return { status: 'success' };
      } else if (whatsapp_key === 'linkedin-premium') {
        const response = await new LinkedinUnipileMessagingService(
          this.workspaceQueryService,
          this.staticGraphQLService,
          undefined,
          undefined,
          this.workspaceMemberProfileUnipileService,
        ).sendLinkedinMessageVIAUnipileAPI(
          whatappUpdateMessageObj,
          candidate,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
        
        if (response?.status === 'failed') {
          return this.failSendAndPersist(
            candidate,
            whatappUpdateMessageObj,
            apiToken,
            response.message,
            'Failed to send message via LinkedIn Unipile',
          );
        }
        return { status: 'success' };
      } else if (whatsapp_key === 'linkedin-inmail') {
        const response = await new LinkedinUnipileMessagingService(
          this.workspaceQueryService,
          this.staticGraphQLService,
          undefined,
          undefined,
          this.workspaceMemberProfileUnipileService,
        ).sendLinkedinInMailVIAUnipileAPI(
          whatappUpdateMessageObj,
          candidate,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
        
        if (response?.status === 'failed') {
          return this.failSendAndPersist(
            candidate,
            whatappUpdateMessageObj,
            apiToken,
            response.message,
            'Failed to send InMail via LinkedIn Unipile',
          );
        }
        return { status: 'success' };
      } else if (whatsapp_key === 'whatsapp-unipile') {
        const response = await this.createWhatsappUnipileMessagingService().sendWhatsappMessageVIAUnipileAPI(
          whatappUpdateMessageObj,
          candidate,
          candidateJob,
          mostRecentMessageArr,
          chatControl,
          apiToken,
        );
        
        if (response?.status === 'failed') {
          return this.failSendAndPersist(
            candidate,
            whatappUpdateMessageObj,
            apiToken,
            response.message,
            'Failed to send message via WhatsApp Unipile',
          );
        }
        return { status: 'success' };
      } else {
        console.log('No valid whatsapp API selected');
        return this.failSendAndPersist(
          candidate,
          whatappUpdateMessageObj,
          apiToken,
          'No valid WhatsApp API selected',
          'No valid WhatsApp API selected',
        );
      }
    } catch (error) {
      console.log('Error in sendWhatsappMessage:', error);
      const msg =
        error instanceof Error ? error.message : 'Error sending WhatsApp message';
      await this.persistFailedOutboundChatMessage(
        candidate,
        whatappUpdateMessageObj,
        apiToken,
        msg,
      );
      return { status: 'failed', message: msg };
    }
  }

  /**
   * Send a chat message to a candidate by candidate ID.
   * Fetches candidate details, builds message payload, and sends via the appropriate channel (WhatsApp/LinkedIn).
   */
  async sendMessageToCandidateById(
    candidateId: string,
    messageToSend: string,
    apiToken: string,
  ): Promise<{ status: 'success' | 'failed'; message?: string }> {
    const candidateNode: CandidateNode | undefined = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).getCandidateDetailsById(candidateId, apiToken);

    if (!candidateNode) {
      return { status: 'failed', message: 'Candidate not found' };
    }

    const candidateJob = candidateNode?.projects as Project;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    const candidateChatHistory = candidateNode?.whatsappMessages?.edges[0]?.node?.messageObj || [];
    const chatControl: ChatControlsObjType = {
      chatControlType: 'startChat',
    };

    let messageTo: string =
      candidateNode?.phoneNumber?.primaryPhoneNumber?.length === 10
        ? '91' + candidateNode?.phoneNumber?.primaryPhoneNumber
        : candidateNode?.phoneNumber?.primaryPhoneNumber || '';
    if (candidateNode?.messagingChannel === 'linkedin') {
      messageTo = candidateNode?.linkedinUrl?.primaryLinkUrl || '';
    } else {
      messageTo =
        candidateNode?.phoneNumber?.primaryPhoneNumber?.length === 10
          ? '91' + candidateNode?.phoneNumber?.primaryPhoneNumber
          : candidateNode?.phoneNumber?.primaryPhoneNumber || '';
    }

    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      id: uuidv4(),
      candidateProfile: candidateNode,
      candidateFirstName: candidateNode?.name || '',
      phoneNumberFrom: recruiterProfile.phoneNumber,
      whatsappMessageType: candidateNode?.whatsappProvider || 'application03',
      phoneNumberTo: messageTo,
      messages: [{ content: messageToSend }],
      messageType: 'botMessage',
      messageObj: candidateChatHistory,
      lastEngagementChatControl: chatControl.chatControlType,
      whatsappDeliveryStatus: 'created',
      whatsappMessageId: 'startChat',
      typeOfMessage:
        candidateNode?.messagingChannel ||
        process.env.DEFAULT_WHATSAPP_CLIENT ||
        'baileys',
    };

    return this.sendWhatsappMessage(
      whatappUpdateMessageObj,
      candidateNode,
      candidateJob,
      candidateChatHistory,
      chatControl,
      apiToken,
    );
  }

  async sendAttachmentMessageOnWhatsapp(
    attachmentMessage: AttachmentMessageObject,
    candidate: CandidateNode,
    candidateJob: Project,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log(
      'attachmentMessage received to send attachment:',
      attachmentMessage,
    );

    const { messagingChannel, whatsapp_key } = await this.getMessagingChannelAndWhatsappKey(
      candidate,
      apiToken,
    );

    console.log('messagingChannel in sendAttachmentMessageOnWhatsapp ::', messagingChannel);
    console.log('whatsapp_key in sendAttachmentMessageOnWhatsapp ::', whatsapp_key);
    if (whatsapp_key === 'whatsapp-official') {
      await new FacebookWhatsappChatApi(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).uploadAndSendFileToWhatsApp(
        attachmentMessage,
        candidate,
        candidateJob,
        chatControl,
        apiToken,
      );
    } else if (whatsapp_key === 'whatsapp-web') {
      await this.sendAttachmentExtSockWhatsapp(
        attachmentMessage,
        candidate,
        candidateJob,
        chatControl,
        apiToken,
      );
    } else if (whatsapp_key === 'baileys') {
      await new BaileysWhatsappAPI(
        this.workspaceQueryService,
        this.staticGraphQLService,
      ).sendAttachmentMessageViaBaileys(
        attachmentMessage,
        candidate,
        candidateJob,
        apiToken,
      );
    } else if (whatsapp_key === 'linkedin' || whatsapp_key === 'linkedin-premium') {
      await new LinkedinUnipileMessagingService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        undefined,
        undefined,
        this.workspaceMemberProfileUnipileService,
      ).sendLinkedinAttachmentMessage(
        attachmentMessage,
        candidate,
        candidateJob,
        apiToken,
      );
    } else if (whatsapp_key === 'linkedin-inmail') {
      await new LinkedinUnipileMessagingService(
        this.workspaceQueryService,
        this.staticGraphQLService,
        undefined,
        undefined,
        this.workspaceMemberProfileUnipileService,
      ).sendLinkedinInMailAttachmentMessage(
        attachmentMessage,
        candidate,
        candidateJob,
        apiToken,
      );
    } else if (whatsapp_key === 'whatsapp-unipile') {
      const response = await this.createWhatsappUnipileMessagingService().sendWhatsappAttachmentMessage(
        attachmentMessage,
        candidate,
        candidateJob,
        apiToken,
      );
      
      if (response?.status === 'failed') {
        return {
          status: 'failed',
          message:
            response.message?.trim() ||
            'Failed to send attachment via WhatsApp Unipile',
        };
      }
      return { status: 'success' };
    }
  }

  async sendJDViaWhatsapp(
    candidate: CandidateNode,
    candidateJob: Project,
    attachment: Attachment,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    const downloadUrl = getAttachmentDownloadUrl(attachment);
    if (!downloadUrl) {
      console.log(
        'There is no attachment attached, cannot proceed with sending the JD to the candidate',
      );
      return;
    }

    const name = attachment.name || 'attachment.pdf';
    const projectIdForPath =
      (attachment as { targetProjectId?: string | null }).targetProjectId ??
      attachment.projectId ??
      candidateJob.id;
    const localFilePath = path.join(
      process.cwd(),
      '.attachments',
      projectIdForPath,
      `${candidate.id}_${name}`,
    );

    console.log('Attachment download URL::', downloadUrl);
    console.log('This is attachment name:', name);
    console.log('This is localFile Path:', localFilePath);

    let fileBuffer: Buffer;

    try {
      console.log('url:', downloadUrl, 'name:', name);
      console.log('localFilePath:', localFilePath);
      const fileData = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'arraybuffer',
      });
      if (!fileData?.data) {
        throw new Error('No data found in the file');
      }
      fileBuffer = Buffer.from(fileData.data);
      await fs.promises.mkdir(path.dirname(localFilePath), { recursive: true });
      await fs.promises.writeFile(localFilePath, new Uint8Array(fileBuffer));
      console.log('File has been saved!');
    } catch (error) {
      console.log('Error in downloading the file:', error);
      return;
    }

    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    let phoneNumberTo: string;
    let phoneNumberFrom: string;

    if (candidate.messagingChannel === 'linkedin' || candidate.messagingChannel === 'linkedin-premium') {
      phoneNumberTo = candidate.linkedinUrl?.primaryLinkUrl || '';
      phoneNumberFrom = recruiterProfile.linkedinUrl || '';
    } else if (candidate?.phoneNumber?.primaryPhoneNumber) {
      phoneNumberTo = candidate.phoneNumber.primaryPhoneNumber.length == 10
        ? '91' + candidate.phoneNumber.primaryPhoneNumber
        : candidate.phoneNumber.primaryPhoneNumber;
      phoneNumberFrom = recruiterProfile.phoneNumber;
    } else {
      console.warn('No phone number found for candidate, using empty string');
      phoneNumberTo = '';
      phoneNumberFrom = recruiterProfile.phoneNumber || '';
    }

    const attachmentMessageObj: AttachmentMessageObject = {
      phoneNumberTo,
      phoneNumberFrom,
      fullPath: downloadUrl,
      fileData: {
        fileName: name,
        filePath: localFilePath,
        mimetype: mime.lookup(name) || 'application/octet-stream',
        fileBuffer: fileBuffer as unknown as string,
      },
    };

    try {
      await this.sendAttachmentMessageOnWhatsapp(
        attachmentMessageObj,
        candidate,
        candidateJob,
        chatControl,
        apiToken,
      );
    } finally {
      try {
        await fs.promises.unlink(localFilePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.log('Error cleaning up temporary attachment file:', error);
        }
      }
    }
  }

  async sendAttachmentExtSockWhatsapp(
    attachmentMessage: AttachmentMessageObject,
    candidate: CandidateNode,
    candidateJob: Project,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log("Going to send attachment to ext-sock-whatsapp")
    const messagingChannel = candidate.messagingChannel;
    console.log("messagingChannel for sending attachment to ext-sock-whatsapp", messagingChannel);
    if (messagingChannel === 'whatsapp-web') {
      try {
        console.log("attachmentMessage for sending attachment to ext-sock-whatsapp", attachmentMessage);
        const arxenaSiteBaseUrl =
          process.env.ARXENA_SITE_BASE_URL || 'http://localhost:5050';

        // Read the file from the local path
        const fileBuffer = await fs.promises.readFile(
          attachmentMessage.fileData.filePath,
        );

        // Create form data
        const formData = new FormData();

        // Add extension_id to form data - extract from apiToken or add as needed
        // formData.append('extension_id', 'YOUR_EXTENSION_ID'); // You'll need to get this value
        // @ts-expect-error
        formData.append( 'file', new Blob([fileBuffer]), attachmentMessage.fileData.fileName, );

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
        formData.append('candidate', JSON.stringify(candidate));
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
