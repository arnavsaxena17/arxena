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

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {
  }
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
            id: { eq: objectId }
          }
        },  
        apiToken
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
    console.log("objectsResponse.data.data.objects.edges length", objectsResponse?.data?.objects?.edges?.length);
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
    console.log("currentWorkspaceMemberId", currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node);
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
    const createResponse = await this.axiosRequest(
      JSON.stringify({
        variables: {
          input: {
            name: 'PROMPT_FOR_CHAT_CLASSIFICATION',
            prompt: "Context\nYou are an AI assistant helping recruiters classify the status of their candidate conversations. You will be analyzing chat conversations between recruiters and potential candidates to determine the current stage and progress of recruitment.\n\nInput Format\nYou will receive conversations in a chat format like this:\n**Recruiter Name**\nMessage content\n\n**Candidate**\nMessage content\n\nTask\nAnalyze the conversation and determine the most appropriate status based on the defined rules and criteria.\nSample Conversations with Classifications\n\nExample 1: Positive Progress\nRecruiter10:30 AM\nHi Rahul, I'm Priya from TechHire, recruiting for a Senior Developer role at XYZ Corp. Would you be interested in learning more?\nRahul10:45 AM\nYes, I'd be interested in knowing more about the role.\nRecruiter11:00 AM\nGreat! Here's the JD. Could you share your current CTC and notice period?\nRahul11:15 AM\nThanks for sharing. My current CTC is 24L, expecting 35L. Notice period is 3 months.\n\nClassification: CANDIDATE_IS_KEEN_TO_CHAT\nReasoning: Candidate showed interest, responded promptly, and shared required information.\n\n\n\nExample 2: No Response\nRecruiter2:00 PM\nHi Neha, I'm Amit from JobSearch Inc. We have an exciting Product Manager role. Would you like to learn more?\n[No response received]\nClassification: CONVERSATION_STARTED_HAS_NOT_RESPONDED\nReasoning: Initial message sent, no response from candidate.\nExample 3: Closed Positive\nRecruiter9:00 AM\nHi Arun, recruiting for CTO position at a funded startup. Compensation range 80L-1.2Cr. Interested?\nArun9:30 AM\nYes, quite interested. Please share details.\nRecruiter10:00 AM\n[Shares JD] What's your current CTC and expected?\nArun10:15 AM\nCurrent is 90L, expecting 1.1Cr.\nRecruiter10:30 AM\nThanks, I'll schedule a call and get back to you with slots.\n\nClassification: CONVERSATION_CLOSED_TO_BE_CONTACTED\nReasoning: Interest shown, salary in range, recruiter promised follow-up.\n\n\n\nStatus Codes and Classification Rules\nAvailable Statuses\nONLY_ADDED_NO_CONVERSATION\nCONVERSATION_STARTED_HAS_NOT_RESPONDED\nSHARED_JD_HAS_NOT_RESPONDED\nCANDIDATE_STOPPED_RESPONDING\nCANDIDATE_DOES_NOT_WANT_TO_RELOCATE\nCANDIDATE_IS_KEEN_TO_CHAT\nCANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT\nCANDIDATE_SALARY_OUT_OF_RANGE\nCANDIDATE_DECLINED_OPPORTUNITY\nCONVERSATION_CLOSED_TO_BE_CONTACTED\n\nClassification Rules\nDefault Status\nONLY_ADDED_NO_CONVERSATION\n\nWhen: No conversation history exists\nWhen: Only greetings exchanged\nWhen: Just introduction with no questions and closed chat\n\nEarly Stage Statuses\nCONVERSATION_STARTED_HAS_NOT_RESPONDED\nWhen: Initial message sent by recruiter\nWhen: No response received from candidate\n\n\nSHARED_JD_HAS_NOT_RESPONDED\nWhen: JD (Job Description) has been shared\nWhen: No response after JD shared\n\n\nNegative Outcomes\nCANDIDATE_STOPPED_RESPONDING\nWhen: No response after any recruiter question\nWhen: Extended silence in active conversation\n\n\nCANDIDATE_DOES_NOT_WANT_TO_RELOCATE\nWhen: Explicit unwillingness to relocate\nWhen: Clear statement about location constraints\n\nCANDIDATE_DECLINED_OPPORTUNITY\nWhen: Direct rejection of role\nPriority: Overrides all other statuses\n\nCANDIDATE_SALARY_OUT_OF_RANGE\nWhen: Current/expected salary > 1.3 Cr or < 50L\nPriority: Overrides CONVERSATION_CLOSED_TO_BE_CONTACTED\n\nPositive Progress\nCANDIDATE_IS_KEEN_TO_CHAT\nWhen: Shows interest in role\nWhen: Responds positively to questions\nWhen: Expresses desire to speak/meet\n\n\nCANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT\nWhen: Recruiter promised to get back\nWhen: Candidate initiated follow-up\nWhen: Requested next steps/meeting time\n\n\nCONVERSATION_CLOSED_TO_BE_CONTACTED\nWhen: All required info collected\nWhen: Salary between 70L and 1.3Cr\nWhen: Recruiter promised next steps\n\n\n\nPriority Order for Classification\nCANDIDATE_DECLINED_OPPORTUNITY\nCANDIDATE_SALARY_OUT_OF_RANGE\nCANDIDATE_DOES_NOT_WANT_TO_RELOCATE\nCANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT\nCONVERSATION_CLOSED_TO_BE_CONTACTED\n\nYour Task\nNow, analyze the following conversation and provide:\nThe appropriate status code\n",
            position: 'first',
          },
        },
        query: `mutation CreateOnePrompt($input: PromptCreateInput!) {\ncreatePrompt(data: $input) {\n  __typename\n  name\n  recruiter {\n    __typename\n    colorScheme\n    name {\n      firstName\n      lastName\n      __typename\n    }\n    avatarUrl\n    updatedAt\n    createdAt\n    locale\n    phoneNumber\n    userEmail\n    id\n    userId\n  }\n  position\n  id\n  jobId\n  job {\n    __typename\n    yearsOfExperience\n    id\n    updatedAt\n    recruiterId\n    reportees\n    description\n    position\n    specificCriteria\n    arxenaSiteId\n    isActive\n    salaryBracket\n    googleSheetUrl {\n      label\n      url\n      __typename\n    }\n    createdAt\n    name\n    googleSheetId\n    reportsTo\n    companyId\n    searchName\n    jobLocation\n    jobCode\n    talentConsiderations\n    companyDetails\n    pathPosition\n  }\n  updatedAt\n  prompt\n  createdAt\n  recruiterId\n}
        }`,
      }),
      apiToken,
    );
    console.log('Start chat prompt created successfully', createResponse.data);

  }





  async createMetadataStructure(apiToken: string): Promise<void> {
    try {
      console.log('Starting metadata structure creation...');

      try {
        await createObjectMetadataItems(apiToken, objectCreationArr);
        console.log('Object metadata items created successfully');
        const objectsNameIdMap = await this.fetchObjectsNameIdMap(apiToken);
        const fieldsData = getFieldsData(objectsNameIdMap);
        console.log("Number of fieldsData", fieldsData.length);
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
        // await this.addAPIKeys(apiToken);
      } catch (error) {
        console.log('Error during API key creation or workspace member update:', error);
      }
    } catch (error) {
      console.log('Error creating metadata structure:', error);
    }
  }
}
