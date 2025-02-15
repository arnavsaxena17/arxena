import * as allDataObjects from '../data-model-objects';
import { z } from 'zod';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../candidate-engagement/filter-candidates';

const commaSeparatedStatuses = allDataObjects.statusesArray.join(', ');

const recruiterProfile = allDataObjects.recruiterProfile;
// const candidateProfileObjAllData =  candidateProfile

import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import CandidateEngagementArx from '../candidate-engagement/candidate-engagement';
import { axiosRequest } from '../../utils/arx-chat-agent-utils';
export class PromptingAgents {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  currentConversationStage = z.object({
    stageOfTheConversation: z.enum(allDataObjects.allStatusesArray),
  });

  async convertToBulletPoints(steps: { [x: string]: any; 1?: string; 2?: string; 3?: string; 4?: string }) {
    let result = '';
    for (let key in steps) {
      result += `${key}. ${steps[key]}\n`;
    }
    return result;
  }

  async getQuestionsToAsk(personNode: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, apiToken: string) {
    console.log('This is the job::::%s', candidateJob);
    // const questions = ["What is your current & expected CTC?", "Who do you report to and which functions report to you?", "Are you okay to relocate to {location}?"];
    // const location = "Surat";
    // const formattedQuestions = questions.map((question, index) =>  `${index + 1}. ${question.replace("{location}", location)}`).join("\n");
    // return formattedQuestions
    const jobId = personNode?.candidates?.edges[0]?.node?.jobs?.id;
    console.log('Job Name:', personNode?.candidates?.edges[0]?.node?.jobs?.name);
    // console.log('This is the job Id:', jobId);
    const { questionArray, questionIdArray } = await new FilterCandidates(this.workspaceQueryService).fetchQuestionsByJobId(jobId, apiToken);

    // Hardcoded questions to ask if no questions are found in the database
    if (questionArray.length == 0) {
      return ['Are you okay to relocate to {location}?', 'What is your current & expected CTC?', 'What is your notice period?'];
    }
    if (candidateJob.name == 'Transcom') {
      return ['What is your current and expected CTC?', "This is an in-office role - Are you okay to work in a shift based out of Transcom's Kharadi office?", 'What is your notice period/ How soon can you join?', 'What is your Aadhaar Number?'];
    }
    return questionArray;
  }

  async getVideoInterviewPrompt(personNode: allDataObjects.PersonNode, apiToken: string) {
    const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;
    const current_job_position = jobProfile.name;
    const candidate_conversation_summary = 'The candidate has mentioned that he/ she is interested in the role. They are okay to relocate and their salary falls in the bracket that the client is hiring for';
    // const VIDEO_INTERVIEW_PROMPT =

    const variables = {
      candidate_conversation_summary: candidate_conversation_summary,
      current_job_position: current_job_position,
      jobProfile: jobProfile,
      personNode: personNode,
    };
    console.log('Generated sygetVideoInterviewPromptstem prompt:');
    const VIDEO_INTERVIEW_PROMPT_STRINGIFIED = await this.getPromptByJobIdAndName(jobProfile.id, 'VIDEO_INTERVIEW_PROMPT', apiToken);
    const VIDEO_INTERVIEW_PROMPT = this.replaceTemplateVariables(VIDEO_INTERVIEW_PROMPT_STRINGIFIED, variables);
    return VIDEO_INTERVIEW_PROMPT;
  }

  async getPromptByJobIdAndName(jobId: string, promptName: string, apiToken: string) {
    let data = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToFetchPrompts,
      variables: { filter: { jobId: { eq: jobId }, name: { ilike: `%${promptName}%` } }, limit: 1, orderBy: [{ position: 'AscNullsFirst' }] },
    });
    try {
      const response = await axiosRequest(data, apiToken);
      const prompts = response.data.data.prompts.edges;
      if (prompts.length > 0) {
        return prompts[0].node.prompt;
      } else {
        throw new Error('No prompts found for the given jobId and name.');
      }
    } catch (error) {
      console.error('Error fetching prompt:', error);
      throw error;
    }
  }

  replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\${([^}]+)}/g, (match, path) => {
      try {
        const parts = path.split(/\??\./).filter(Boolean);
        let value = variables;
        for (const part of parts) {
          if (value === null || value === undefined) {
            return match;
          }
          value = value[part];
        }
        return value !== null && value !== undefined ? String(value) : match;
      } catch (error) {
        console.log(`Error replacing template variable ${path}:`, error);
        return match; // Return original placeholder on error
      }
    });
  }

  async getStartChatPrompt(personNode: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, apiToken: string) {
    let receiveCV;
    receiveCV = `If they have shared their interest after going through the JD, ask the candidate to share a copy of their updated CV prior to the meeting.
    If they say that you can take the CV from naukri, tell them that you would require a copy for records directly from them for candidate confirmation purposes.`;
    receiveCV = ``;
    const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;
    const questionArray = await this.getQuestionsToAsk(personNode, candidateJob, apiToken);
    const filteredQuestionArray = questionArray.filter(question => !question.toLowerCase().includes('aadhaar'));
    const formattedQuestions = '\t' + filteredQuestionArray.map((question, index) => `${index + 1}. ${question}`).join('\n\t');
    const workingConditions = `
        - 6-day working week with 1 rotational week off.
        - Last logout time for females: 8 pm.
        - Self-traveling required.
        - Location: Kharadi, Pune.`
    let mannerOfAskingQuestions;
    mannerOfAskingQuestions = 'Ask these questions in any order one by one and ensure a natural continuous conversation.';
    mannerOfAskingQuestions = 'Ask these questions in a single message and ask the candidate to answer each of them.';

    const variables = {
      personNode,
      jobProfile: personNode?.candidates?.edges[0]?.node?.jobs,
      recruiterProfile: recruiterProfile,
      receiveCV: receiveCV,
      formattedQuestions: formattedQuestions,
      mannerOfAskingQuestions: mannerOfAskingQuestions,
      workingConditions: workingConditions,
    };
    const SYSTEM_PROMPT_STRINGIFIED = await this.getPromptByJobIdAndName(candidateJob.id, 'START_CHAT_PROMPT', apiToken);
    const SYSTEM_PROMPT = this.replaceTemplateVariables(SYSTEM_PROMPT_STRINGIFIED, variables);
    console.log('Generated getStartChatPrompt prompt:', SYSTEM_PROMPT);
    return SYSTEM_PROMPT;
  }

  async getStartMeetingSchedulingPrompt(personNode: allDataObjects.PersonNode, candidateJob: allDataObjects.Jobs, apiToken: string) {
    try {
      console.log('candidateJob::', candidateJob);
      console.log('candidateJob interviewSchedule::', candidateJob.interviewSchedule.edges[0].node);
      if (candidateJob.interviewSchedule.edges[0].node.meetingType == 'online') {
        return this.getOnlineStartMeetingSchedulingPrompt(personNode, candidateJob, apiToken);
      } else if (candidateJob.interviewSchedule.edges[0].node.meetingType == 'inPerson') {
        return this.getInPersonMeetingSchedulingPrompt(personNode, candidateJob, apiToken);
      } else if (candidateJob.interviewSchedule.edges[0].node.meetingType == 'walkIn') {
        return this.getWalkinMeetingSchedulingPrompt(personNode, candidateJob, apiToken);
      }
    } catch (error) {
      console.log('Error in getStartMeetingSchedulingPrompt:', error, 'FUCK FUCK');
    }
  }

  async getInPersonMeetingSchedulingPrompt(personNode, candidateJob, apiToken: string) {
    // async getStartMeetingScheduling(personNode, candidateJob, apiToken:string){
    try {
      const candidate_conversation_summary = ``;
      const meeting_type = 'In-Person meeting';
      const secondary_available_slots = '12PM-3PM, 4PM -6PM on the 24th and 25th August 2024';
      const primary_available_slots = `12PM-3PM, 4PM -6PM on the 24th and 25th August 2024`;
      const interviewLocation = 'Kharadi, Pune';
      const interviewTiming = '11AM';
      const variables = {
        candidate_conversation_summary: candidate_conversation_summary,
        meeting_type: meeting_type,
        secondary_available_slots: secondary_available_slots,
        primary_available_slots: primary_available_slots,
        interviewLocation: interviewLocation,
        interviewTiming: interviewTiming,
        personNode: personNode,
      };

      const IN_PERSON_MEETING_SCHEDULING_PROMPT_STRINGIFIED = await this.getPromptByJobIdAndName(candidateJob.id, 'IN_PERSON_MEETING_SCHEDULING_PROMPT', apiToken);
      const IN_PERSON_MEETING_SCHEDULING_PROMPT = this.replaceTemplateVariables(IN_PERSON_MEETING_SCHEDULING_PROMPT_STRINGIFIED, variables);
      console.log('Generated IN_PERSON_MEETING_SCHEDULING_PROMPT prompt:', IN_PERSON_MEETING_SCHEDULING_PROMPT);
      return IN_PERSON_MEETING_SCHEDULING_PROMPT;
    } catch (error) {
      console.error('Error in getInPersonMeetingSchedulingPrompt:', error);
      throw error;
    }
  }

  async getOnlineStartMeetingSchedulingPrompt(personNode, candidateJob, apiToken: string) {
    try {
      const candidate_conversation_summary = ``;
      const meeting_type = 'Online meeting';
      let secondarySlotsDate = new Date();
      secondarySlotsDate.setDate(secondarySlotsDate.getDate() + 3);
      const secondary_available_slots = `12PM-3PM, 4PM -6PM on the ${secondarySlotsDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      let primarySlotsDate = new Date();
      primarySlotsDate.setDate(primarySlotsDate.getDate() + 2);
      const primary_available_slots = `12PM-3PM, 4PM -6PM on the ${primarySlotsDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      const variables = {
        candidate_conversation_summary: candidate_conversation_summary,
        meeting_type: meeting_type,
        secondary_available_slots: secondary_available_slots,
        primary_available_slots: primary_available_slots,
        personNode: personNode,
      };
      const ONLINE_MEETING_PROMPT_STRINGIFIED = await this.getPromptByJobIdAndName(candidateJob.id, 'ONLINE_MEETING_PROMPT', apiToken);
      const ONLINE_MEETING_PROMPT = this.replaceTemplateVariables(ONLINE_MEETING_PROMPT_STRINGIFIED, variables);
      console.log('Generated IN_PERSON_MEETING_SCHEDULING_PROMPT prompt:', ONLINE_MEETING_PROMPT);
      return ONLINE_MEETING_PROMPT;
    } catch (error) {
      console.error('Error in getOnlineStartMeetingSchedulingPrompt:', error);
      throw error;
    }
  }

  async getWalkinMeetingSchedulingPrompt(personNode, candidateJob, apiToken: string) {
    try {
      const candidate_conversation_summary = ``;
      const meeting_type = 'In-Person meeting';
      const interviewLocation = 'Kharadi, Pune';
      const interviewAddress = 'Transcom India, Office No 1501, 1508, Nayati Enthral, Sr No 12/1A, Mundhwa - Kharadi Bypass, Kharadi South Main Road, Kharadi, Pune, Maharashtra - 411014';
      const googleMapsLocation = 'https://maps.app.goo.gl/nAtTbrQDqcjaCcmm8';
      const whatHappensAtTheMeeting = 'the meeting would be to discuss their experience, motivations and interests. There will also be a versant test at the office.';
      const meetingTime = '11AM';
      let meetingDate = new Date();
      meetingDate.setDate(meetingDate.getDate() + 2);
      // Ensure the meeting date is not a Sunday
      while (meetingDate.getDay() === 0) {
        meetingDate.setDate(meetingDate.getDate() + 1);
      }
      const formattedMeetingWeekdayDate = meetingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const formattedMeetingWeekday = meetingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      const variables = {
        candidate_conversation_summary: candidate_conversation_summary,
        meeting_type: meeting_type,
        interviewLocation: interviewLocation,
        interviewAddress: interviewAddress,
        googleMapsLocation: googleMapsLocation,
        whatHappensAtTheMeeting: whatHappensAtTheMeeting,
        meetingTime: meetingTime,
        formattedMeetingWeekdayDate: formattedMeetingWeekdayDate,
        formattedMeetingWeekday: formattedMeetingWeekday,
        today: today,
        personNode: personNode,
      };
      const WALKIN_MEETING_SCHEDULING_PROMPT_STRINGIFIED = await this.getPromptByJobIdAndName(candidateJob.id, 'WALKIN_MEETING_SCHEDULING_PROMPT', apiToken);
      const WALKIN_MEETING_SCHEDULING_PROMPT = this.replaceTemplateVariables(WALKIN_MEETING_SCHEDULING_PROMPT_STRINGIFIED, variables);
      console.log('Generated WALKIN_MEETING_SCHEDULING_PROMPT prompt:', WALKIN_MEETING_SCHEDULING_PROMPT);
      return WALKIN_MEETING_SCHEDULING_PROMPT;
    } catch (error) {
      console.error('Error in getWalkinMeetingSchedulingPrompt:', error);
      throw error;
    }
  }

  async getTimeManagementPrompt(personNode: allDataObjects.PersonNode) {
    // const TIME_MANAGEMENT_PROMPT = `
    //   The current time is `+ new Date() +`. Calculate the amount of time that has passed from the last message. If the time elapsed has gone beyond 1 minute and less than 5 minutes and the user has not been sent the first reminder, Return the stage as "reminder_necessary" else return "reminder_unnecessary". Do not return any other text.
    // `;
    const TIME_MANAGEMENT_PROMPT = `
      You are responsible for creating and managing reminders for the candidate. When the candidate tells you that they will get back to you, your task is to remind the candidate to reply back after certain hours. You can do this by calling the function "create_reminder". You will not call this function otherwise. For now the reminder time is 1 hour.
    `;
    return TIME_MANAGEMENT_PROMPT;
  }

  async getReminderSystemPrompt() {
    const REMINDER_SYSTEM_PROMPT = `
    Read the message history. This candidate hasn't responded in a while. Remind this candidate. If the candidate has already been reminded, reply with "#DONTRESPOND#" exact string.
    `;
    console.log('Using reminder prompt');
    return REMINDER_SYSTEM_PROMPT;
  }

  async getStageWiseActivity() {
    const stageWiseActions = {
      'Initial Outreach': [
        `
        The recruiter introduces themselves and their company, mentions the specific role, and the candidate has responded in some manner. 
        The candidate might ask questions about we found their profile or which platform. Answer accordingly.  
        The candidate might directly propose a time to speak/ meet or ask for more details. In either case, share the JD with the candidate and ask them for their interest
        `,
      ],
      'Share Role Details': [
        `
        Provide a JD of the role and describe in short the details of the company. Ask the candidate if they would be keen on the role with the company.
        `,
      ],
      'Share screening questions': [
        `
        Ask questions to the candidate to assess their fitment for the role.
        `,
      ],
      'Create Reminder': [
        `
        `,
      ],
      'Schedule Screening Meeting': [''],
    };
    return stageWiseActions;
  }
}
