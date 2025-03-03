import axios from 'axios';
import { WorkspaceQueryService } from '../workspace-modifications.service.js';
import { getFieldsData } from './data/fieldsData';
import { objectCreationArr } from './data/objectsData';
import { prompts } from './data/prompts';
import { getRelationsData } from './data/relationsData';
import { ApiKeyService } from './services/apiKeyCreation';
import { createArxEnrichments } from './services/arxEnrichmentsService';
import { createFields } from './services/field-service';
import { createObjectMetadataItems } from './services/object-service';
import { createRelations } from './services/relation-service';
import { createVideoInterviewModels } from './services/videoInterviewModelService';
import {
  createVideoInterviewTemplates,
  getJobIds,
} from './services/videoInterviewTemplateService';
// import { ObjectMetadata, QueryResponse } from './types/types.js';
import {
  FindManyWorkspaceMembers,
  graphqlQueryToGetCurrentUser,
  graphqlToCreateOnePrompt,
  graphQLToCreateOneWorkspaceMemberProfile,
  ObjectMetadata,
  queryObjectMetadataItems,
  QueryResponse,
} from 'twenty-shared';
import { executeQuery } from './utils/graphqlClient.js';

export class CreateMetaDataStructure {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}
  async axiosRequest(data: string, apiToken: string) {
    console.log('This is the url:', process.env.GRAPHQL_URL);
    const response = await axios.request({
      method: 'post',
      url: process.env.GRAPHQL_URL,
      headers: {
        Origin: process.env.APPLE_ORIGIN_URL,
        authorization: 'Bearer ' + apiToken,
        'content-type': 'application/json',
      },
      data: data,
    });
    return response;
  }

  async getCurrentUser(apiToken: string) {
    let data = JSON.stringify({
      query: graphqlQueryToGetCurrentUser,
      variables: {},
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: process.env.GRAPHQL_URL,
      headers: {
        Origin: process.env.APPLE_ORIGIN_URL,
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },

      data: data,
    };

    const response = await axios.request(config);
    console.log('This is the response:', response.data.data.currentUser);
    console.log('This is the response:', response.data.data);
    console.log('This is the response:', response.data);
    return response.data.data.currentUser;
  }

  async fetchFieldsPage(
    objectId: string,
    cursor: string | null,
    apiToken: string,
  ) {
    try {
      const response = await executeQuery<any>(
        queryObjectMetadataItems,
        { after: cursor || undefined, objectFilter: { id: { eq: objectId }, }, },
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
      queryObjectMetadataItems,
      {},
      apiToken,
    );
    console.log('Thesear the object:::', objectsResponse?.data);
    console.log('Thesear the object:::', objectsResponse);
    return objectsResponse;
  };

  async fetchObjectsNameIdMap(
    apiToken: string,
  ): Promise<Record<string, string>> {
    const objectsResponse = await this.fetchAllObjects(apiToken);
    console.log('objectsResponse:', objectsResponse);
    console.log(
      'objectsResponse.data.data.objects.edges length',
      objectsResponse?.data?.objects?.edges?.length,
    );
    const objectsNameIdMap: Record<string, string> = {};
    objectsResponse?.data?.objects?.edges?.forEach((edge) => {
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
        query: FindManyWorkspaceMembers,
      }),
      apiToken,
    );
    console.log(
      'This is the curent workspace member response:',
      currentWorkspaceMemberResponse.data,
    );
    console.log(
      'This is the curent workspace member response:',
      currentWorkspaceMemberResponse.data.errors,
    );
    console.log(
      'This is the curent workspace member response:',
      currentWorkspaceMemberResponse.data.data,
    );
    // console.log("This is the curent workspace member response:", currentWorkspaceMemberResponse.data)
    // console.log("This is the curent workspace member response:", currentWorkspaceMemberResponse.data.errors)
    const currentWorkspaceMemberId =
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node
        .id;
    console.log(
      'currentWorkspaceMemberId',
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node,
    );
    const currentWorkspaceMemberName =
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node
        .name.firstName +
      ' ' +
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node
        .name.lastName;
    const currentUser = await this.getCurrentUser(apiToken);
    console.log('currentUser', currentUser);
    const createResponse = await this.axiosRequest(
      JSON.stringify({
        variables: {
          input: {
            typeWorkspaceMember: 'recruiterType',
            name: currentWorkspaceMemberName,
            workspaceMemberId: currentWorkspaceMemberId,
            firstName:
              currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0]
                .node.name.firstName,
            lastName:
              currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0]
                .node.name.lastName,
            email:
              currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0]
                .node.userEmail,
            phoneNumber:
              currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0]
                .node.phoneNumber,
            companyName: currentUser.workspaces[0].workspace.displayName,
            companyDescription: 'A Global Recruitment Firm',
            position: 'first',
          },
        },
        query: graphQLToCreateOneWorkspaceMemberProfile,
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
          query: graphqlToCreateOnePrompt,
        }),
        apiToken,
      );
      console.log(`\${prompt.name} created successfully`, createResponse.data);
    }
  }

  async addAPIKeys(apiToken: string) {
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    await this.workspaceQueryService.updateWorkspaceApiKeys(workspaceId, {
      openaikey: process.env.OPENAI_KEY,
      twilio_account_sid: undefined,
      twilio_auth_token: undefined,
      smart_proxy_url: undefined,
      whatsapp_key: undefined,
      anthropic_key: process.env.ANTHROPIC_API_KEY,
      facebook_whatsapp_api_token: process.env.FACEBOOK_WHATSAPP_API_TOKEN,
      facebook_whatsapp_phone_number_id:
      process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID,
      facebook_whatsapp_app_id: process.env.FACEBOOK_WHATSAPP_APP_ID,
      facebook_whatsapp_asset_id: process.env.FACEBOOK_WHATSAPP_ASSET_ID,
      // waba_phone_number: undefined,
      // company_description_oneliner: 'A Global Recruitment Firm',
      // company_name: 'Arxena Inc',
    });
    console.log('API keys updated successfully');
    return;
  }

  async createMetadataStructure(apiToken: string): Promise<void> {
    try {
      console.log('Starting metadata structure creation...');

      const shouldCreateObjectMetadata = true;
      const shouldCreateVideoInterviews = true;
      const shouldCreateArxEnrichments = true;
      const shouldCreateApiKeys = true;

      if (shouldCreateObjectMetadata) {
        try {
          console.log('This is the object creation array:');
          await createObjectMetadataItems(apiToken, objectCreationArr);
          console.log('Object metadata items created successfully');

          const objectsNameIdMap = await this.fetchObjectsNameIdMap(apiToken);

          const fieldsData = getFieldsData(objectsNameIdMap);

          console.log('Number of fieldsData', fieldsData.length);

          await createFields(fieldsData, apiToken);
          console.log('Fields created successfully');
          const relationsFields = getRelationsData(objectsNameIdMap);
          await createRelations(relationsFields, apiToken);
          console.log('Relations created successfully');
        } catch (error) {
          console.log(
            'Error creating object metadata items, fields, or relations:',
            error,
          );
        }
      }

      if (shouldCreateVideoInterviews) {
        try {
          const videoInterviewModelIds =
            await createVideoInterviewModels(apiToken);
          const jobIds = await getJobIds(apiToken);
          await createVideoInterviewTemplates(
            videoInterviewModelIds,
            jobIds,
            apiToken,
          );
          console.log('Video Interview Models created successfully');
          console.log('Video Interviews created successfully');
        } catch (error) {
          console.log('Error creating Video Interview Models:', error);
        }
      }

      if (shouldCreateArxEnrichments) {
        try {
          await createArxEnrichments(apiToken);
          console.log('Arx Enrichments created successfully');
        } catch (error) {
          console.log('Error creating Arx Enrichments:', error);
        }
      }

      if (shouldCreateApiKeys) {
        try {
          const apiKeyService = new ApiKeyService();
          const workspaceMemberId = await this.createAndUpdateWorkspaceMember(apiToken);
          await this.createStartChatPrompt(apiToken);
          const apiKey = await apiKeyService.createApiKey(apiToken);
          console.log('API key created successfully:', apiKey);
          await this.addAPIKeys(apiToken);
        } catch (error) {
          console.log(
            'Error during API key creation or workspace member update:',
            error,
          );
        }
      }
    } catch (error) {
      console.log('Error creating metadata structure:', error);
    }
  }
}
