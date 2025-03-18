import {
  ChatControlsObjType,
  Jobs,
  PersonNode,
  RecruiterProfileType,
  whatappUpdateMessageObjType,
} from 'twenty-shared';

import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { getRecruiterProfileByJob } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { WhatsappControls } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/whatsapp-controls';
import { AttachmentProcessingService } from 'src/engine/core-modules/arx-chat/utils/attachment-processes';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export class ToolCallsProcessing {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  async shareJDtoCandidate(
    person: PersonNode,
    candidateJob: Jobs,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    console.log(
      'This is the person for which we are trying to send the JD:',
      person,
    );
    const candidateId = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node?.id;

    console.log(
      'Filtered candidate:',
      person?.candidates?.edges.filter(
        (edge) => edge.node.jobs.id === candidateJob.id,
      )[0],
    );

    console.log(
      'This is the candidateID for which we are trying to send the JD:',
      candidateId,
    );
    const jobId = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node?.jobs?.id;

    console.log(
      'This is the jobId for which we are trying to send the JD:',
      jobId,
    );
    const jDPath = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node?.jobs;

    console.log(
      'This is the jDPath for which we are trying to send the JD:',
      jDPath,
    );
    const jobAttachments =
      (await new AttachmentProcessingService().fetchAllAttachmentsByJobId(
        jobId,
        apiToken,
      )) ?? [];

    // console.log('Job Attachments:', jobAttachments);
    if (!jobAttachments) {
      console.log('No attachments found for this job');
    }
    const attachment = jobAttachments?.node ?? '';

    await new WhatsappControls(this.workspaceQueryService).sendJDViaWhatsapp(
      person,
      candidateJob,
      attachment,
      chatControl,
      apiToken,
    );
  }

  async updateCandidateStatus(
    person: PersonNode,
    status: string,
    apiToken: string,
  ) {
    console.log(
      'Updating the candidate status::',
      status,
      'aipi token:',
      apiToken,
    );
    const candidateId = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );
    const candidateNode = person.candidates.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0].node;
    const candidateJob: Jobs = candidateNode?.jobs;
    const recruiterProfile: RecruiterProfileType =
      await getRecruiterProfileByJob(candidateJob, apiToken);

    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      // executorResultObj: {},
      whatsappMessageType: '',
      candidateProfile: person?.candidates?.edges.filter(
        (edge) => edge.node.jobs.id === candidateJob.id,
      )[0]?.node,
      candidateFirstName: person?.name?.firstName,
      lastEngagementChatControl: person?.candidates?.edges.filter(
        (edge) => edge.node.jobs.id === candidateJob.id,
      )[0]?.node?.lastEngagementChatControl,
      phoneNumberFrom:
        person.phones.primaryPhoneNumber.length == 10
          ? '91' + person.phones.primaryPhoneNumber
          : person.phones.primaryPhoneNumber,
      phoneNumberTo: recruiterProfile?.phoneNumber,
      messages: [{ content: status }],
      messageType: status,
      messageObj: [],
      whatsappDeliveryStatus: 'updateCandidateStatus',
      whatsappMessageId: 'updateCandidateStatus',
    };
    const updateCandidateStatusObj = await new UpdateChat(
      this.workspaceQueryService,
    ).updateCandidateProfileStatus(
      candidateNode,
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
    person: PersonNode,
    candidateJob: Jobs,
    status: string,
    apiToken: string,
  ) {
    console.log('Updating the candidate interview schedule');
    const candidateId = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );

    const recruiterProfile: RecruiterProfileType =
      await getRecruiterProfileByJob(candidateJob, apiToken);

    const candidateProfileObj = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node;
    const whatappUpdateMessageObj: whatappUpdateMessageObjType = {
      // executorResultObj: {},
      whatsappMessageType: '',
      candidateProfile: person?.candidates?.edges.filter(
        (edge) => edge.node.jobs.id === candidateJob.id,
      )[0]?.node,
      candidateFirstName: person?.name?.firstName,
      phoneNumberFrom:
        person.phones.primaryPhoneNumber.length == 10
          ? '91' + person.phones.primaryPhoneNumber
          : person.phones.primaryPhoneNumber,
      lastEngagementChatControl: person?.candidates?.edges.filter(
        (edge) => edge.node.jobs.id === candidateJob.id,
      )[0]?.node?.lastEngagementChatControl,
      phoneNumberTo: recruiterProfile?.phoneNumber,
      messages: [{ content: status }],
      messageType: status,
      messageObj: [],
      whatsappDeliveryStatus: 'scheduleCandidateInterview',
      whatsappMessageId: 'scheduleCandidateInterview',
    };
    const updateCandidateStatusObj = await new UpdateChat(
      this.workspaceQueryService,
    ).updateCandidateProfileStatus(
      candidateProfileObj,
      whatappUpdateMessageObj,
      apiToken,
    );

    return 'Updated the candidate interview schedule.';
  }

  async updateAnswerInDatabase(
    person: PersonNode,
    AnswerMessageObj: any,
    candidateJob: Jobs,
    apiToken: string,
  ) {
    console.log('Updating the candidate answer in database');
    const candidateId = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );
    const candidateProfileObj = person?.candidates?.edges.filter(
      (edge) => edge.node.jobs.id === candidateJob.id,
    )[0]?.node;
    const updateCandidateStatusObj = await new UpdateChat(
      this.workspaceQueryService,
    ).updateCandidateAnswer(candidateProfileObj, AnswerMessageObj, apiToken);

    return 'Updated the candidate answer in the database.';
  }
}
