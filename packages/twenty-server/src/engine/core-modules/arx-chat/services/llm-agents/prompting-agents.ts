import {
    allStatusesArray,
    CandidateNode,
    graphqlQueryToFetchPrompts,
    Job,
    statusesArray
} from 'twenty-shared';
import { z } from 'zod';

import { FilterCandidates } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/filter-candidates';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { NameProcessor } from 'src/engine/core-modules/workspace-modifications/object-apis/data/nameProcessor';
import { prompts } from 'src/engine/core-modules/workspace-modifications/object-apis/data/prompts';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const commaSeparatedStatuses = statusesArray.join(', ');

// const candidateProfileObjAllData =  candidateProfile

export class PromptingAgents {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}
  currentConversationStage = z.object({
    stageOfTheConversation: z.enum(allStatusesArray),
  });

  async convertToBulletPoints(steps: {
    [x: string]: any;
    1?: string;
    2?: string;
    3?: string;
    4?: string;
  }) {
    let result = '';

    for (const key in steps) {
      result += `${key}. ${steps[key]}\n`;
    }

    return result;
  }

  async getQuestionsToAsk(
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    let questions: string[] = [];
    const location = candidateJob.jobLocation;
    // const questions = ["What is your current & expected CTC?", "Who do you report to and which functions report to you?", "Are you okay to relocate to {location}?"];
    // const location = "Surat";
    // const formattedQuestions = questions.map((question, index) =>  `${index + 1}. ${question.replace("{location}", location)}`).join("\n");
    // return formattedQuestions
    const jobId = candidate?.jobs?.id;

    console.log(
      'Job Name:',
      candidate?.jobs?.name,
    );
    const { questionArray, questionIdArray } = await new FilterCandidates(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchQuestionsByJobId(jobId, apiToken);
    // Hardcoded questions to ask if no questions are found in the database

    const hardCodedQuestions = [
      'Are you okay to relocate to {location}?',
      'What is your current & expected CTC?',
      'What is your notice period?',
    ];

    if (questionArray.length == 0) {
      questions = hardCodedQuestions;
    } else {
      questions = questionArray;
    }
    if (candidateJob.name == 'Transcom') {
      questions = [
        'What is your current and expected CTC?',
        "This is an in-office role - Are you okay to work in a shift based out of Transcom's Kharadi office?",
        'What is your notice period/ How soon can you join?',
        'What is your Aadhaar Number?',
      ];
    }
    const formattedQuestions = questions.map(
      (question, index) =>
        `${index + 1}. ${question.replace('{location}', location)}`,
    );

    console.log('Final Formatted questions::', formattedQuestions);

    return formattedQuestions;
  }

  async getVideoInterviewPrompt(
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
      const jobProfile = candidate?.jobs;
    const current_job_position = jobProfile.name;
    const candidate_conversation_summary =
      'The candidate has mentioned that he/ she is interested in the role. They are okay to relocate and their salary falls in the bracket that the client is hiring for';
    // const VIDEO_INTERVIEW_PROMPT =

    const variables = {
      candidate_conversation_summary: candidate_conversation_summary,
      current_job_position: current_job_position,
      jobProfile: jobProfile,
      candidate: candidate,
    };

    console.log('Generated system prompt for getVideoInterviewPrompt:');
    const VIDEO_INTERVIEW_PROMPT_STRINGIFIED =
      await this.getPromptByJobIdAndName(
        jobProfile.id,
        'VIDEO_INTERVIEW_PROMPT',
        apiToken,
      );
    const VIDEO_INTERVIEW_PROMPT = this.replaceTemplateVariables(
      VIDEO_INTERVIEW_PROMPT_STRINGIFIED,
      variables,
    );

    return VIDEO_INTERVIEW_PROMPT;
  }

  async getPromptByJobIdAndName(
    jobId: string,
    promptName: string,
    apiToken: string,
  ) {
    console.log('promptName to fetch for jobId::', jobId, promptName);

    try {
      const response = await this.staticGraphQLService.executeGraphQL(graphqlQueryToFetchPrompts, {
        filter: { jobId: { eq: jobId }, name: { ilike: `%${promptName}%` } },
        limit: 1,
        orderBy: [{ position: 'AscNullsFirst' }],
      }, apiToken);
      const promptsFromDB = response.data.data.prompts.edges;

      if (promptsFromDB.length > 0) {
        return promptsFromDB[0].node.prompt;
      } else {
        const prompt = prompts.find(prompt => prompt.name === promptName);
        if (prompt) {
          return prompt.prompt;
        } else {
          throw new Error('No prompt found for the given jobId and name.');
        }
      }
    } catch (error) {
      console.error('Error fetching prompt:', error);
      throw error;
    }
  }

  replaceTemplateVariables(
    template: string,
    variables: Record<string, any>,
  ): string {
    const templateVariables = template.replace(
      /\${([^}]+)}/g,
      (match, path) => {
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
      },
    );
    const cleanedTemplate = templateVariables.replace(
      /\\(?!\n)(?!t)(?!r)(?!b)(?!f)(?!v)/g,
      '',
    );


    return cleanedTemplate;
  }

  async getStartChatPrompt(
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    let receiveCV;

    receiveCV = `If they have shared their interest after going through the JD, ask the candidate to share a copy of their updated CV prior to the meeting.
    If they say that you can take the CV from naukri, tell them that you would require a copy for records directly from them for candidate confirmation purposes.`;
    receiveCV = ``;
    const questionArray = await this.getQuestionsToAsk(
      candidate,
      candidateJob,
      apiToken,
    );
    const filteredQuestionArray = questionArray.filter(
      (question) => !question.toLowerCase().includes('aadhaar'),
    );

    console.log('filteredQuestionArray::', filteredQuestionArray);
    const formattedQuestions =
      '\t' +
      filteredQuestionArray
        .map((question, index) => `${index + 1}. ${question}`)
        .join('\n\t');

    console.log('formattedQuestions::', formattedQuestions);
    let workingConditions = ``;

    if (candidateJob.name.includes('customer')) {
      workingConditions = `
          - 6-day working week with 1 rotational week off.
          - Last logout time for females: 8 pm.
          - Self-traveling required.
          - Location: Kharadi, Pune.`;
    } else if (candidateJob.name.includes('recruit')) {
      workingConditions = `
      - 6-day working week with 1 rotational week off.
      - Self-traveling required.
      - Location: Chennai.`;
    }

    let mannerOfAskingQuestions;

    mannerOfAskingQuestions =
      'Ask these questions in any order one by one and ensure a natural continuous conversation.';
    mannerOfAskingQuestions =
      'Ask these questions in a single message and ask the candidate to answer each of them.';

    const recruiterProfile = await new RecruiterProfileService(this.staticGraphQLService).getRecruiterProfileByJob(candidateJob, apiToken);
    if (!recruiterProfile) {
      throw new Error('Recruiter profile not found for job');
    }


    // Process candidate name using NameProcessor
    const nameProcessor = new NameProcessor();
    const processedName = nameProcessor.processName(candidate.name);
    const candidateWithProcessedName = {
      ...candidate,
      firstName: nameProcessor.masterDataJson.first_name,
      lastName: nameProcessor.masterDataJson.last_name
    };

    const dayText = this.getCallAvailabilityDayText();
    const variables = {
      candidate: candidateWithProcessedName,
      jobProfile: candidate?.jobs,
      recruiterProfile: recruiterProfile,
      receiveCV: receiveCV,
      formattedQuestions: formattedQuestions,
      mannerOfAskingQuestions: mannerOfAskingQuestions,
      workingConditions: workingConditions,
      dayText,
    };

    const SYSTEM_PROMPT_STRINGIFIED = await this.getPromptByJobIdAndName(
      candidateJob.id,
      'START_CHAT_PROMPT',
      apiToken,
    );
    const SYSTEM_PROMPT = this.replaceTemplateVariables(
      SYSTEM_PROMPT_STRINGIFIED,
      variables,
    );

    const firstChatMessage = this.buildStartChatFirstMessage(variables);
    const SYSTEM_PROMPT_WITH_FORMATTING = `${SYSTEM_PROMPT.trim()}

        For all WhatsApp messages, put each logical sentence or paragraph on its own line. Use a blank line between the greeting, introduction, role pitch, and call-to-action. Never send one long single-line wall of text.
        Your first message when you receive the prompt "startChat" must be exactly:
${firstChatMessage}`;

    console.log('Generated getStartChatPrompt prompt:', SYSTEM_PROMPT_WITH_FORMATTING);

    return SYSTEM_PROMPT_WITH_FORMATTING;
  }

  private getCallAvailabilityDayText(): 'today' | 'tomorrow' {
    const currentISTTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
    });
    const currentHour = new Date(currentISTTime).getHours();

    return currentHour < 17 ? 'today' : 'tomorrow';
  }

  private buildStartChatFirstMessage(variables: {
    candidate: { firstName?: string };
    recruiterProfile: {
      firstName?: string;
      jobTitle?: string;
      companyName?: string;
      companyDescription?: string;
    };
    jobProfile: {
      name?: string;
      companyDetails?: string;
      jobLocation?: string;
    };
    dayText?: 'today' | 'tomorrow';
  }): string {
    const { candidate, recruiterProfile, jobProfile } = variables;
    const dayText = variables.dayText ?? this.getCallAvailabilityDayText();
    const companyDescription = recruiterProfile?.companyDescription?.trim();
    const companySuffix = companyDescription ? `, ${companyDescription}` : '';
    const companyDetails = jobProfile?.companyDetails?.trim() ?? '';
    const companyDetailsSegment = companyDetails ? ` for ${companyDetails}` : '';

    return [
      `Hey ${candidate.firstName ?? 'there'},`,
      '',
      `I'm ${recruiterProfile.firstName ?? ''}, ${recruiterProfile.jobTitle ?? ''} at ${recruiterProfile.companyName ?? ''}${companySuffix}.`,
      '',
      `I'm hiring for a ${jobProfile?.name ?? ''} role${companyDetailsSegment} based out of ${jobProfile?.jobLocation ?? ''} and got your application on my job posting. I believe this might be a good fit.`,
      '',
      `Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime ${dayText}?`,
    ].join('\n');
  }

  async getStartMeetingSchedulingPrompt(
    candidate: CandidateNode,
    candidateJob: Job,
    apiToken: string,
  ) {
    try {
      console.log('candidateJob::', candidateJob);
      const meetingType =
        candidateJob?.interviewSchedule?.edges[0]?.node?.meetingType;

      console.log('candidateJob interviewSchedule::', meetingType);
      if (!meetingType) {
        return;
      }

      switch (meetingType) {
        case 'online':
          return this.getOnlineStartMeetingSchedulingPrompt(
            candidate,
            candidateJob,
            apiToken,
          );
        case 'inPerson':
          return this.getInPersonMeetingSchedulingPrompt(
            candidate,
            candidateJob,
            apiToken,
          );
        case 'walkIn':
          return this.getWalkinMeetingSchedulingPrompt(
            candidate,
            candidateJob,
            apiToken,
          );
      }
    } catch (error) {
      console.log(
        'Error in getStartMeetingSchedulingPrompt:',
        error,
        'FUCK FUCK',
      );
    }
  }

  async getInPersonMeetingSchedulingPrompt(
    candidate: CandidateNode,
    candidateJob,
    apiToken: string,
  ) {
    // async getStartMeetingScheduling(personNode, candidateJob, apiToken:string){
    try {
      const candidate_conversation_summary = ``;
      const meeting_type = 'In-Person meeting';
      const secondary_available_slots =
        '12PM-3PM, 4PM -6PM on the 24th and 25th August 2024';
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
        candidate: candidate,
      };

      const IN_PERSON_MEETING_SCHEDULING_PROMPT_STRINGIFIED =
        await this.getPromptByJobIdAndName(
          candidateJob.id,
          'IN_PERSON_MEETING_SCHEDULING_PROMPT',
          apiToken,
        );
      const IN_PERSON_MEETING_SCHEDULING_PROMPT = this.replaceTemplateVariables(
        IN_PERSON_MEETING_SCHEDULING_PROMPT_STRINGIFIED,
        variables,
      );

      console.log(
        'Generated IN_PERSON_MEETING_SCHEDULING_PROMPT prompt:',
        IN_PERSON_MEETING_SCHEDULING_PROMPT,
      );

      return IN_PERSON_MEETING_SCHEDULING_PROMPT;
    } catch (error) {
      console.error('Error in getInPersonMeetingSchedulingPrompt:', error);
      throw error;
    }
  }

  async getOnlineStartMeetingSchedulingPrompt(
    candidate: CandidateNode,
    candidateJob,
    apiToken: string,
  ) {
    try {
      const candidate_conversation_summary = ``;
      const meeting_type = 'Online meeting';
      const secondarySlotsDate = new Date();

      secondarySlotsDate.setDate(secondarySlotsDate.getDate() + 3);
      const secondary_available_slots = `Any 30 mins between 12PM-3PM, 4PM -6PM on the ${secondarySlotsDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      const primarySlotsDate = new Date();

      primarySlotsDate.setDate(primarySlotsDate.getDate() + 2);
      const primary_available_slots = `Any 30 mins between 12PM-3PM, 4PM -6PM on the ${primarySlotsDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      const variables = {
        candidate_conversation_summary: candidate_conversation_summary,
        meeting_type: meeting_type,
        secondary_available_slots: secondary_available_slots,
        primary_available_slots: primary_available_slots,
        candidate: candidate,
      };
      const ONLINE_MEETING_PROMPT_STRINGIFIED =
        await this.getPromptByJobIdAndName(
          candidateJob.id,
          'ONLINE_MEETING_PROMPT',
          apiToken,
        );
      const ONLINE_MEETING_PROMPT = this.replaceTemplateVariables(
        ONLINE_MEETING_PROMPT_STRINGIFIED,
        variables,
      );

      console.log(
        'Generated IN_PERSON_MEETING_SCHEDULING_PROMPT prompt:',
        ONLINE_MEETING_PROMPT,
      );

      return ONLINE_MEETING_PROMPT;
    } catch (error) {
      console.error('Error in getOnlineStartMeetingSchedulingPrompt:', error);
      throw error;
    }
  }

  async getWalkinMeetingSchedulingPrompt(
    candidate: CandidateNode,
    candidateJob,
    apiToken: string,
  ) {
    try {
      const candidate_conversation_summary = ``;
      const meeting_type = 'In-Person meeting';
      const interviewLocation = 'Kharadi, Pune';
      const interviewAddress =
        'Transcom India, Office No 1501, 1508, Nayati Enthral, Sr No 12/1A, Mundhwa - Kharadi Bypass, Kharadi South Main Road, Kharadi, Pune, Maharashtra - 411014';
      const googleMapsLocation = 'https://maps.app.goo.gl/nAtTbrQDqcjaCcmm8';
      const clientCompanyNameShort = 'Transcom';
      const contactPerson = 'Gayatri Soni';
      const whatHappensAtTheMeeting =
        'the meeting would be to discuss their experience, motivations and interests. There will also be a versant test at the office.';
      const meetingTime = '11AM';
      const meetingDate = new Date();

      meetingDate.setDate(meetingDate.getDate() + 2);
      // Ensure the meeting date is not a Sunday
      while (meetingDate.getDay() === 0) {
        meetingDate.setDate(meetingDate.getDate() + 1);
      }
      const formattedMeetingWeekdayDate = meetingDate.toLocaleDateString(
        'en-US',
        { weekday: 'short', month: 'short', day: 'numeric' },
      );
      const formattedMeetingWeekday = meetingDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const variables = {
        candidate_conversation_summary: candidate_conversation_summary,
        meeting_type: meeting_type,
        interviewLocation: interviewLocation,
        interviewAddress: interviewAddress,
        googleMapsLocation: googleMapsLocation,
        contactPerson: contactPerson,
        whatHappensAtTheMeeting: whatHappensAtTheMeeting,
        clientCompanyNameShort: clientCompanyNameShort,
        meetingTime: meetingTime,
        formattedMeetingWeekdayDate: formattedMeetingWeekdayDate,
        formattedMeetingWeekday: formattedMeetingWeekday,
        today: today,
        candidate: candidate,
      };
      const WALKIN_MEETING_SCHEDULING_PROMPT_STRINGIFIED =
        await this.getPromptByJobIdAndName(
          candidateJob.id,
          'WALKIN_MEETING_SCHEDULING_PROMPT',
          apiToken,
        );
      const WALKIN_MEETING_SCHEDULING_PROMPT = this.replaceTemplateVariables(
        WALKIN_MEETING_SCHEDULING_PROMPT_STRINGIFIED,
        variables,
      );

      console.log(
        'Generated WALKIN_MEETING_SCHEDULING_PROMPT prompt:',
        WALKIN_MEETING_SCHEDULING_PROMPT,
      );

      return WALKIN_MEETING_SCHEDULING_PROMPT;
    } catch (error) {
      console.error('Error in getWalkinMeetingSchedulingPrompt:', error);
      throw error;
    }
  }

  async getTimeManagementPrompt(candidate: CandidateNode) {
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