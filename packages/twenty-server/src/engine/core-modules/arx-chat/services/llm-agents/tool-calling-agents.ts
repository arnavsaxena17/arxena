import { SchedulerRegistry } from '@nestjs/schedule';

import fuzzy from 'fuzzy';
import { ChatCompletionTool } from 'openai/resources';
import {
    allStatusesArray,
    CandidateNode,
    ChatControlsObjType,
    graphqlQueryToCreateOneClientInterview,
    graphqlQueryToCreateOneReminder,
    Job
} from 'twenty-shared';
import { z } from 'zod';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { UpdateChat } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/update-chat';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { ScheduledJobService } from 'src/engine/core-modules/arx-chat/services/scheduled-job.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import {
    addHoursInDate,
    toIsoString
} from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { CalendarEmailService } from 'src/engine/core-modules/arx-chat/utils/calendar-email';
import {
    EmailTemplates,
    SendEmailFunctionality,
} from 'src/engine/core-modules/arx-chat/utils/send-gmail';
import { CalendarEventType } from 'src/engine/core-modules/calendar-events/services/calendar-data-objects-types';
import { GmailMessageData } from 'src/engine/core-modules/gmail-sender/services/gmail-sender-objects-types';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { ToolCallsProcessing } from './tool-calls-processing';

export class ToolCallingAgents {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService?: WorkspaceMemberProfileUnipileService,
  ) {}
  currentConversationStage = z.object({
    stageOfTheConversation: z.enum(allStatusesArray),
  });

  getAvailableFunctions(candidateJob: Job, apiToken: string) {
    return {
      share_jd: (
        inputs: any,
        candidate: CandidateNode,
        candidateJob: Job,
        chatControl: ChatControlsObjType,
        apiToken: string,
      ) =>
        this.shareJD(inputs, candidate, candidateJob, chatControl, apiToken),

      update_candidate_profile: (
        inputs: any,
        candidate: CandidateNode,
        candidateJob: Job,
        chatControl: ChatControlsObjType,
        apiToken: string,
      ) =>
        this.updateCandidateProfile(inputs, candidate, candidateJob, apiToken),

      update_answer: (
        inputs: { question: string; answer: string },
        candidate: CandidateNode,
        candidateJob: Job,
        chatControl: ChatControlsObjType,
        apiToken: string,
      ) => this.updateAnswer(inputs, candidate, candidateJob, apiToken),

      schedule_meeting: (
        inputs: any,
        candidate: CandidateNode,
        candidateJob: Job,
        chatControl: ChatControlsObjType,
        apiToken: string,
      ) => this.scheduleMeeting(inputs, candidate, candidateJob, apiToken),

      send_email: (
        inputs: any,
        candidate: CandidateNode,
        candidateJob: Job,
        chatControl: ChatControlsObjType,
        apiToken: string,
      ) => this.sendEmail(inputs, candidate, candidateJob, apiToken),

      create_reminder: (
        inputs: { reminderDuration: string },
        candidate: CandidateNode,
        candidateJob: Job,
        chatControl: ChatControlsObjType,
        apiToken: string,
      ) => this.createReminder(inputs, candidate, candidateJob, apiToken),

      share_interview_link: (
        inputs: any,
        candidate: CandidateNode,
        candidateJob: Job,
        chatControl: ChatControlsObjType,
        apiToken: string,
      ) => this.shareInterviewLink(inputs, candidate, candidateJob, apiToken),
    };
  }

  async shareInterviewLink(
    inputs: any,
    candidate: CandidateNode,
    candidateJob: Job,
    twenty_token: string,
  ) {
    // const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;

    const videoInterviewUrl =
      candidate?.videoInterview.edges[0].node?.interviewLink?.primaryLinkUrl;
    // console.log("job Profile:", jobProfile);

    const companyName = candidate?.jobs?.company?.name;

    if (!videoInterviewUrl) {
      throw new Error('Video interview URL is undefined');
    }
    const videoInterviewInviteTemplate =
      await new EmailTemplates().getInterviewInvitationTemplate(
        candidate,
        candidateJob,
        videoInterviewUrl,
      );
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, twenty_token);
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    console.log('recruiterProfile?.email:', recruiterProfile?.email);
    const emailData: GmailMessageData = {
      sendEmailNameFrom:
        recruiterProfile.firstName + ' ' + recruiterProfile.lastName,
      sendEmailFrom: recruiterProfile.email,
      sendEmailTo: candidate?.email?.primaryEmail,
      subject:
        'Video Interview - ' + candidate?.name + '<>' + companyName,
      message: videoInterviewInviteTemplate,
    };

    console.log(
      'This is the email Data from createVideo Interview Send To Candidate:',
      emailData,
    );
    const sendVideoInterviewLinkResponse =
      await new SendEmailFunctionality().sendEmailFunction(
        emailData,
        twenty_token,
      );

    console.log(
      'sendVideoInterviewLinkResponse:',
      sendVideoInterviewLinkResponse,
    );

    return 'Interview link shared successfully.';
  }

  async createReminder(
    inputs: { reminderDuration: string },
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    console.log(
      'Function Called:  candidateProfileDataNodeObj:any',
      candidate,
    );
    const reminderTimestamp = addHoursInDate(
      new Date(),
      Number(inputs?.reminderDuration),
    );
    const reminderTimestampInIsoFormat = toIsoString(reminderTimestamp);

    console.log('Reminder Timestamp:', reminderTimestamp);
    const createOneReminderVariables = {
      input: {
        remindCandidateDuration: inputs?.reminderDuration,
        remindCandidateAtTimestamp: reminderTimestampInIsoFormat,
        candidateId:
          candidate?.id,
        name: `Reminder for ${candidate?.name} to remind in ${inputs?.reminderDuration} hours`,
        isReminderActive: true,
      },
    };

    console.log('Function Called: createReminder');
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToCreateOneReminder,
      variables: createOneReminderVariables,
    });

    const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryObj, createOneReminderVariables, apiToken);

    console.log('Response from createReminder:', response.data);

    return 'Reminder created successfully.';
  }

  async sendEmail(
    inputs: any,
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, apiToken);
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }

    const emailData: GmailMessageData = {
      sendEmailNameFrom:
        recruiterProfile.firstName + ' ' + recruiterProfile.lastName,
      sendEmailFrom: recruiterProfile.email,
      sendEmailTo: candidate?.email?.primaryEmail,
      subject: inputs?.subject || 'Email from the recruiter',
      message: inputs?.message || '',
    };

    await new SendEmailFunctionality().sendEmailFunction(emailData, apiToken);

    return 'Email sent successfully.';
  }

  async shareJD(
    inputs: any,
    candidate: CandidateNode,
    candidateJob: Job,
    chatControl: ChatControlsObjType,
    apiToken: string,
  ) {
    try {
      console.log('Function Called: inputs', inputs);
        console.log('Function Called: candidate', candidate);
      console.log('Function Called: candidateJob', candidateJob);
      console.log('Function Called: chatControl', chatControl);
      console.log('Function Called: apiToken', apiToken);
      await new ToolCallsProcessing(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.workspaceMemberProfileUnipileService,
      ).shareJDtoCandidate(candidate, candidateJob, chatControl, apiToken);
      console.log(
        'Function Called:  candidateProfileDataNodeObj:any',
        candidate,
      );
    } catch (error) {
      console.log('Error in shareJD:', error);
    }

    return 'Shared the JD with the candidate and updated the database.';
  }

  async updateCandidateProfile(
    inputs: any,
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    try {
      console.log('UPDATE CANDIDATE PROFILE CALLED AND UPDATING TO ::', inputs);
      console.log(
        'Function Called:  candidateProfileDataNodeObj:any',
        candidate,
      );
      // const status: statuses = 'RECRUITER_INTERVIEW';
      await new ToolCallsProcessing(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.workspaceMemberProfileUnipileService,
      ).updateCandidateStatus(candidate, inputs.candidateStatus, apiToken);

      return 'Updated the candidate profile.';
    } catch (error) {
      console.log('Error in updateCandidateProfile:', error);
    }
  }

  async updateAnswer(
    inputs: { question: string; answer: string },
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    // const newQuestionArray = this.questionArray
    const jobId =
      candidate?.jobs?.id;

    const { questionIdArray, questionArray } = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchQuestionsByJobId(jobId, apiToken);
    const results = fuzzy.filter(inputs.question, questionArray);
    const matches = results.map(function (el) {
      return el.string;
    });

    console.log('The matches are:', matches);
    const mostSimilarQuestion = questionIdArray?.filter(
      (questionObj) => questionObj.question == matches[0],
    );

    const AnswerMessageObj = {
      // questionsId: mostSimilarQuestion[0]?.questionId,
      candidateFieldsId: mostSimilarQuestion?.[0]?.questionId,
      name: inputs.answer,
      candidateId: candidate?.id,
    };

    await new ToolCallsProcessing(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.workspaceMemberProfileUnipileService,
    ).updateAnswerInDatabase(
      candidate,
      AnswerMessageObj,
      candidateJob,
      apiToken,
      );
    try {
      console.log(
        'Function Called:  candidateProfileDataNodeObj:any',
        candidate,
      );
      console.log('Function Called: updateAnswer');
    } catch {
      console.log('Update Answer in Database working');
    }

    return 'Updated the candidate updateAnswer.';
  }

  async scheduleMeeting(
    inputs: any,
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    console.log(
      'Function Called:  candidateProfileDataNodeObj:any',
      candidate,
    );
    const gptInputs = inputs?.inputs;

    console.log('GPT Inputs:any', gptInputs);

    console.log('Function Called: scheduleMeeting');
    const calendarEventObj: CalendarEventType = {
      summary:
        `${candidate?.name} & ${candidate?.jobs?.company?.name}` ||
        gptInputs?.summary ||
        'Meeting with the candidate',
      typeOfMeeting: gptInputs?.typeOfMeeting || 'Virtual',
      location: gptInputs?.location || 'Google Meet',
      description:
        gptInputs?.description ||
        'This meeting is scheduled to discuss the role and the company.',
      start: {
        dateTime: gptInputs?.startDateTime,
        timeZone: gptInputs?.timeZone,
      },
      end: { dateTime: gptInputs?.endDateTime, timeZone: gptInputs?.timeZone },
      attendees: [{ email: candidate?.email?.primaryEmail || '' }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    await new CalendarEmailService().createNewCalendarEvent(
      calendarEventObj,
      apiToken,
    );
    const interviewTime = [
      {
        date: new Date(gptInputs?.startDateTime).toISOString().split('T')[0],
        slots: [
          {
            startTime: new Date(gptInputs?.startDateTime)
              .toISOString()
              .split('T')[1]
              .substring(0, 5),
            endTime: new Date(gptInputs?.endDateTime)
              .toISOString()
              .split('T')[1]
              .substring(0, 5),
          },
        ],
      },
    ];
    const createClientInterviewVariables = {
      input: {
        interviewTime: interviewTime,
        candidateId:
          candidate?.id,
        interviewScheduleId:
          candidate?.jobs
            ?.interviewSchedule?.edges[0]?.node?.id,
        name: `Interview with ${candidate?.name} scheduled on ${new Date(gptInputs?.startDateTime).toISOString().split('T')[0]}`,
        jobId:
          candidate?.jobs?.id,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToCreateOneClientInterview,
      variables: createClientInterviewVariables,
    });

    await this.staticGraphQLService.executeGraphQL(graphqlQueryObj, createClientInterviewVariables, apiToken);

    await this.scheduleReminderNotifications(
      candidate,
      candidateJob,
      gptInputs?.startDateTime,
      gptInputs?.endDateTime,
      apiToken,
    );

    return 'scheduleMeeting the candidate meeting.';
  }

  private async scheduleReminderNotifications(
    candidate: CandidateNode,
    candidateJob: Job,
    meetingStartDateTime: string,
    meetingEndDateTime: string,
    apiToken: string,
  ) {
    // Import the ScheduledJobService
    const scheduledJobService = new ScheduledJobService(
      new SchedulerRegistry(),
      this.workspaceQueryService,
      this.staticGraphQLService, 
    );
    const meetingStartTime = new Date(meetingStartDateTime);

    // 1. Schedule first reminder (8:30 PM the night before)
    const nightBeforeMeeting = new Date(meetingStartTime);

    nightBeforeMeeting.setDate(nightBeforeMeeting.getDate() - 1); // One day before
    nightBeforeMeeting.setHours(20, 30, 0, 0); // 8:30 PM

    const twoHoursBeforeMeeting = new Date(meetingStartTime);

    twoHoursBeforeMeeting.setHours(twoHoursBeforeMeeting.getHours() - 2);

    const twoMinutesFromNow = new Date();

    console.log(
      `- Test reminder  time now: ${twoMinutesFromNow.toISOString()}`,
    );
    twoMinutesFromNow.setMinutes(twoMinutesFromNow.getMinutes() + 2);
    console.log(
      `- Test reminder firstInterviewReminder 2 minutes from now: ${twoMinutesFromNow.toISOString()}`,
    );
    const fourMinutesFromNow = new Date();

    fourMinutesFromNow.setMinutes(fourMinutesFromNow.getMinutes() + 4);
    console.log(
      `- Test reminder secondInterviewReminder 4 minutes from now: ${fourMinutesFromNow.toISOString()}`,
    );
    const meetingEndTime = new Date(meetingEndDateTime);
    const afterMeetingEndTime = new Date(meetingEndTime);

    afterMeetingEndTime.setMinutes(afterMeetingEndTime.getMinutes() + 5);
    const sixMinutesFromNow = new Date();

    sixMinutesFromNow.setMinutes(sixMinutesFromNow.getMinutes() + 6);
    console.log(
      `- Test reminder closeMeetingStatus 6 minutes from now: ${sixMinutesFromNow.toISOString()}`,
    );
    // Schedule the test reminder
    // Data payload for the first reminder
    const firstReminderData = {
      action: 'firstInterviewReminder',
      candidate,
      candidateJob,
      apiToken,
      meetingStartTime,
    };
    const secondReminderData = {
      action: 'secondInterviewReminder',
      candidate,
      candidateJob,
      apiToken,
      meetingStartTime,
    };
    const meetingClosureData = {
      action: 'closeMeetingStatus',
      candidate,
      candidateJob,
      apiToken,
      meetingTime: meetingStartTime,
    };

    // Schedule the reminders/ tasks
    if (process.env.NODE_ENV === 'production') {
      scheduledJobService.scheduleJobForSpecificTime(
        firstReminderData,
        nightBeforeMeeting,
      );
      scheduledJobService.scheduleJobForSpecificTime(
        secondReminderData,
        twoHoursBeforeMeeting,
      );
      scheduledJobService.scheduleJobForSpecificTime(
        meetingClosureData,
        afterMeetingEndTime,
      );
    } else {
      scheduledJobService.scheduleJobForSpecificTime(
        firstReminderData,
        twoMinutesFromNow,
      );
      scheduledJobService.scheduleJobForSpecificTime(
        secondReminderData,
        fourMinutesFromNow,
      );
      scheduledJobService.scheduleJobForSpecificTime(
        meetingClosureData,
        sixMinutesFromNow,
      );
    }

    console.log(
      `Scheduled reminders for meeting with ${candidate?.name}:`,
    );
    console.log(`- First reminder: ${nightBeforeMeeting.toISOString()}`);
    console.log(`- Second reminder: ${twoHoursBeforeMeeting.toISOString()}`);
    console.log(`- closeMeetingStatus: ${afterMeetingEndTime.toISOString()}`);
  }

  async setupSecondReminderForMeeting(
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    const candidateId =
        candidate?.id;

    await new UpdateChat(this.workspaceQueryService, this.staticGraphQLService).createInterimChatQueue(
      'secondInterviewReminder',
      candidateId,
      apiToken,
    );
  }

  async setupFirstReminderForMeeting(
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    const candidateId =
      candidate?.id;

    await new UpdateChat(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).createInterimChatQueue(
      'firstInterviewReminder',
      candidateId,
      apiToken,
    );
  }

  async getVideoInterviewTools(
    candidateJob: Job,
  ): Promise<ChatCompletionTool[]> {
    return [
      {
        type: 'function',
        function: {
          name: 'share_interview_link',
          description: 'Share the interview link with the candidate',
        },
      },
    ];
  }

  async getStartChatTools(candidateJob: Job): Promise<ChatCompletionTool[]> {
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'share_jd',
          description: 'Share the candidate JD',
        },
      },
      {
        type: 'function' as const,
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
        type: 'function' as const,
        function: {
          name: 'update_answer',
          description:
            "Update the candidate's answer based on the question asked",
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

  async getStartMeetingSchedulingTools(
    candidateJob: Job,
  ): Promise<ChatCompletionTool[]> {
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'schedule_meeting',
          description: 'Schedule a meeting with the candidate',
          parameters: {
            type: 'object',
            properties: {
              inputs: {
                type: 'object',
                description: 'Name of the candidate + Client Name',
                properties: {
                  summary: {
                    type: 'string',
                    description: 'Summary of the meeting',
                  },
                  typeOfMeeting: {
                    type: 'string',
                    description:
                      'Type of the meeting, can be either Virtual or In-Person. Default is Virtual.',
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
                    description:
                      'Start date and time of the meeting in ISO 8601 format',
                  },
                  endDateTime: {
                    type: 'string',
                    format: 'date-time',
                    description:
                      'End date and time of the meeting in ISO 8601 format',
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
        type: 'function' as const,
        function: {
          name: 'update_answer',
          description:
            "Update the candidate's answer based on the question asked",
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
      // {
      //   type: 'function',
      //   function: {
      //     name: 'create_reminder',
      //     description: 'Create a reminder for the candidate',
      //     parameters: {
      //       type: 'object',
      //       properties: {
      //         reminderDuration: {
      //           type: 'string',
      //           description: 'Number of hours for the reminder.',
      //         },
      //       },
      //       required: ['reminderDuration', 'hours'],
      //     },
      //   },
      // },
    ];

    return tools;
  }

  getTimeManagementTools(): ChatCompletionTool[] {
    return [
      {
        type: 'function' as const,
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
}
