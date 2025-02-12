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
import { prompts } from './data/prompts';

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
