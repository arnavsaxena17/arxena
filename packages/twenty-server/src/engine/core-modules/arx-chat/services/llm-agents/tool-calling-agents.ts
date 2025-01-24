import { ToolCallsProcessing } from './tool-calls-processing';
import * as allDataObjects from '../data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../candidate-engagement/update-chat';
import fuzzy from 'fuzzy';
import { CalendarEventType } from '../../../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from '../candidate-engagement/calendar-email';
import { EmailTemplates, SendEmailFunctionality } from '../candidate-engagement/send-gmail';
import { GmailMessageData } from 'src/engine/core-modules/gmail-sender/services/gmail-sender-objects-types';
import * as allGraphQLQueries from '../../graphql-queries/graphql-queries-chatbot';
import { addHoursInDate, axiosRequest, toIsoString } from '../../utils/arx-chat-agent-utils';
import { z } from "zod";
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FilterCandidates } from '../candidate-engagement/filter-candidates';

const commaSeparatedStatuses = allDataObjects.statusesArray.join(', ');

const recruiterProfile = allDataObjects.recruiterProfile;
// const candidateProfileObjAllData =  candidateProfile
const availableTimeSlots = '12PM-3PM, 4PM -6PM on the 24th and 25th August 2024.';


export class ToolCallingAgents {

  constructor( private readonly workspaceQueryService: WorkspaceQueryService ) {}
  currentConversationStage = z.object({
    stageOfTheConversation: z.enum(allDataObjects.allStatusesArray)
  });
  
  getAvailableFunctions(candidateJob:allDataObjects.Jobs, apiToken: string) {
    return {
      share_jd: (inputs: any, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) => 
        this.shareJD(inputs, personNode,candidateJob, chatControl, apiToken),
      
      update_candidate_profile: (inputs: any, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) => 
        this.updateCandidateProfile(inputs, personNode, candidateJob,apiToken),
      
      update_answer: (inputs: { question: string; answer: string }, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) => 
        this.updateAnswer(inputs, personNode,candidateJob, apiToken),
      
      schedule_meeting: (inputs: any, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) => 
        this.scheduleMeeting(inputs, personNode, candidateJob, apiToken),
      
      send_email: (inputs: any, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) => 
        this.sendEmail(inputs, personNode,candidateJob, apiToken),
      
      create_reminder: (inputs: { reminderDuration: string }, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) => 
        this.createReminder(inputs, personNode, candidateJob, apiToken),
      
      share_interview_link: (inputs: any, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls, apiToken: string) => 
        this.shareInterviewLink(inputs, personNode,candidateJob, apiToken)
    };
  }

  async shareInterviewLink(inputs: any, personNode: allDataObjects.PersonNode, candidateJob:allDataObjects.Jobs, twenty_token: string) {
    const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;
    const videoInterviewUrl = personNode?.candidates?.edges[0]?.node?.videoInterview.edges[0].node.interviewLink.url;
    console.log("job Profile:", jobProfile);
    const jobName = jobProfile?.name;

    const videoInterviewInviteTemplate = await new EmailTemplates().getInterviewInvitationTemplate(personNode, videoInterviewUrl);
    console.log("allDataObjects.recruiterProfile?.email:", allDataObjects.recruiterProfile?.email);
    const emailData: GmailMessageData = {
      sendEmailFrom: allDataObjects.recruiterProfile?.email,
      sendEmailTo: personNode?.email,
      subject: 'Video Interview - ' + personNode?.name?.firstName + '<>' + personNode?.candidates.edges[0].node.jobs.company.name,
      message: videoInterviewInviteTemplate,
    };
    console.log("This is the email Data from createVideo Interview Send To Candidate:", emailData);
    const sendVideoInterviewLinkResponse = await new SendEmailFunctionality().sendEmailFunction(emailData, twenty_token);
    console.log("sendVideoInterviewLinkResponse:", sendVideoInterviewLinkResponse);
    return 'Interview link shared successfully.';
  }

  async createReminder(inputs: { reminderDuration: string }, candidateProfileDataNodeObj: allDataObjects.PersonNode, candidateJob:allDataObjects.Jobs,  apiToken:string) {
    console.log('Function Called:  candidateProfileDataNodeObj:any', candidateProfileDataNodeObj);
    debugger;
    const reminderTimestamp = addHoursInDate(new Date(), Number(inputs?.reminderDuration));
    const reminderTimestampInIsoFormat = toIsoString(reminderTimestamp);
    console.log('Reminder Timestamp:', reminderTimestamp);
    const createOneReminderVariables = {
      input: {
        remindCandidateDuration: inputs?.reminderDuration,
        remindCandidateAtTimestamp: reminderTimestampInIsoFormat,
        candidateId: candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.id,
        name: `Reminder for ${candidateProfileDataNodeObj?.name?.firstName} ${candidateProfileDataNodeObj?.name?.lastName} to remind in ${inputs?.reminderDuration} hours`,
        isReminderActive: true,
      },
    };
    console.log('Function Called: createReminder');
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToCreateOneReminder,
      variables: createOneReminderVariables,
    });

    const response = await axiosRequest(graphqlQueryObj,  apiToken);
    console.log('Response from createReminder:', response.data);
    return 'Reminder created successfully.';
  }

  async sendEmail(inputs: any, person: allDataObjects.PersonNode, candidateJob:allDataObjects.Jobs, apiToken:string) {
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile?.email,
      sendEmailTo: person?.email,
      subject: inputs?.subject || 'Email from the recruiter',
      message: inputs?.message || '',
    };
    await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);
    return 'Email sent successfully.';
  }

  async shareJD(inputs: any, personNode: allDataObjects.PersonNode, candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls,  apiToken:string) {
    try {
      console.log('Function Called: shareJD');
      await new ToolCallsProcessing(this.workspaceQueryService).shareJDtoCandidate(personNode,  chatControl,  apiToken);
      console.log('Function Called:  candidateProfileDataNodeObj:any', personNode);
    } catch {
      debugger;
    }
    return 'Shared the JD with the candidate and updated the database.';
  }
  

  async updateCandidateProfile(inputs: any, personNode: allDataObjects.PersonNode,  candidateJob:allDataObjects.Jobs, apiToken:string) {
    try {
      console.log('UPDATE CANDIDATE PROFILE CALLED AND UPDATING TO ::', inputs);
      console.log('Function Called:  candidateProfileDataNodeObj:any', personNode);
      // const status: allDataObjects.statuses = 'RECRUITER_INTERVIEW';
      await new ToolCallsProcessing(this.workspaceQueryService).updateCandidateStatus(personNode, inputs.candidateStatus,  apiToken);
      return 'Updated the candidate profile.';
    } catch (error) {
      console.log('Error in updateCandidateProfile:', error);
    }
  }

  async updateAnswer(inputs: { question: string; answer: string }, candidateProfileDataNodeObj: allDataObjects.PersonNode, candidateJob:allDataObjects.Jobs,  apiToken:string) {
    // const newQuestionArray = this.questionArray
    const jobId = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.jobs?.id;

    const { questionIdArray, questionArray } = await new FilterCandidates(this.workspaceQueryService).fetchQuestionsByJobId(jobId,  apiToken);
    const results = fuzzy.filter(inputs.question, questionArray);
    const matches = results.map(function (el) {
      return el.string;
    });
    console.log('The matches are:', matches);
    const mostSimilarQuestion = questionIdArray.filter(questionObj => questionObj.question == matches[0]);
    const AnswerMessageObj = { questionsId: mostSimilarQuestion[0]?.questionId, name: inputs.answer, candidateId: candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.id };

    await new ToolCallsProcessing(this.workspaceQueryService).updateAnswerInDatabase(candidateProfileDataNodeObj, AnswerMessageObj,  apiToken);
    try {
      console.log('Function Called:  candidateProfileDataNodeObj:any', candidateProfileDataNodeObj);
      console.log('Function Called: updateAnswer');
    } catch {
      console.log('Update Answer in Database working');
    }
    return 'Updated the candidate updateAnswer.';
  }

  async scheduleMeeting(inputs: any, candidateProfileDataNodeObj: allDataObjects.PersonNode, candidateJob:allDataObjects.Jobs,  apiToken:string) {
    console.log('Function Called:  candidateProfileDataNodeObj:any', candidateProfileDataNodeObj);
    const gptInputs = inputs?.inputs;

    console.log('Function Called: scheduleMeeting');
    const calendarEventObj: CalendarEventType = {
      summary: gptInputs?.summary || 'Meeting with the candidate',
      typeOfMeeting: gptInputs?.typeOfMeeting || 'Virtual',
      location: gptInputs?.location || 'Google Meet',
      description: gptInputs?.description || 'This meeting is scheduled to discuss the role and the company.',
      start: { dateTime: gptInputs?.startDateTime, timeZone: gptInputs?.timeZone },
      end: { dateTime: gptInputs?.endDateTime, timeZone: gptInputs?.timeZone },
      attendees: [{ email: candidateProfileDataNodeObj.email }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };
    await new CalendarEmailService().createNewCalendarEvent(calendarEventObj, apiToken);
    return 'scheduleMeeting the candidate meeting.';
  }



  async getTools(candidateJob:allDataObjects.Jobs, chatControl: allDataObjects.chatControls) {
    if (chatControl.chatControlType === 'startChat') {
      return this.getStartChatTools(candidateJob)
    }
    else if (chatControl.chatControlType === 'startVideoInterviewChat') {
      return this.getVideoInterviewTools(candidateJob)
    }
  }

  async getVideoInterviewTools(candidateJob:allDataObjects.Jobs){
    let tools;
      tools = [
        {
          type: 'function',
          function: {
            name: 'share_interview_link',
            description: 'Share the interview link with the candidate',
          },
        },
      ]
      return tools;
  }

  async getStartChatTools(candidateJob:allDataObjects.Jobs) {
    let tools;
      tools = [
        {
          type: 'function',
          function: {
            name: 'share_jd',
            description: 'Share the candidate JD',
          },
        },
        {
          type: 'function',
          function: {
            name: 'schedule_meeting',
            description: 'Schedule a meeting with the candidate',
            parameters: {
              type: 'object',
              properties: {
                inputs: {
                  type: 'object',
                  description: 'Details about the meeting',
                  properties: {
                    summary: {
                      type: 'string',
                      description: 'Summary of the meeting',
                    },
                    typeOfMeeting: {
                      type: 'string',
                      description: 'Type of the meeting, can be either Virtual or In-Person. Default is Virtual.',
                    },
                    location: {
                      type: 'string',
                      description: 'Location of the meeting',
                    },
                    description: {
                      type: 'string',
                      description: 'Description of the meeting',
                    },
                    startDateTime: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Start date and time of the meeting in ISO 8601 format',
                    },
                    endDateTime: {
                      type: 'string',
                      format: 'date-time',
                      description: 'End date and time of the meeting in ISO 8601 format',
                    },
                    timeZone: {
                      type: 'string',
                      description: 'Time zone of the meeting',
                    },
                  },
                  required: ['startDateTime', 'endDateTime', 'timeZone'],
                },
                candidateProfileDataNodeObj: {
                  type: 'object',
                  description: 'Profile data of the candidate',
                  properties: {
                    email: {
                      type: 'string',
                      format: 'email',
                      description: 'Email of the candidate',
                    },
                  },
                  required: ['email'],
                },
              },
              required: ['inputs', 'candidateProfileDataNodeObj'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'update_candidate_profile',
            description: 'Update the candidate profile',
            parameters: {
              type: 'object',
              properties: {
                candidateStatus: {
                  type: 'string',
                  description: 'The status of the candidate',
                },
              },
              required: ['candidateStatus'],
            },
          },
        },
        {
          type: 'function',
          function: {
            name: 'update_answer',
            description: "Update the candidate's answer based on the question asked",
            parameters: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'The question asked',
                },
                answer: {
                  type: 'string',
                  description: 'The answer provided by the candidate',
                },
              },
              required: ['question', 'answer'],
            },
          },
        },
      ];
    return tools;
  }

  getTimeManagementTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'create_reminder',
          description: 'Create a reminder for the candidate',
          parameters: {
            type: 'object',
            properties: {
              reminderDuration: {
                type: 'string',
                description: 'Number of hours for the reminder.',
              },
            },
            required: ['reminderDuration', 'hours'],
          },
        },
      },
    ];
  }


  async getSystemFacingToolsByStage() {
    const tools = [
      {
        type: 'function',
        function: {
          name: 'share_jd',
          description: 'Share the candidate JD',
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_candidate_profile',
          description: 'Update the candidate profile',
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_answer',
          description: "Update the candidate's answer",
        },
      },
    ];
    return tools;
  }

}


