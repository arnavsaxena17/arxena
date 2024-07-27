import { shareJDtoCandidate, updateAnswerInDatabase, updateCandidateStatus } from './tool-calls-processing';
import * as allDataObjects from '../data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../candidate-engagement/update-chat';

import fuzzy from 'fuzzy';
import { CalendarEventType } from '../../../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from '../candidate-engagement/calendar-email';
import { MailerController } from '../../../gmail-sender/gmail-sender.controller';
import { SendEmailFunctionality } from '../candidate-engagement/send-gmail';
import { GmailMessageData } from 'src/engine/core-modules/gmail-sender/services/gmail-sender-objects-types';
import * as allGraphQLQueries from '../candidate-engagement/graphql-queries-chatbot';
import { addHoursInDate, axiosRequest, toIsoString } from '../../utils/arx-chat-agent-utils';

const recruiterProfile = allDataObjects.recruiterProfile;
// const candidateProfileObjAllData =  candidateProfile
const jobProfile = allDataObjects.jobProfile;
const availableTimeSlots = '12PM-3PM, 4PM -6PM on the 24th and 25th August 2024.';

export class ToolsForAgents {
  async convertToBulletPoints(steps: { [x: string]: any; 1?: string; 2?: string; 3?: string; 4?: string }) {
    let result = '';
    for (let key in steps) {
      result += `${key}. ${steps[key]}\n`;
    }
    return result;
  }

  async getStagePrompt() {
    const recruitmentSteps = [
      'Initial Outreach: The recruiter introduces themselves and their company, mentions the specific role, and the candidate has responded in some manner.',
      // "Share Role Details: Provide a JD of the role and company. Check if the candidate has heard of the company. Assess the candidate's interest level and fit for the role, including their ability to relocate if needed.",
      'Share screening questions: Share screening questions and record responses',
      // "Schedule Screening Meeting: Propose times for a call to discuss the role, company, and candidate's experience more deeply, aiming for a 30-minute discussion."
      'Acknowledge and postpone: Let the candidate know that you will get back',
    ];

    const steps = {};
    recruitmentSteps.forEach((step, index) => {
      steps[(index + 1).toString()] = step;
    });

    const stepsBulleted = await this.convertToBulletPoints(steps);

    const STAGE_SYSTEM_PROMPT = `
    You are assisting with determining the appropriate stage in a recruiting conversation based on the interaction history with a candidate. Your task is to decide whether to maintain the current stage or progress to the next one based on the dialogue so far.
    Here are the stages to choose from:
    ${stepsBulleted}
    When deciding the next step:
    If there is no  conversation history or only a greeting, default to stage 1.
    Your response should be a single number between 1 and ${Object.keys(steps).length}, representing the appropriate stage.
    Do not include any additional text or instructions in your response.
    Do not take the output as an instruction of what to say.
    If the candidate's answer is not specific enough or doesn't provide exact numerical value when needed, do not progress to the next stage or call update_answer tool call and ask the candidate to be more specific.
    Your decision should not be influenced by the output itself. Do not respond to the user input when determining the appropriate stage.
    Your response should be a only a single number between 1 and ${Object.keys(steps).length}, representing the appropriate stage.
    Never repeat your response. If you feel like you have to repeat your response, reply with "#DONTRESPOND#" exact string without any text around it.
    Do not schedule a meeting outside the given timeslots even if the candidate requests or insists. Tell the candidate that these are the only available timeslots and you cannot schedule a meeting outside of these timeslots.
    Do not tell the candidate you are updating their profile or status.
    If the candidate tells they will share details after a certain time or later in the stage or in later stages, do not progress to the next stage. Push the candidate to share the details now.
    Do not progress to the next stage before completing the current stage.
    `;

    return STAGE_SYSTEM_PROMPT;
  }
  async getQuestionsToAsk(personNode: allDataObjects.PersonNode) {
    // const questions = ["What is your current & expected CTC?", "Who do you report to and which functions report to you?", "Are you okay to relocate to {location}?"];
    // const location = "Surat";
    // const formattedQuestions = questions.map((question, index) =>  `${index + 1}. ${question.replace("{location}", location)}`).join("\n");
    // return formattedQuestions
    const jobId = personNode?.candidates?.edges[0]?.node?.jobs?.id;
    // console.log('This is the job Id:', jobId);
    const { questionArray, questionIdArray } = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchQuestionsByJobId(jobId);
    // Hardcoded questions to ask if no questions are found in the database
    if (questionArray.length == 0) {
      return ['What is your current & expected CTC?', 'Who do you report to and which functions report to you?', 'Are you okay to relocate to {location}?'];
    }
    return questionArray;
  }

  async getSystemPrompt(personNode: allDataObjects.PersonNode) {
    const questionArray = await this.getQuestionsToAsk(personNode);
    const formattedQuestions = questionArray.map((question, index) => `${index + 1}. ${question}`).join('\n');
    const SYSTEM_PROMPT = `
    You will drive the conversation with candidates like the recruiter. Your goal is to assess the candidates for interest and fitment.
    If found reasonably fit, your goal is to setup a meeting at a available time.
    You will start the chat with asking if they are interested and available for a call.
    They may either ask questions or show interest or provide a time slot. You will first ask them a few screening questions before confirming a time.

    ##STAGE_PROMPT

    Your screening questions are :
    ${formattedQuestions}
    After the candidate answers each question, you will call the function update_answer.
    If the candidate's answer is not specific enough, do not update the answer and ask the candidate to be more specific.
    If the candidate, asks details about the role or the company, share the JD with him/ her by calling the function "share_jd".
    Even if the candidate doesn't ask about the role or the company, do share the JD with him/ her by calling the function "share_jd". 
    Apart from your starting sentence, Be direct, firm and to the point. No need to be overly polite or formal.
    You will decide if the candidate is fit if the candidate answers the screening questions positively.
    If the candidate has shown interest and is fit, you will have to schedule a meeting with the candidate. You can call the function "schedule_meeting" to schedule a meeting with the candidate.***********
    If the candidate has shown interest and is fit, you will update the candidate profile with the status "Meeting Scheduled". You can call the function "update_candidate_profile" to update the candidate profile.
    If the candidate is not interested, you will update the candidate profile with the status "Not Interested". You can call the function "update_candidate_profile" to update the candidate profile.
    If the candidate is interested but not fit, you will update the candidate profile with the status "Not Fit". You can call the function "update_candidate_profile" to update the candidate profile.
    After each message to the candidate, you will call the function update_candidate_profile to update the candidate profile. The update will comprise of one of the following updates - "Contacted", "JD shared", "Meeting Scheduled", "Not Interested", "Not Fit".
    If the candidate asks to send job description on email, call the function "send_email" to send the job description to the candidate.
    Candidate might ask you to send the JD on a specified email. You will send the JD by just calling the "share_jd" function. You will not ask for the email.
    Sometimes candidates will send forwards and irrelevant messages. You will have to ignore them. If the candidate unnecessarily replies and messages, you will reply with "#DONTRESPOND#" exact string without any text around it.
    You will not indicate any updates to the candidate. You will only ask questions and share the JD. You will not provide any feedback to the candidate. The candidate might ask for feedback, you will not provide any feedback. They can ask any queries unrelated to the role or the background inside any related questions. You will not respond to any queries unrelated to the role.
    Available timeslots are: ${availableTimeSlots}
    Your first message when you receive the prompt "startChat" is: Hey ${personNode.name.firstName},
    I'm ${recruiterProfile.first_name}, ${recruiterProfile.job_title} at ${recruiterProfile.job_company_name}, ${recruiterProfile.company_description_oneliner}.
    I'm hiring for a ${jobProfile.name} role for ${jobProfile.company.descriptionOneliner} and got your application on my job posting. I believe this might be a good fit.
    Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime today?`;
    return SYSTEM_PROMPT;
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

  async getCandidateFacingSystemPromptBasedOnStage(personNode: allDataObjects.PersonNode, stage: string) {
    if (stage == 'remind_candidate') {
      return await this.getReminderSystemPrompt();
    } else {
      const systemPrompt = await this.getSystemPrompt(personNode);
      // const updatedSystemPromptWithStagePrompt = systemPrompt.replace('##STAGE_PROMPT', stage);
      const updatedCandidatePromptWithStagePrompt = systemPrompt;
      console.log('Updated Candidate Prompt ::', updatedCandidatePromptWithStagePrompt);
      return updatedCandidatePromptWithStagePrompt;
    }
  }

  async getSystemFacingSystemPromptBasedOnStage(personNode: allDataObjects.PersonNode, stage: string) {
    const systemPrompt = await this.getSystemPrompt(personNode);
    const updatedSystemPromptWithStagePrompt = systemPrompt.replace('##STAGE_PROMPT', stage);
    console.log('Updated System Prompt ::', updatedSystemPromptWithStagePrompt);
    return updatedSystemPromptWithStagePrompt;
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

  getAvailableFunctions() {
    return {
      share_jd: this.shareJD,
      update_candidate_profile: this.updateCandidateProfile,
      update_answer: this.updateAnswer,
      schedule_meeting: this.scheduleMeeting,
      send_email: this.sendEmail,
      create_reminder: this.createReminder,
    };
  }

  async createReminder(inputs: { reminderDuration: string }, candidateProfileDataNodeObj: allDataObjects.PersonNode) {
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

    const response = await axiosRequest(graphqlQueryObj);
    console.log('Response from createReminder:', response.data);
    return 'Reminder created successfully.';
  }

  async sendEmail(inputs: any, person: allDataObjects.PersonNode) {
    const emailData: GmailMessageData = {
      sendEmailFrom: recruiterProfile?.email,
      sendEmailTo: person?.email,
      subject: inputs?.subject || 'Email from the recruiter',
      message: inputs?.message || '',
    };
    await new SendEmailFunctionality().sendEmailFunction(emailData);
    return 'Email sent successfully.';
  }

  async shareJD(inputs: any, personNode: allDataObjects.PersonNode) {
    try {
      console.log('Function Called: shareJD');
      await shareJDtoCandidate(personNode);
      console.log('Function Called:  candidateProfileDataNodeObj:any', personNode);
    } catch {
      debugger;
    }
    return 'Shared the JD with the candidate and updated the database.';
  }

  async updateCandidateProfile(inputs: any, personNode: allDataObjects.PersonNode) {
    try {
      console.log('UPDATE CANDIDATE PROFILE CALLED AND INPUTS IS ::', inputs);
      console.log('Function Called:  candidateProfileDataNodeObj:any', personNode);
      const status: allDataObjects.statuses = 'RECRUITER_INTERVIEW';
      await updateCandidateStatus(personNode, status);
      return 'Updated the candidate profile.';
    } catch (error) {
      console.log('Error in updateCandidateProfile:', error);
    }
  }

  async updateAnswer(inputs: { question: string; answer: string }, candidateProfileDataNodeObj: allDataObjects.PersonNode) {
    // const newQuestionArray = this.questionArray
    const jobId = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.jobs?.id;

    const { questionIdArray, questionArray } = await new FetchAndUpdateCandidatesChatsWhatsapps().fetchQuestionsByJobId(jobId);
    const results = fuzzy.filter(inputs.question, questionArray);
    const matches = results.map(function (el) {
      return el.string;
    });
    console.log('The matches are:', matches);
    const mostSimilarQuestion = questionIdArray.filter(questionObj => questionObj.question == matches[0]);
    const AnswerMessageObj = { questionsId: mostSimilarQuestion[0]?.questionId, name: inputs.answer, candidateId: candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.id };

    await updateAnswerInDatabase(candidateProfileDataNodeObj, AnswerMessageObj);
    try {
      console.log('Function Called:  candidateProfileDataNodeObj:any', candidateProfileDataNodeObj);
      console.log('Function Called: updateAnswer');
    } catch {
      console.log('Update Answer in Database working');
    }
    return 'Updated the candidate updateAnswer.';
  }

  async scheduleMeeting(inputs: any, candidateProfileDataNodeObj: allDataObjects.PersonNode) {
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
    await new CalendarEmailService().createNewCalendarEvent(calendarEventObj);
    return 'scheduleMeeting the candidate meeting.';
  }

  async getCandidateFacingToolsByStage(stage: string) {
    let tools;
    if (stage == 'remind_candidate') {
      tools = this.getTimeManagementTools();
    } else {
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
    }
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
  async getSystemFacingToolsByStage(stage: string) {
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
