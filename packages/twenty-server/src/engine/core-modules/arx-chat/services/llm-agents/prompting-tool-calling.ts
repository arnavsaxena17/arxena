import { shareJDtoCandidate, updateAnswerInDatabase, updateCandidateStatus } from './tool-calls-processing';
import * as allDataObjects from '../data-model-objects';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../candidate-engagement/update-chat';
import fuzzy from 'fuzzy';
import CandidateEngagementArx from '../candidate-engagement/check-candidate-engagement';
import { CalendarEventType } from '../../../calendar-events/services/calendar-data-objects-types';
import { CalendarEmailService } from '../candidate-engagement/calendar-email';
import { MailerController } from '../../../gmail-sender/gmail-sender.controller';
import { SendEmailFunctionality } from '../candidate-engagement/send-gmail';
import { GmailMessageData } from 'src/engine/core-modules/gmail-sender/services/gmail-sender-objects-types';
import * as allGraphQLQueries from '../candidate-engagement/graphql-queries-chatbot';
import { addHoursInDate, axiosRequest, toIsoString } from '../../utils/arx-chat-agent-utils';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { OpenAI } from "openai";
import { StageWiseClassification } from './get-stage-wise-classification';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const commaSeparatedStatuses = allDataObjects.statusesArray.join(', ');

const recruiterProfile = allDataObjects.recruiterProfile;
// const candidateProfileObjAllData =  candidateProfile
const availableTimeSlots = '12PM-3PM, 4PM -6PM on the 24th and 25th August 2024.';


export class ToolsForAgents {

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService
  ) {}
  currentConversationStage = z.object({
    stageOfTheConversation: z.enum(allDataObjects.allStatusesArray)
  });
  
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



  
  // async getConversationStageHistoryClassificationPrompt(){
  //   const STAGE_SYSTEM_PROMPT = `
  //   You are assisting with determining the appropriate stage in a recruiting conversation based on the interaction history with a candidate. Your task is to decide whether to maintain the current stage or progress to the next one based on the dialogue so far.
  //   Here are the stages to choose from:
  //   ${await this.convertToBulletPoints(allDataObjects.allStatusesArray)}
  //   When deciding the stage:
  //   Your response should be a single status of any of ${allDataObjects.allStatusesArray.join(', ')}, representing the appropriate stage.
  //   If there is no conversation history or only a greeting, only start chat is the messaged, default to stage "ONLY_ADDED_NO_CONVERSATION".
  //   If the initial introduction message has been sent by the recruiter and there has been no response since then, return with the status, "CONVERSATION_STARTED_HAS_NOT_RESPONDED".
  //   If the candidate has been shared a JD and hasn't responded after that, return with the status, "SHARED_JD_HAS_NOT_RESPONDED".
  //   If the candidate doesn't want to relocate, return with the status, "CANDIDATE_DOES_NOT_WANT_TO_RELOCATE". 
  //   If the candidate has evidenced interest in the job, responded to questions asked by the recruiter and has asked for time to speak or to setup time to speak and has evidenced interest speaking to the recruiter, return with the status, "CANDIDATE_IS_KEEN_TO_CHAT".
  //   If the questions have been asked by the recruiter and the candidate has not responded return the stage as "STOPPED_RESPONDING_ON_QUESTIONS".
  //   If the candidate has followed up after the initial setup fo the chat return the stage as "CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT".
  //   If the candidate has shown interest, answered all questions and has been asked to be contacted later, return the stage as "CONVERSA TION_CLOSED_TO_BE_CONTACTED".
  //   If the recruiter has said that they will get back to the candidate, return the stage as "CONVERSATION_CLOSED_TO_BE_CONTACTED".
  //   `;
  //   return STAGE_SYSTEM_PROMPT;
  // }

  async getQuestionsToAsk(personNode: allDataObjects.PersonNode,  apiToken:string) {
    // const questions = ["What is your current & expected CTC?", "Who do you report to and which functions report to you?", "Are you okay to relocate to {location}?"];
    // const location = "Surat";
    // const formattedQuestions = questions.map((question, index) =>  `${index + 1}. ${question.replace("{location}", location)}`).join("\n");
    // return formattedQuestions
    const jobId = personNode?.candidates?.edges[0]?.node?.jobs?.id;
    console.log("Job Name:", personNode?.candidates?.edges[0]?.node?.jobs?.name)
    // console.log('This is the job Id:', jobId);
    const { questionArray, questionIdArray } = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchQuestionsByJobId(jobId,apiToken);
    // Hardcoded questions to ask if no questions are found in the database
    if (questionArray.length == 0) {
      return ['Are you okay to relocate to {location}?','What is your current & expected CTC?', 'What is your notice period?'];
    }
    return questionArray;
  }


  async getVideoInterviewPrompt(personNode: allDataObjects.PersonNode) {
    const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;
    const current_job_position = jobProfile.name;

    const candidate_conversation_summary = "The candidate has mentioned that he/ she is interested in the role. They are okay to relocate and their salary falls in the bracket that the client is hiring for";
    return `You will drive the conversation with candidates like a recruiter. Your goal is to guide candidates to appear for a video interview for the role of ${current_job_position}. 
    Following is the summary of the conversations that have happened with the candidate for reference :
    ${candidate_conversation_summary}
    First you start with telling the candidate that you discussed internally and liked their candidature and would like to get to know more about them.
    Explain to them telling the candidate the interviewing process of the role comprises of the following steps - 
    1. Video Interview - HR Round
    2. First Round with Client's Executive Team (Google Meet)
    3. Final Round with Client's Leadership (In Person)
    Only if they ask, let them know that a video interview is the process agreed with the client and allows the candidates to flexibly answer HR type questions at their convenience without the hassle of scheduling first round meetings.
    Ask them if they would be okay to do a 15 minute video interview with 3-5 questions at this stage?
    If they ask what kind of questions are in the video interview, let them know that there would be generic HR questions on their experience, motivations and interests.
    If yes, then share with them the link to the video interview. Also tell them that you have shared it on their email. 
    If they say that they would like to speak or have a call first, tell them that we can have a more focussed call subsequent to the quick 15 minute video interview.
    Parallely, share the share the interview link with the candidate by calling the function "share_interview_link".
    Ask them to let you know when the interview is done. 
    Once they let you know that it is done, thank them and then do not respond to subsequent chats.
    Be direct, firm and to the point. No need to be overly polite or formal. Do not sound excited.
    Your reponses will not show enthusiasm or joy or excitement. You will be neutral and to the point.
    Do not respond or restart the conversation if you have already told the candidate that you would get back to them.
    Sometimes candidates will send forwards and irrelevant messages. You will have to ignore them. If the candidate unnecessarily replies and messages, you will reply with "#DONTRESPOND#" exact string without any text around it.
    You will not indicate any updates to the candidate. The candidate might ask for feedback, you will not provide any feedback. They can ask any queries unrelated to the role or the background inside any related questions. You will not respond to any queries unrelated to the role.
    If you do not wish to respond to the candidate, you will reply with "#DONTRESPOND#" exact string without any text around it.
    If you do not have to respond, you will reply with "#DONTRESPOND#" exact string without any text around it.
    Your first message when you receive the prompt "startVideoInterview" is: Hey ${personNode.name.firstName},
    We like your candidature and are keen to know more about you. We would like to start with a quick 15 minute video interview as part of the client's hiring process. 
    Would you be available for the same?
    `
  }

  async getStartChatPrompt(personNode: allDataObjects.PersonNode,  apiToken:string) {
    let receiveCV
    receiveCV = `If they have shared their interest after going through the JD, ask the candidate to share a copy of their updated CV prior to the meeting.
    If they say that you can take the CV from naukri, tell them that you would require a copy for records directly from them for candidate confirmation purposes.`
    receiveCV = ``
    const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;
    const questionArray = await this.getQuestionsToAsk(personNode,  apiToken);
    const formattedQuestions = '\t'+questionArray.map((question, index) => `${index + 1}. ${question}`).join('\n\t');
    const SYSTEM_PROMPT = `
    You will drive the conversation with candidates like the recruiter. Your goal is to assess the candidates for interest and fitment.
    The conversations are happening on whatsapp. So be short, conversational and to the point.
    You will start the chat with asking if they are interested and available for a call.
    They may either ask questions or show interest or provide a time slot. Do not schedule a meeting before he is fully qualified.
    Next, share the JD with him/ her by calling the function "share_jd". Ask them if they would be keen on the role. Ask them if they are interested in the role only after sharing the JD.
    ${receiveCV}
    Your screening questions for understanding their profile are :
    ${formattedQuestions}
    Ask these questions in any order one by one and ensure a natural continuous conversation. Call the function update_answer after the candidate answers each question.
    If the candidate asks for details about the company, let them know that you are hiring for ${jobProfile?.companies?.name}, ${jobProfile?.companies?.descriptionOneliner}
    If the candidate's answer is not specific enough, do not update the answer but ask the candidate to be more specific.
    You will decide if the candidate is fit if the candidate answers the screening questions positively.
    When you start screening, also call the function "update_candidate_profile" to update the candidate profile as "SCREENING".
    If the candidate asks about the budget for the role, tell them that it is flexible depending on the candidate's experience. Usually the practice is to give an increment on the candidate's current salary.
    If the candidate has shown interest and is fit, you will call the function "update_candidate_profile" and update the status as "INTERESTED".
    If the candidate has sent an attachment or a resume, you will you will call the function "update_candidate_profile" and update the status as "CV_RECEIVED".
    If the candidate is not interested, you will call the function "update_candidate_profile" and update the status as "NOT_INTERESTED".
    If the candidate is interested but not fit, you will call the function "update_candidate_profile" and update the candidate profile with the status "NOT_FIT".
    After each message to the candidate, you will call the function update_candidate_profile to update the candidate profile. The update will comprise of one of the following updates - ${commaSeparatedStatuses}.
    If the candidate asks you for your email address to share the CV, share your email as ${recruiterProfile.email}. After sharing your email, as the candidate to share their resume on whatsapp as well.
    After all the screening questions are answered, you will tell the candidate that you would get back to them with a few time slots shortly and setup a call. You can call the function "update_candidate_profile" to update the candidate profile as "RECRUITER_INTERVIEW".
    After this, you will not respond to the candidate until you have the time slots. You will not respond to any queries until you have the timeslots.
    If the candidate asks any questions that don't know the answer of, you will tell them that you will get back to them with the answer.
    If the candidate says that the phone number is not reachable or they would like to speak but cannot connect, let them know that you will get back to them shortly.
    Sometimes candidates will send forwards and irrelevant messages. You will have to ignore them. If the candidate unnecessarily replies and messages, you will reply with "#DONTRESPOND#" exact string without any text around it.
    You will not indicate any updates to the candidate. You will only ask questions and share the JD. You will not provide any feedback to the candidate. The candidate might ask for feedback, you will not provide any feedback. They can ask any queries unrelated to the role or the background inside any related questions. You will not respond to any queries unrelated to the role.
    Apart from your starting sentence, Be direct, firm and to the point. No need to be overly polite or formal. Do not sound excited.
    Your reponses will not show enthusiasm or joy or excitement. You will be neutral and to the point.
    Do not respond or restart the conversation if you have already told the candidate that you would get back to them.
    If you have discussed scheduling meetings, do not start screening questions. 
    If you have had a long discussion, do not repeat the same questions and do not respond. 
    If you believe that you have received only the latter part of the conversation without introductions and screening questions have not been covered, then check if the candidate has been told that you will get back to them. If yes, then do not respond. 
    If you do not wish to respond to the candidate, you will reply with "#DONTRESPOND#" exact string without any text around it.
    If you do not have to respond, you will reply with "#DONTRESPOND#" exact string without any text around it.
    Your first message when you receive the prompt "startChat" is: Hey ${personNode.name.firstName},
    I'm ${recruiterProfile.first_name}, ${recruiterProfile.job_title} at ${recruiterProfile.job_company_name}, ${recruiterProfile.company_description_oneliner}.
    I'm hiring for a ${jobProfile.name} role for ${jobProfile?.companies?.descriptionOneliner} based out of ${jobProfile.jobLocation} and got your application on my job posting. I believe this might be a good fit.
    Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime today?
    `;
    return SYSTEM_PROMPT;
  }

  async getSystemPrompt(personNode: allDataObjects.PersonNode,chatControl:allDataObjects.chatControls,  apiToken:string) {
    console.log("This is the chatControl:", chatControl)
    if (chatControl == 'startVideoInterviewChat') {
      return this.getVideoInterviewPrompt(personNode);
    }
    else if (chatControl === "startChat"){
      return this.getStartChatPrompt(personNode,  apiToken);
    }
    else{
      return this.getStartChatPrompt(personNode,  apiToken);
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

  getAvailableFunctions() {
    return {
      share_jd: this.shareJD,
      update_candidate_profile: this.updateCandidateProfile,
      update_answer: this.updateAnswer,
      schedule_meeting: this.scheduleMeeting,
      send_email: this.sendEmail,
      create_reminder: this.createReminder,
      share_interview_link: this.shareInterviewLink,

    };
  }
  async shareInterviewLink(inputs: any, personNode: allDataObjects.PersonNode) {
    const jobProfile = personNode?.candidates?.edges[0]?.node?.jobs;
    const interviewLink = 'https://meet.google.com/abc-def-ghi';
    const interviewLinkMessage = `Here is the link to the interview: ${interviewLink}`;
    await new SendEmailFunctionality().sendEmailFunction({
      sendEmailFrom: recruiterProfile?.email,
      sendEmailTo: personNode?.email,
      subject: 'Interview Link',
      message: interviewLinkMessage,
    });
    return 'Interview link shared successfully.';
  }

  async createReminder(inputs: { reminderDuration: string }, candidateProfileDataNodeObj: allDataObjects.PersonNode,  apiToken:string) {
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

  async shareJD(inputs: any, personNode: allDataObjects.PersonNode, chatControl: allDataObjects.chatControls,  apiToken:string) {
    try {
      console.log('Function Called: shareJD');
      await shareJDtoCandidate(personNode,  chatControl,  apiToken);
      console.log('Function Called:  candidateProfileDataNodeObj:any', personNode);
    } catch {
      debugger;
    }
    return 'Shared the JD with the candidate and updated the database.';
  }
  

  async updateCandidateProfile(inputs: any, personNode: allDataObjects.PersonNode,  apiToken:string) {
    try {
      console.log('UPDATE CANDIDATE PROFILE CALLED AND UPDATING TO ::', inputs);
      console.log('Function Called:  candidateProfileDataNodeObj:any', personNode);
      // const status: allDataObjects.statuses = 'RECRUITER_INTERVIEW';
      await updateCandidateStatus(personNode, inputs.candidateStatus,  apiToken);
      return 'Updated the candidate profile.';
    } catch (error) {
      console.log('Error in updateCandidateProfile:', error);
    }
  }

  async updateAnswer(inputs: { question: string; answer: string }, candidateProfileDataNodeObj: allDataObjects.PersonNode,  apiToken:string) {
    // const newQuestionArray = this.questionArray
    const jobId = candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.jobs?.id;

    const { questionIdArray, questionArray } = await new FetchAndUpdateCandidatesChatsWhatsapps(this.workspaceQueryService).fetchQuestionsByJobId(jobId,  apiToken);
    const results = fuzzy.filter(inputs.question, questionArray);
    const matches = results.map(function (el) {
      return el.string;
    });
    console.log('The matches are:', matches);
    const mostSimilarQuestion = questionIdArray.filter(questionObj => questionObj.question == matches[0]);
    const AnswerMessageObj = { questionsId: mostSimilarQuestion[0]?.questionId, name: inputs.answer, candidateId: candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.id };

    await updateAnswerInDatabase(candidateProfileDataNodeObj, AnswerMessageObj,  apiToken);
    try {
      console.log('Function Called:  candidateProfileDataNodeObj:any', candidateProfileDataNodeObj);
      console.log('Function Called: updateAnswer');
    } catch {
      console.log('Update Answer in Database working');
    }
    return 'Updated the candidate updateAnswer.';
  }

  async scheduleMeeting(inputs: any, candidateProfileDataNodeObj: allDataObjects.PersonNode,  apiToken:string) {
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



  async getTools(chatControl){
    if (chatControl === 'startChat') {
      return this.getStartChatTools()
    }
    else if (chatControl === 'startVideoInterviewChat') {
      return this.getVideoInterviewTools()
    }
  }

  async getVideoInterviewTools(){
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

  async getStartChatTools() {
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


