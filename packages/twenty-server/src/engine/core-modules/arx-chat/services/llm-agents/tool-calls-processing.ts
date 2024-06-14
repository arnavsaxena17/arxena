import *  as allDataObjects from '../../services/data-model-objects'; 
import {AttachmentProcessingService} from '../../services/candidate-engagement/attachment-processing';
import { WhatsappAPISelector } from '../../services/whatsapp-api/whatsapp-controls';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../../services/candidate-engagement/update-chat';



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
    const candidateProfileObj = person?.candidates?.edges[0]?.node;
    let whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = {
      executorResultObj: {},
      candidateProfile:person?.candidates?.edges[0]?.node,
      candidateFirstName: person?.name?.firstName,
      phoneNumberFrom: person?.phone,
      phoneNumberTo: allDataObjects.recruiterProfile.phone,
      messages: [{ content: status }],
      messageType : status,
      messageObj: []
    };
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);
    return "Updated the candidate profile with the status."
}


// export async function updateCandidateAnswer(person:allDataObjects.PersonNode, status:string){
//     console.log("Updating the candidate status");
//     const candidateId = person?.candidates?.edges[0]?.node?.id;
//     console.log("This is the candidateID for which we are trying to update the status:", candidateId)
//     const candidateProfileObj = person?.candidates?.edges[0]?.node;
//     const AnswerMessageObj =  {
//         "questionsId" : "8c1b58eb-b628-46e0-90de-0c0a9bc32b4b",
//         "name": "I manage 10 plants",
//         "position": "first",
//         "candidateId" : "2e13a102-ddc9-4a33-be6f-eb6324790779"
//     }
    

//     const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateAnswer(candidateProfileObj, AnswerMessageObj);
//     return "Updated the candidate profile with the status."
// }


export async function scheduleCandidateInterview(person:allDataObjects.PersonNode, status:string){
    console.log("Updating the candidate status");
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log("This is the candidateID for which we are trying to update the status:", candidateId)
    const candidateProfileObj = person?.candidates?.edges[0]?.node;
    let whatappUpdateMessageObj:allDataObjects.candidateChatMessageType = {
      executorResultObj: {},
      candidateProfile:person?.candidates?.edges[0]?.node,
      candidateFirstName: person?.name?.firstName,
      phoneNumberFrom: person?.phone,
      phoneNumberTo: allDataObjects.recruiterProfile.phone,
      messages: [{ content: status }],
      messageType : status,
      messageObj: []
    };
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateEngagementStatus(candidateProfileObj, whatappUpdateMessageObj);
    return "Updated the candidate profile with the status."
}


export async function updateAnswerInDatabase(person:allDataObjects.PersonNode, AnswerMessageObj:any){
    console.log("Updating the candidate status");
    const candidateId = person?.candidates?.edges[0]?.node?.id;
    console.log("This is the candidateID for which we are trying to update the status:", candidateId)
    const candidateProfileObj = person?.candidates?.edges[0]?.node;
    const updateCandidateStatusObj = await new FetchAndUpdateCandidatesChatsWhatsapps().updateCandidateAnswer(candidateProfileObj, AnswerMessageObj);
    return "Updated the candidate profile with the status."
}


