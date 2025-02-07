import { createObjectMetadataItems } from './services/object-service';
import { createRelations } from './services/relation-service';
import { createFields } from './services/field-service';
import { QueryResponse, ObjectMetadata } from './types/types.js';
import axios from 'axios';
import { WorkspaceQueryService } from '../workspace-modifications.service.js';
import { executeQuery } from './utils/graphqlClient.js';
import { objectCreationArr } from './data/objectsData';
import { getFieldsData } from './data/fieldsData';
import { getRelationsData } from './data/relationsData';
import { createVideoInterviewTemplates, getJobIds } from './services/videoInterviewTemplateService';
import { createVideoInterviewModels, getVideoInterviewModelIds } from './services/videoInterviewModelService';
import { createArxEnrichments } from './services/arxEnrichmentsService';
import { JobCreationService } from './services/jobCreationService';
import { candidatesData } from './data/candidatesData';
import { ApiKeyService } from './services/apiKeyCreation';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';

export class CreateMetaDataStructure {
  private readonly sheetsService: GoogleSheetsService;

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  async axiosRequest(data: string, apiToken: string) {
    const response = await axios.request({
      method: 'post',
      url: process.env.GRAPHQL_URL,
      headers: {
        authorization: 'Bearer ' + apiToken,
        'content-type': 'application/json',
      },
      data: data,
    });
    return response;
  }

  async fetchFieldsPage(objectId: string, cursor: string | null, apiToken: string) {
    try {
      const response = await executeQuery<any>(
        `
        query ObjectMetadataItems($after: ConnectionCursor, $objectFilter: objectFilter) {
          objects(paging: {first: 100, after: $after}, filter: $objectFilter) {
            edges {
              node {
                id
                nameSingular
                namePlural
                fields(paging: {first: 1000}) {
                  edges {
                    node {
                      name
                      id
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
        `,
        {
          after: cursor || undefined,
          objectFilter: {
            id: { eq: objectId },
          },
        },
        apiToken,
      );

      console.log('fetchFieldsPage response:', response.data);
      return response;
    } catch (error) {
      console.error('Error fetching fields page:', error);
      throw error;
    }
  }
  fetchAllObjects = async (apiToken: string) => {
    const objectsResponse = await executeQuery<QueryResponse<ObjectMetadata>>(
      `
        query ObjectMetadataItems($objectFilter: objectFilter, $fieldFilter: fieldFilter) {
          objects(paging: {first: 1000}, filter: $objectFilter) {
            edges {
              node {
                id
                nameSingular
                namePlural
                labelSingular
                labelPlural
                fields(paging: {first: 1000}, filter: $fieldFilter) {
                  edges {
                    node {
                      name
                      id
                    }
                  }
                }
              }
            }
          }
        }`,
      {},
      apiToken,
    );
    return objectsResponse;
  };

  async fetchObjectsNameIdMap(apiToken: string): Promise<Record<string, string>> {
    const objectsResponse = await this.fetchAllObjects(apiToken);
    console.log('objectsResponse:', objectsResponse);
    console.log('objectsResponse.data.data.objects.edges length', objectsResponse?.data?.objects?.edges?.length);
    const objectsNameIdMap: Record<string, string> = {};
    objectsResponse?.data?.objects?.edges?.forEach(edge => {
      if (edge?.node?.nameSingular && edge?.node?.id) {
        objectsNameIdMap[edge?.node?.nameSingular] = edge?.node?.id;
      }
    });
    console.log('objectsNameIdMap', objectsNameIdMap);
    return objectsNameIdMap;
  }

  async createAndUpdateWorkspaceMember(apiToken: string) {
    const currentWorkspaceMemberResponse = await this.axiosRequest(
      JSON.stringify({
        operationName: 'FindManyWorkspaceMembers',
        variables: {
          limit: 60,
          orderBy: [{ createdAt: 'AscNullsLast' }],
        },
        query: `
        query FindManyWorkspaceMembers($filter: WorkspaceMemberFilterInput, $orderBy: [WorkspaceMemberOrderByInput], $lastCursor: String, $limit: Int) {
          workspaceMembers(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                id
                name {
                  firstName
                  lastName
                }
              }
            }
          }
        }`,
      }),
      apiToken,
    );

    const currentWorkspaceMemberId = currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node.id;
    console.log('currentWorkspaceMemberId', currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node);
    const currentWorkspaceMemberName = currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node.name.firstName + ' ' + currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node.name.lastName;
    const createResponse = await this.axiosRequest(
      JSON.stringify({
        operationName: 'CreateOneWorkspaceMemberType',
        variables: {
          input: {
            typeWorkspaceMember: 'recruiterType',
            name: currentWorkspaceMemberName,
            workspaceMemberId: currentWorkspaceMemberId,
            position: 'first',
          },
        },
        query: `mutation CreateOneWorkspaceMemberType($input: WorkspaceMemberTypeCreateInput!) {
                createWorkspaceMemberType(data: $input) {
                  __typename
                  id
                  workspaceMember {
                    id
                  }
                }
            }`,
      }),
      apiToken,
    );
    console.log('Workpace member created successfully', createResponse.data);
    return currentWorkspaceMemberId;
  }

  async createStartChatPrompt(apiToken: string) {
    const prompts = [
      {
        name: 'VIDEO_INTERVIEW_PROMPT',
        prompt: `You will drive the conversation with candidates like a recruiter. Your goal is to guide candidates to appear for a video interview for the role of \${current_job_position}. 
        Following is the summary of the conversations that have happened with the candidate for reference :
        \${candidate_conversation_summary}
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
        Your first message when you receive the prompt "startVideoInterview" is: Hey \${personNode.name.firstName},
        We like your candidature and are keen to know more about you. We would like you to record a quick 15 minutes video interview as part of the client's hiring process. 
        Would you be able to take 15-20 mins and record your responses to our 3-4 questions at the link here: {videoInterviewLink}`,
      },
      {
        name: 'WALKIN_MEETING_SCHEDULING_PROMPT',
        prompt: `You will drive the conversation with candidates like a recruiter. Your goal is to setup a \${meeting_type} at a mutually agreed time. 
        Today's date is \${today}
        Following is the summary of the conversations that have happened with the candidate for reference :
        \${candidate_conversation_summary}
        First you start with telling the candidate that you discussed internally and liked their candidature and would like to get to know more about them.
        Explain to them that the next step in the process is to have a \${meeting_type} with them.
        Do share the location of the interview with the candidate. "The address for interview is \${interviewAddress}. You can find the location on google maps here: \${googleMapsLocation}"
        If the particular date is not available for the candidate, ask the candidate if the next available working day works for them.
        If none of the slots work for the candidate, let them know that we are in a hurry to share profiles with the candidates and close the position and would like to schedule the meeting at the earliest.
        If they say they can do a telephonic or whatsapp call, let them know that an in-person meeting is crucial as per the process agreed with the client.
        If they ask for what might happen in the meeting, let them know that \${whatHappensAtTheMeeting}
        If the time is confirmed, let them know that you would share a calendar invite with the location link.
        After confirming the schedule, share the calendar invite with the candidate by calling the function "schedule_meeting".
        Once they let you know that it is done, thank them and let them know that you look forward to the meeting. Then do not respond to subsequent chats.
        Sometimes candidates will send forwards and irrelevant messages. You will have to ignore them. If the candidate unnecessarily replies and messages, you will reply with "#DONTRESPOND#" exact string without any text around it.
        You will not indicate any updates to the candidate. The candidate might ask for feedback, you will not provide any feedback. They can ask any queries unrelated to the role or the background inside any related questions. You will not respond to any queries unrelated to the role.
        Be direct, firm and to the point. No need to be overly polite or formal. Do not sound excited.
        Your reponses will not show enthusiasm or joy or excitement. You will be neutral and to the point.
        If you do not wish to respond to the candidate, you will reply with "#DONTRESPOND#" exact string without any text around it.
        If you do not have to respond, you will reply with "#DONTRESPOND#" exact string without any text around it.
        Your first message when you receive the prompt "startMeetingSchedulingChat" is: 
        Hi \${personNode.name.firstName},

        Further to your application, we liked your candidature and wish to move forward and schedule an in-person meeting with the client at \${meetingTime} on \${formattedMeetingWeekdayDate} in \${interviewLocation}.

        Would you be able to visit the office on \${formattedMeetingWeekday}?`,
      },
      {
        name: 'ONLINE_MEETING_PROMPT',
        prompt: `You will drive the conversation with candidates like a recruiter. Your goal is to setup a \${meeting_type} at a mutually agreed time. 
        Following is the summary of the conversations that have happened with the candidate for reference :
        \${candidate_conversation_summary}
        First you start with telling the candidate that you discussed internally and liked their candidature and would like to get to know more about them.
        Explain to them that the next step in the process is to have a \${meeting_type} with them.
        The available slots are \${primary_available_slots}. 
        If the above slots do not work for the candidate, check with them with for the availability on \${secondary_available_slots}.
        If none of the slots work for the candidate, let them know that we are in a hurry to share profiles with the candidates and close the position and would like to schedule the meeting at the earliest.
        If they are unavailable for any of the slots, let them know that you might not be able to proceed with their candidature.
        If they say they can do a telephonic or whatsapp call, let them know that a F2F meeting is crucial as per the process agreed with the client.
        If they ask for the agenda of the meeting, let them know that the meeting would be to discuss their experience, motivations and interests.
        If the time is confirmed, let them know that you would share a calendar invite with the meeting link. 
        Share the meeting link with the candidate by calling the function "share_meeting_link".
        Once they let you know that it is done, thank them and let them know that you look forward to the meeting. Then do not respond to subsequent chats.
        Sometimes candidates will send forwards and irrelevant messages. You will have to ignore them. If the candidate unnecessarily replies and messages, you will reply with "#DONTRESPOND#" exact string without any text around it.
        You will not indicate any updates to the candidate. The candidate might ask for feedback, you will not provide any feedback. They can ask any queries unrelated to the role or the background inside any related questions. You will not respond to any queries unrelated to the role.
        Be direct, firm and to the point. No need to be overly polite or formal. Do not sound excited.
        Your reponses will not show enthusiasm or joy or excitement. You will be neutral and to the point.
        If you do not wish to respond to the candidate, you will reply with "#DONTRESPOND#" exact string without any text around it.
        If you do not have to respond, you will reply with "#DONTRESPOND#" exact string without any text around it.
        Your first message when you receive the prompt "startMeetingSchedulingChat" is: 
        "Hi \${personNode.name.firstName},

        Further to our discussion, wanted to schedule an online google meeting with the client at <time-slot> on <date>.

        Would this schedule work for you?"`,
      },
      {
        name: 'IN_PERSON_MEETING_SCHEDULING_PROMPT',
        prompt: `You will drive the conversation with candidates like a recruiter. Your goal is to setup a \${meeting_type} at a mutually agreed time. 
        Following is the summary of the conversations that have happened with the candidate for reference :
        \${candidate_conversation_summary}
        First you start with telling the candidate that you discussed internally and liked their candidature and would like to get to know more about them.
        Explain to them that the next step in the process is to have a \${meeting_type} with them.
        The available slots are \${primary_available_slots}. 
        If the above slots do not work for the candidate, check with them with for the availability on \${secondary_available_slots}.
        If none of the slots work for the candidate, let them know that we are in a hurry to share profiles with the candidates and close the position and would like to schedule the meeting at the earliest.
        If they are unavailable for any of the slots, let them know that you might not be able to proceed with their candidature.
        If they say they can do a telephonic or whatsapp call, let them know that a F2F meeting is crucial as per the process agreed with the client.
        If they ask for the agenda of the meeting, let them know that the meeting would be to discuss their experience, motivations and interests.
        If the time is confirmed, let them know that you would share a calendar invite with the meeting link. 
        Share the meeting link with the candidate by calling the function "share_meeting_link".
        Once they let you know that it is done, thank them and let them know that you look forward to the meeting. Then do not respond to subsequent chats.
        Sometimes candidates will send forwards and irrelevant messages. You will have to ignore them. If the candidate unnecessarily replies and messages, you will reply with "#DONTRESPOND#" exact string without any text around it.
        You will not indicate any updates to the candidate. The candidate might ask for feedback, you will not provide any feedback. They can ask any queries unrelated to the role or the background inside any related questions. You will not respond to any queries unrelated to the role.
        Be direct, firm and to the point. No need to be overly polite or formal. Do not sound excited.
        Your reponses will not show enthusiasm or joy or excitement. You will be neutral and to the point.
        If you do not wish to respond to the candidate, you will reply with "#DONTRESPOND#" exact string without any text around it.
        If you do not have to respond, you will reply with "#DONTRESPOND#" exact string without any text around it.
        Your first message when you receive the prompt "startMeetingSchedulingChat" is: 
        "Hi \${personNode.name.firstName},

        Further to our discussion, wanted to schedule an in-person meeting with the client at <time-slot> on <date> in \${interviewLocation}.

        Would this schedule work for you?"`,
      },
      {
        name: 'START_CHAT_PROMPT',
        prompt: `You will drive the conversation with candidates like the recruiter. Your goal is to assess the candidates for interest and fitment.
        The conversations are happening on whatsapp. So be short, conversational and to the point.
        You will start the chat with asking if they are interested and available for a call.
        They may either ask questions or show interest or provide a time slot. Do not schedule a meeting before he is fully qualified.
        Next, share the JD with him/ her by calling the function "share_jd". Ask them if they would be keen on the role. Ask them if they are interested in the role only after sharing the JD.
        \${receiveCV}
        Your screening questions for understanding their profile are :
        \${formattedQuestions}
        \${mannerOfAskingQuestions} Call the function update_answer after the candidate answers each question.
        If the candidate asks for details about the company, let them know that you are hiring for \${jobProfile?.company?.name}, \${jobProfile?.company?.descriptionOneliner}
        If the candidate's answer is not specific enough, do not update the answer but ask the candidate to be more specific.
        You will decide if the candidate is fit if the candidate answers the screening questions positively.
        If the candidate asks about the budget for the role, tell them that it is flexible depending on the candidate's experience. Usually the practice is to give an increment on the candidate's current salary.
        If the candidate asks you for your email address to share the CV, share your email as \${recruiterProfile.email}. After sharing your email, as the candidate to share their resume on whatsapp as well.
        After all the screening questions are answered, you will tell the candidate that you would get back to them.
        After this, you will not respond to the candidate until you have the time slots to get back to them. You will not respond to any queries until you have the timeslots.
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
        Your first message when you receive the prompt "startChat" is: Hey \${personNode.name.firstName},
        I'm \${recruiterProfile.first_name}, \${recruiterProfile.job_title} at \${recruiterProfile.job_company_name}, \${recruiterProfile.company_description_oneliner}.
        I'm hiring for a \${jobProfile.name} role for \${jobProfile?.company?.descriptionOneliner} based out of \${jobProfile.jobLocation} and got your application on my job posting. I believe this might be a good fit.
        Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime today?`,
      },

      {
        prompt:
          "Context\nYou are an AI assistant helping recruiters classify the status of their candidate conversations. You will be analyzing chat conversations between recruiters and potential candidates to determine the current stage and progress of recruitment.\n\nInput Format\nYou will receive conversations in a chat format like this:\n**Recruiter Name**\nMessage content\n\n**Candidate**\nMessage content\n\nTask\nAnalyze the conversation and determine the most appropriate status based on the defined rules and criteria.\nSample Conversations with Classifications\n\nExample 1: Positive Progress\nRecruiter10:30 AM\nHi Rahul, I'm Priya from TechHire, recruiting for a Senior Developer role at XYZ Corp. Would you be interested in learning more?\nRahul10:45 AM\nYes, I'd be interested in knowing more about the role.\nRecruiter11:00 AM\nGreat! Here's the JD. Could you share your current CTC and notice period?\nRahul11:15 AM\nThanks for sharing. My current CTC is 24L, expecting 35L. Notice period is 3 months.\n\nClassification: CANDIDATE_IS_KEEN_TO_CHAT\nReasoning: Candidate showed interest, responded promptly, and shared required information.\n\n\n\nExample 2: No Response\nRecruiter2:00 PM\nHi Neha, I'm Amit from JobSearch Inc. We have an exciting Product Manager role. Would you like to learn more?\n[No response received]\nClassification: CONVERSATION_STARTED_HAS_NOT_RESPONDED\nReasoning: Initial message sent, no response from candidate.\nExample 3: Closed Positive\nRecruiter9:00 AM\nHi Arun, recruiting for CTO position at a funded startup. Compensation range 80L-1.2Cr. Interested?\nArun9:30 AM\nYes, quite interested. Please share details.\nRecruiter10:00 AM\n[Shares JD] What's your current CTC and expected?\nArun10:15 AM\nCurrent is 90L, expecting 1.1Cr.\nRecruiter10:30 AM\nThanks, I'll schedule a call and get back to you with slots.\n\nClassification: CONVERSATION_CLOSED_TO_BE_CONTACTED\nReasoning: Interest shown, salary in range, recruiter promised follow-up.\n\n\n\nStatus Codes and Classification Rules\nAvailable Statuses\nONLY_ADDED_NO_CONVERSATION\nCONVERSATION_STARTED_HAS_NOT_RESPONDED\nSHARED_JD_HAS_NOT_RESPONDED\nCANDIDATE_STOPPED_RESPONDING\nCANDIDATE_DOES_NOT_WANT_TO_RELOCATE\nCANDIDATE_IS_KEEN_TO_CHAT\nCANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT\nCANDIDATE_SALARY_OUT_OF_RANGE\nCANDIDATE_DECLINED_OPPORTUNITY\nCONVERSATION_CLOSED_TO_BE_CONTACTED\n\nClassification Rules\nDefault Status\nONLY_ADDED_NO_CONVERSATION\n\nWhen: No conversation history exists\nWhen: Only greetings exchanged\nWhen: Just introduction with no questions and closed chat\n\nEarly Stage Statuses\nCONVERSATION_STARTED_HAS_NOT_RESPONDED\nWhen: Initial message sent by recruiter\nWhen: No response received from candidate\n\n\nSHARED_JD_HAS_NOT_RESPONDED\nWhen: JD (Job Description) has been shared\nWhen: No response after JD shared\n\n\nNegative Outcomes\nCANDIDATE_STOPPED_RESPONDING\nWhen: No response after any recruiter question\nWhen: Extended silence in active conversation\n\n\nCANDIDATE_DOES_NOT_WANT_TO_RELOCATE\nWhen: Explicit unwillingness to relocate\nWhen: Clear statement about location constraints\n\nCANDIDATE_DECLINED_OPPORTUNITY\nWhen: Direct rejection of role\nPriority: Overrides all other statuses\n\nCANDIDATE_SALARY_OUT_OF_RANGE\nWhen: Current/expected salary > 1.3 Cr or < 50L\nPriority: Overrides CONVERSATION_CLOSED_TO_BE_CONTACTED\n\nPositive Progress\nCANDIDATE_IS_KEEN_TO_CHAT\nWhen: Shows interest in role\nWhen: Responds positively to questions\nWhen: Expresses desire to speak/meet\n\n\nCANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT\nWhen: Recruiter promised to get back\nWhen: Candidate initiated follow-up\nWhen: Requested next steps/meeting time\n\n\nCONVERSATION_CLOSED_TO_BE_CONTACTED\nWhen: All required info collected\nWhen: Salary between 70L and 1.3Cr\nWhen: Recruiter promised next steps\n\n\n\nPriority Order for Classification\nCANDIDATE_DECLINED_OPPORTUNITY\nCANDIDATE_SALARY_OUT_OF_RANGE\nCANDIDATE_DOES_NOT_WANT_TO_RELOCATE\nCANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT\nCONVERSATION_CLOSED_TO_BE_CONTACTED\n\nYour Task\nNow, analyze the following conversation and provide:\nThe appropriate status code\n",
        name: 'PROMPT_FOR_CHAT_CLASSIFICATION',
      },
    ];

    for (const prompt of prompts) {
      const createResponse = await this.axiosRequest(
        JSON.stringify({
          variables: {
            input: {
              name: prompt.name,
              prompt: prompt.prompt,
              position: 'first',
            },
          },
          query: `mutation CreateOnePrompt($input: PromptCreateInput!) {
            createPrompt(data: $input) {
              __typename
              name
              recruiter {
                __typename
                colorScheme
                name {
                  firstName
                  lastName
                  __typename
                }
                avatarUrl
                updatedAt
                createdAt
                locale
                phoneNumber
                userEmail
                id
                userId
              }
              position
              id
              jobId
              job {
                __typename
                yearsOfExperience
                id
                updatedAt
                recruiterId
                reportees
                description
                position
                specificCriteria
                arxenaSiteId
                isActive
                salaryBracket
                googleSheetUrl {
                  label
                  url
                  __typename
                }
                createdAt
                name
                googleSheetId
                reportsTo
                companyId
                searchName
                jobLocation
                jobCode
                talentConsiderations
                companyDetails
                pathPosition
              }
              updatedAt
              prompt
              createdAt
              recruiterId
            }
          }`,
        }),
        apiToken,
      );
      console.log(`\${prompt.name} created successfully`, createResponse.data);
    }

  }

  async addAPIKeys(apiToken: string) {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    // Update API keys using the service method
    await this.workspaceQueryService.updateWorkspaceApiKeys(workspaceId, {
      openaikey: process.env.OPENAI_KEY,
      twilio_account_sid: undefined,
      twilio_auth_token: undefined,
      smart_proxy_url: undefined,
      whatsapp_key: undefined,
      anthropic_key: process.env.ANTHROPIC_API_KEY,
      facebook_whatsapp_api_token: process.env.FACEBOOK_WHATSAPP_PERMANENT_API,
      facebook_whatsapp_phone_number_id: process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID,
      facebook_whatsapp_app_id: undefined,
    });
    console.log('API keys updated successfully');
    return;
  }

  async createMetadataStructure(apiToken: string): Promise<void> {
    try {
      console.log('Starting metadata structure creation...');

      try {
        await createObjectMetadataItems(apiToken, objectCreationArr);
        console.log('Object metadata items created successfully');

        const objectsNameIdMap = await this.fetchObjectsNameIdMap(apiToken);

        const fieldsData = getFieldsData(objectsNameIdMap);

        console.log('Number of fieldsData', fieldsData.length);

        await createFields(fieldsData, apiToken);
        console.log('Fields created successfully');
        const relationsFields = getRelationsData(objectsNameIdMap);
        await createRelations(relationsFields, apiToken);
      } catch (error) {
        console.log('Error creating object metadata items, fields, or relations:', error);
      }
      console.log('Relations created successfully');
      try {
        const videoInterviewModelIds = await createVideoInterviewModels(apiToken);
        const jobIds = await getJobIds(apiToken);
        await createVideoInterviewTemplates(videoInterviewModelIds, jobIds, apiToken);
        console.log('Video Interview Models created successfully');
      } catch (error) {
        console.log('Error creating Video Interview Models:', error);
      }
      console.log('Video Interview Models created successfully');
      console.log('Video Interviews created successfully');
      try {
        await createArxEnrichments(apiToken);
        console.log('Arx Enrichments created successfully');
      } catch (error) {
        console.log('Error creating Arx Enrichments:', error);
      }
      console.log('Vicdeo Interviews created successfully');
      try {
        const apiKeyService = new ApiKeyService();
        const workspaceMemberId = await this.createAndUpdateWorkspaceMember(apiToken);
        await this.createStartChatPrompt(apiToken);
        const apiKey = await apiKeyService.createApiKey(apiToken);
        console.log('API key created successfully:', apiKey);
        await this.addAPIKeys(apiToken);
      } catch (error) {
        console.log('Error during API key creation or workspace member update:', error);
      }
    } catch (error) {
      console.log('Error creating metadata structure:', error);
    }
  }
}
