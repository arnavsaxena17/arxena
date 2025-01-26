import * as allDataObjects from '../data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from './update-chat';
import { sortWhatsAppMessages } from '../../utils/arx-chat-agent-utils';
import { OpenAIArxMultiStepClient } from '../llm-agents/arx-multi-step-client';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from './filter-candidates';
import {Transformations} from './transformations'
import { ChatControls } from './chat-controls';
const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export default class CandidateEngagementArx {
  constructor( private readonly workspaceQueryService: WorkspaceQueryService ) {}
  async createAndUpdateCandidateStartChatChatMessage(chatReply: allDataObjects.chatControlType, candidatePersonNodeObj: allDataObjects.PersonNode,candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {

    // await new WhatsappControls(this.workspaceQueryService).sendWhatsappMessage(whatappUpdateMessageObj, personNode, mostRecentMessageArr, chatControl,apiToken);
    const personNode = candidatePersonNodeObj;
    const recruiterProfile = allDataObjects.recruiterProfile;
    const candidate = candidatePersonNodeObj?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
    const candidateId = candidate?.id || "";
    console.log("Candidate ID to start chat::", candidateId);

    const messagesList: allDataObjects.MessageNode[] = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateId, apiToken);
    const sortedMessagesList:allDataObjects.MessageNode[] = messagesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const whatappUpdateMessageObj = await new ChatControls(this.workspaceQueryService).getChatTemplateFromChatControls(chatControl, sortedMessagesList, candidateJob, candidatePersonNodeObj, apiToken, chatReply, recruiterProfile);
    await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).updateCandidateEngagementDataInTable(whatappUpdateMessageObj, apiToken);    
    console.log("Sending a messages::", chatReply, "to the candidate::", personNode.name.firstName + " " + personNode.name.lastName, "with candidate id::", candidateId);
  }

  async processCandidate(personNode: allDataObjects.PersonNode,candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken:string) {
    console.log("Engagement Type for the candidate ::", personNode.name.firstName + " " + personNode.name.lastName);
    try {
      const candidateNode = personNode.candidates.edges[0].node;
      const messagesList: allDataObjects.MessageNode[] = await new FilterCandidates(this.workspaceQueryService).fetchAllWhatsappMessages(candidateNode.id, apiToken);
      let mostRecentMessageArr: allDataObjects.ChatHistoryItem[] = new Transformations().getMostRecentMessageFromMessagesList(messagesList);
      if (mostRecentMessageArr?.length > 0) {
        console.log('Taking MULTI Step Client for - Prompt Engineering type:', process.env.PROMPT_ENGINEERING_TYPE);
        await new OpenAIArxMultiStepClient(personNode, this.workspaceQueryService ).createCompletion(mostRecentMessageArr,candidateJob, chatControl, apiToken);
      }
      else{
        console.log("mostRecentMessageArr?.length is not greater than 0, hence no engagement:: (length)::", mostRecentMessageArr?.length)
      }
    } catch (error) {
      console.log('This is the error in processCandidate', error);
    }
  }



  async startChatEngagement(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls,  apiToken:string) {
    const filteredCandidatesToStartEngagement = await new ChatControls(this.workspaceQueryService).filterCandidatesAsPerChatControls(peopleCandidateResponseEngagementArr, chatControl);
    for (const candidatePersonNodeObj of filteredCandidatesToStartEngagement) {
      console.log("Starting chat engagement for the candidate::", candidatePersonNodeObj.name.firstName + " " + candidatePersonNodeObj.name.lastName);
      const chatReply:allDataObjects.chatControlType = chatControl.chatControlType
      await this.createAndUpdateCandidateStartChatChatMessage(chatReply, candidatePersonNodeObj,candidateJob,  chatControl, apiToken);
    }
  }
  
  async engageCandidates(peopleCandidateResponseEngagementArr: allDataObjects.PersonNode[], candidateJob:allDataObjects.Jobs,chatControl: allDataObjects.chatControls,  apiToken:string) {
    console.log("These are the candidates who we want to engage ::",peopleCandidateResponseEngagementArr.length , "for chat Contro:", chatControl);
    const sortedPeopleData: allDataObjects.PersonNode[] = sortWhatsAppMessages(peopleCandidateResponseEngagementArr);
    const filteredCandidatesToEngage = sortedPeopleData.filter(person => {
      const candidate = person?.candidates?.edges?.find(edge => edge.node.jobs.id === candidateJob.id)?.node;
      return candidate ? new ChatControls(this.workspaceQueryService).isCandidateEligibleForEngagement(candidate, chatControl) : false;
    });
    console.log('Number processCandidateof filtered candidates to engage after time scheduling: ', filteredCandidatesToEngage?.length, "for chatcontrol", chatControl);
    for (const personNode of filteredCandidatesToEngage) {
      await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).setCandidateEngagementStatusToFalse(personNode?.candidates?.edges[0]?.node?.id,apiToken);
      await this.processCandidate(personNode, candidateJob, chatControl,  apiToken);
    }
  }
  
  async executeCandidateEngagement(apiToken:string) {
    try{
      console.log("Cron running and cycle started to check candidate engagement");
      const chatControls: allDataObjects.chatControls[] = [{chatControlType:"startChat"},{ chatControlType:"startVideoInterviewChat"}, {chatControlType:"startMeetingSchedulingChat"}];
      for (const chatControl of chatControls) {
        const {people, candidateJob} = await new FilterCandidates(this.workspaceQueryService).fetchSpecificPeopleToEngageBasedOnChatControl(chatControl, apiToken);
        this.checkIfAllInformationForSendingChatMessageIsAvailable(people,candidateJob, chatControl, apiToken);
        console.log(`Number of people to engage for ${chatControl.chatControlType}:`, people.length);
        if (people.length > 0) {
          if (chatControl.chatControlType === "startVideoInterviewChat") {
            await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).setupVideoInterviewLinks(people,candidateJob, chatControl, apiToken);
          }
          await this.startChatEngagement(people,candidateJob, chatControl, apiToken);
          await this.engageCandidates(people,candidateJob, chatControl, apiToken);
        }
      }
      return;
    }
    catch(error){
      console.log("This is the error in checkCandidate Engagement", error);
    }
  }
  checkIfAllInformationForSendingChatMessageIsAvailable(peopleEngagementStartChatArr: allDataObjects.PersonNode[], candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls, apiToken: string) {
    // api key, keys created for each api token for each workspace
    // Google integration is done
    // candidateFirstName
    // recruiterName
    // recruiterJobTitle
    // recruiterCompanyName
    // recruiterCompanyDescription
    // jobPositionName
    // descriptionOneliner
    // jobLocation
    // Attachment For JD
    // fetchQuestionsByJobId(jobId: string)
    // videoInterviewTemplate
    // questionsTemplate
    // CV for the candidate
    // questions for chat
    // questions for video interview
    // video interview attachments (videos)
    // video interview instructionrs, number of questions, etc. 
    // data in google sheet for the candidate
  }
}
