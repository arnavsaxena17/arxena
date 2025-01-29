import * as allDataObjects from '../../services/data-model-objects';
import { AttachmentProcessingService } from '../candidate-engagement/attachment-processes';
import { WhatsappControls } from '../whatsapp-api/whatsapp-controls';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../services/candidate-engagement/update-chat';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// import { chat } from 'googleapis/build/src/apis/chat';

export class ToolCallsProcessing{
    constructor(
      private readonly workspaceQueryService: WorkspaceQueryService
    ) {}
  async shareJDtoCandidate(person: allDataObjects.PersonNode, candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls,  apiToken:string) {
    console.log('This is the person for which we are trying to send the JD:', person);
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log('This is the candidateID for which we are trying to send the JD:', candidateId);
    const jobId = person?.candidates?.edges[0]?.node?.jobs?.id;
    console.log('This is the jobId for which we are trying to send the JD:', jobId);
    const jDPath = person?.candidates?.edges[0]?.node?.jobs;
    console.log('This is the jDPath for which we are trying to send the JD:', jDPath);
    const jobAttachments = (await new AttachmentProcessingService().fetchAllAttachmentsByJobId(jobId,apiToken)) ?? [];
    // console.log('Job Attachments:', jobAttachments);
    if (!jobAttachments) {
      console.log('No attachments found for this job');
    }
    const attachment = jobAttachments?.node ?? '';
    await new WhatsappControls(this.workspaceQueryService).sendJDViaWhatsapp( person,candidateJob, attachment, chatControl, apiToken);
  }
  
  async updateCandidateStatus(person: allDataObjects.PersonNode, status: string, apiToken: string) {
    console.log('Updating the candidate status::', status, "aipi token:", apiToken);
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log('This is the candidateID for which we are trying to update the status:', candidateId);
    const candidateProfileObj = person?.candidates?.edges[0]?.node;
    let whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType = {
      // executorResultObj: {},
      whatsappMessageType: "",
      candidateProfile: person?.candidates?.edges[0]?.node,
      candidateFirstName: person?.name?.firstName,
      lastEngagementChatControl: person?.candidates?.edges[0]?.node?.lastEngagementChatControl,
      phoneNumberFrom: person?.phone,
      phoneNumberTo: allDataObjects?.recruiterProfile?.phone,
      messages: [{ content: status }],
      messageType: status,
      messageObj: [],
      whatsappDeliveryStatus: 'updateCandidateStatus',
      whatsappMessageId: 'updateCandidateStatus',
    };
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateProfileStatus(candidateProfileObj, whatappUpdateMessageObj, apiToken);
    console.log("This is the updateCandidateStatusObj:", updateCandidateStatusObj)
    return 'Updated the candidate profile with the status.';
  }
  
  async scheduleCandidateInterview(person: allDataObjects.PersonNode, status: string,  apiToken:string) {
    console.log('Updating the candidate interview schedule');
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log('This is the candidateID for which we are trying to update the status:', candidateId);
    const candidateProfileObj = person?.candidates?.edges[0]?.node;
    let whatappUpdateMessageObj: allDataObjects.whatappUpdateMessageObjType = {
      // executorResultObj: {},
      whatsappMessageType: "",
      candidateProfile: person?.candidates?.edges[0]?.node,
      candidateFirstName: person?.name?.firstName,
      phoneNumberFrom: person?.phone,
      lastEngagementChatControl: person?.candidates?.edges[0]?.node?.lastEngagementChatControl,
      phoneNumberTo: allDataObjects?.recruiterProfile?.phone,
      messages: [{ content: status }],
      messageType: status,
      messageObj: [],
      whatsappDeliveryStatus: 'scheduleCandidateInterview',
      whatsappMessageId: 'scheduleCandidateInterview',
    };
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateProfileStatus(candidateProfileObj, whatappUpdateMessageObj,  apiToken);
    return 'Updated the candidate interview schedule.';
  }
  
  async updateAnswerInDatabase(person: allDataObjects.PersonNode, AnswerMessageObj: any,  apiToken:string) {
    console.log('Updating the candidate answer in database');
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log('This is the candidateID for which we are trying to update the status:', candidateId);
    const candidateProfileObj = person?.candidates?.edges[0]?.node;
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateAnswer(candidateProfileObj, AnswerMessageObj,  apiToken);
    return 'Updated the candidate answer in the database.';
  }
  
}
