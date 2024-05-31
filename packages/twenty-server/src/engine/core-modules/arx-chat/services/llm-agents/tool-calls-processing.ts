import *  as allDataObjects from '../../services/data-model-objects'; 
import {AttachmentProcessingService} from '../../services/candidate-engagement/attachment-processing';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
// import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../services/candidate-engagement/update-chat';



export async function shareJDtoCandidate(person:allDataObjects.PersonNode){
    console.log("This is the person for which we are trying to send the JD:", person)
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log("This is the candidateID for which we are trying to send the JD:", candidateId)
    const jobId = person?.candidates?.edges[0]?.node?.jobs?.id;
    console.log("This is the jobId for which we are trying to send the JD:", jobId)
    const jDPath = person?.candidates?.edges[0]?.node?.jobs;
    console.log("This is the jDPath for which we are trying to send the JD:", jDPath)

    const jobAttachments = await new AttachmentProcessingService().fetchAllAttachmentsByJobId(jobId)??[];
    console.log("Job Attachments:", jobAttachments);
    if (!jobAttachments){
      console.log("No attachments found for this job");
    }
    const attachment = jobAttachments[0]?.node ?? "";
    await new WhatsappAPISelector().sendJDViaWhatsapp(person, candidateId, attachment);
}


export async function updateCandidateStatus(person:allDataObjects.PersonNode, status:string){
    console.log("Updating the candidate status");
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log("This is the candidateID for which we are trying to update the status:", candidateId)
    // const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);
    // updateCandidateStatus(this.person, status)
    return "Updated the candidate profile with the status."
}