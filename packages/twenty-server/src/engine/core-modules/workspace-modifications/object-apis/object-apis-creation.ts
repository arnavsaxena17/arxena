import axios from 'axios';
import {
  createViewFieldMutation,
  findManyViewsQuery,
  FindManyWorkspaceMembers,
  graphqlQueryToGetCurrentUser,
  graphqlToCreateOnePrompt,
  graphQLToCreateOneWorkspaceMemberProfile,
  ObjectMetadata,
  queryObjectMetadataItems,
  QueryResponse,
} from 'twenty-shared';

// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// eslint-disable-next-line no-restricted-imports
import { WorkspaceQueryService } from '../workspace-modifications.service';

import { FieldMetadataInterface } from 'src/engine/metadata-modules/field-metadata/interfaces/field-metadata.interface';
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
      timeout: 10000,
    });

    return response;
  }

  async getCurrentUser(apiToken: string) {
    const data = JSON.stringify({
      query: graphqlQueryToGetCurrentUser,
      variables: {},
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: process.env.GRAPHQL_URL,
      headers: {
        Origin: process.env.APPLE_ORIGIN_URL,
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
      timeout: 10000,
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
        { after: cursor || undefined, objectFilter: { id: { eq: objectId } } },
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
      currentWorkspaceMemberResponse?.data,
    );
    console.log(
      'This is the curent workspace member response:',
      currentWorkspaceMemberResponse?.data?.errors,
    );
    console.log(
      'This is the curent workspace member response:',
      currentWorkspaceMemberResponse?.data?.data,
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

  async createPrompts(apiToken: string) {
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
      linkedin_url: undefined,
      whatsapp_key: 'whatsapp-official',
      anthropic_key: process.env.ANTHROPIC_API_KEY,
      facebook_whatsapp_api_token: process.env.FACEBOOK_WHATSAPP_API_TOKEN,
      facebook_whatsapp_phone_number_id:
        process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID,
        whatsapp_web_phone_number:'918411937769',
      facebook_whatsapp_app_id: process.env.FACEBOOK_WHATSAPP_APP_ID,
      facebook_whatsapp_asset_id: process.env.FACEBOOK_WHATSAPP_ASSET_ID,
      // waba_phone_number: undefined,
      // company_description_oneliner: 'A Global Recruitment Firm',
      // company_name: 'Arxena Inc',
    });
    console.log('API keys updated successfully');

    return;
  }


  async updateCandidateViewField(apiToken: string) {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    console.log('workspaceId', workspaceId);

    const objectsResponse = await this.fetchAllObjects(apiToken);
    if (!objectsResponse?.data?.objects?.edges) {
      throw new Error("Failed to fetch objects");
    }

    const candidateObject = objectsResponse.data.objects.edges.find(
      (edge) => edge?.node?.nameSingular === "candidate"
    );

    if (!candidateObject?.node) {
      throw new Error("Candidate object not found");
    }

    const candidateObjectMetadataId = candidateObject.node.id;
    console.log('candidateObjectMetadataId', candidateObjectMetadataId);


    const fieldsPageResponse = await this.fetchFieldsPage(candidateObjectMetadataId || '', null, apiToken);
    console.log('fieldsPageResponse', fieldsPageResponse);
    console.log('fieldsPageResponse edges', fieldsPageResponse?.data?.objects?.edges[0]?.node?.fields);
    console.log('fieldsPageResponse edges length', fieldsPageResponse?.data?.objects?.edges.length);

    const peopleField = fieldsPageResponse?.data?.objects?.edges[0]?.node?.fields?.edges?.find(
      (field) => field?.node?.name === "people"
    );
    console.log('peopleField', peopleField);

    if (!peopleField?.node) {
      throw new Error("People field not found in candidate object");
    }

    const fieldMetadataId = (peopleField.node as FieldMetadataInterface).id;
    console.log('fieldMetadataId', fieldMetadataId);

    // Get the candidate view using the object metadata ID
   

    const viewsResponse = await this.axiosRequest(
      JSON.stringify({
        variables: {
          filter: {
            objectMetadataId: { eq: candidateObjectMetadataId }
          }
        },
        query: findManyViewsQuery
      }),
      apiToken
    );

    if (!viewsResponse?.data?.data?.views?.edges?.[0]?.node) {
      throw new Error("No views found for candidate object");
    }

    const viewId = viewsResponse.data.data.views.edges[0].node.id;
    console.log('viewId', viewId);


    const input = {
      fieldMetadataId,
      viewId,
      isVisible: true,
      position: 30,
      size: 100
    };

    try {
      const response = await this.axiosRequest(
        JSON.stringify({
          variables: { input },
          query: createViewFieldMutation,
        }),
        apiToken
      );

      console.log('View field created successfully:', response.data);
    } catch (error) {
      console.error('Error creating view field:', error);
      throw error;
    }
  }
  async createMetadataStructure(apiToken: string): Promise<void> {
    try {
      console.log('Starting metadata structure creation...');

      const shouldCreateObjectMetadata = true;
      const shouldCreateVideoInterviews = true;
      const shouldCreateArxEnrichments = true;
      const shouldCreateApiKeys = true;
      const shoudUpdateCandidateViewField = true;

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
          const workspaceMemberId =
            await this.createAndUpdateWorkspaceMember(apiToken);

          await this.createPrompts(apiToken);
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


      if (shoudUpdateCandidateViewField) {
        try {
          await this.updateCandidateViewField(apiToken);
        } catch (error) {
          console.log('Error updating candidate view field:', error);
        }
      }



    } catch (error) {
      console.log('Error creating metadata structure:', error);
    }
  }
}
