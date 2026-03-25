import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { MessagingControls } from 'src/engine/core-modules/arx-chat/services/messaging-controls';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { AttachmentProcessingService } from 'src/engine/core-modules/arx-chat/utils/attachment-processes';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import {
    CandidateNode,
    ChatControlsObjType,
    Job,
    whatappUpdateMessageObjType
} from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';
export class ToolCallsProcessing {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService?: WorkspaceMemberProfileUnipileService,
  ) {}
  async shareJDtoCandidate(
    candidate: CandidateNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log(
      'This is the person for which we are trying to send the JD:',
      candidate,
    );
    const candidateId = candidate?.id;

    console.log(
      'Filtered candidate:',
      candidate,
    );

    console.log(
      'This is the candidateID for which we are trying to send the JD:',
      candidateId,
    );
    const jobId = candidateJob?.id;

    console.log(
      'This is the jobId for which we are trying to send the JD:',
      jobId,
    );

    const jobAttachments =
      (await new AttachmentProcessingService(this.staticGraphQLService).fetchAllAttachmentsByJobId(
        jobId,
        apiToken,
      )) ?? [];

    // console.log('Job Attachments:', jobAttachments);
    if (!jobAttachments) {
      console.log('No attachments found for this job');
    }
    const attachment = jobAttachments?.node ?? '';

    await new MessagingControls(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.workspaceMemberProfileUnipileService,
    ).sendJDViaWhatsapp(
      candidate,
      candidateJob,
      attachment,
      chatControl,
      apiToken,
    );
  }
  async updateCandidateStatus(
    candidate: CandidateNode,
    status: string,
    apiToken: string,
  ) {
    console.log( 'Updating the candidate status::', status, 'aipi token:', apiToken );
    const candidateId = candidate?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );
    const candidateJob: Job = candidate?.jobs;
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, apiToken);
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    let phoneNumberFrom: string = '';
    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberFrom = candidate?.linkedinUrl?.primaryLinkUrl || '';
    } else if (candidate?.phoneNumber?.primaryPhoneNumber) {
      phoneNumberFrom = candidate.phoneNumber.primaryPhoneNumber.length == 10
          ? '91' + candidate.phoneNumber.primaryPhoneNumber
          : candidate.phoneNumber.primaryPhoneNumber;
    } else {
      console.warn('No phone number found for candidate, using empty string');
    }

    let phoneNumberTo:string = recruiterProfile.phoneNumber;

    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberTo = recruiterProfile.linkedinUrl || '';
    }
    else{
      phoneNumberTo = recruiterProfile.phoneNumber
    }
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
    // executorResultObj: {},
    id: uuidv4(),
    whatsappMessageType: '',
    candidateProfile: candidate,
    candidateFirstName: candidate?.name,
    lastEngagementChatControl: candidate?.lastEngagementChatControl,
    phoneNumberFrom:
      phoneNumberFrom,
    phoneNumberTo: phoneNumberTo,
    messages: [{ content: status }],
    messageType: status,
    messageObj: [],
    whatsappDeliveryStatus: 'updateCandidateStatus',
    typeOfMessage: candidate?.messagingChannel ||  process.env.DEFAULT_WHATSAPP_CLIENT || 'baileys',
    whatsappMessageId: 'updateCandidateStatus',
  };

  const updateCandidateStatusObj = await new UpdateChat(
    this.workspaceQueryService,
    this.staticGraphQLService,
  ).updateCandidateProfileStatus(
    candidate,
    whatappUpdateMessageObj,
    apiToken,
  );

  console.log(
    'This is the updateCandidateStatusObj:',
    updateCandidateStatusObj,
  );

  return 'Updated the candidate profile with the status.';
  }

  async scheduleCandidateInterview(
    candidate: CandidateNode,
    candidateJob: Job,
    status: string,
    apiToken: string,
  ) {
    console.log('Updating the candidate interview schedule');
    const candidateId = candidate?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );

    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, apiToken);
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    const candidateProfileObj = candidate



    let phoneNumberFrom: string = '';
    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberFrom = candidate?.linkedinUrl?.primaryLinkUrl || '';
    } else if (candidate?.phoneNumber?.primaryPhoneNumber) {
      phoneNumberFrom = candidate.phoneNumber.primaryPhoneNumber.length == 10
          ? '91' + candidate.phoneNumber.primaryPhoneNumber
          : candidate.phoneNumber.primaryPhoneNumber;
    } else {
      console.warn('No phone number found for candidate, using empty string');
    }

    let phoneNumberTo:string = recruiterProfile.phoneNumber;

    if (candidate?.messagingChannel == 'linkedin') {
      phoneNumberTo = recruiterProfile.linkedinUrl || '';
    }
    else{
    phoneNumberTo = recruiterProfile.phoneNumber
    }

    



    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      // executorResultObj: {},
      id: uuidv4(),
      whatsappMessageType: '',
      candidateProfile: candidate,
      candidateFirstName: candidate?.name,
      phoneNumberFrom:
        phoneNumberFrom,
      lastEngagementChatControl: candidate?.lastEngagementChatControl,
      phoneNumberTo: phoneNumberTo,
      messages: [{ content: status }],
      messageType: status,
      messageObj: [],
      whatsappDeliveryStatus: 'scheduleCandidateInterview',
      whatsappMessageId: 'scheduleCandidateInterview',
      typeOfMessage: candidate?.messagingChannel || process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile',
    };
    const updateCandidateStatusObj = await new UpdateChat(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).updateCandidateProfileStatus(
      candidateProfileObj,
      whatappUpdateMessageObj,
      apiToken,
    );

    return 'Updated the candidate interview schedule.';
  }

  async updateAnswerInDatabase(
    candidate: CandidateNode,
    AnswerMessageObj: any,
    candidateJob: Job,
    apiToken: string,
  ) {
    console.log('Updating the candidate answer in database');
    const candidateId = candidate?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );
    const candidateProfileObj = candidate;
    const updateCandidateStatusObj = await new UpdateChat(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).updateCandidateAnswer(candidateProfileObj, AnswerMessageObj, apiToken);

    return 'Updated the candidate answer in the database.';
  }
}
