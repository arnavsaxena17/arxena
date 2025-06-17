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

import { getCurrentUser } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';

// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// eslint-disable-next-line no-restricted-imports
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { WorkspaceQueryService } from '../workspace-modifications.service';

import { Injectable } from '@nestjs/common';
import { render } from '@react-email/render';
import { CreateFieldInput } from 'src/engine/metadata-modules/field-metadata/dtos/create-field.input';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/field-metadata.service';
import { FieldMetadataInterface } from 'src/engine/metadata-modules/field-metadata/interfaces/field-metadata.interface';
import { CreateObjectInput } from 'src/engine/metadata-modules/object-metadata/dtos/create-object.input';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { RelationMetadataType } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';
import { RelationMetadataService } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.service';
import { WorkspaceSetupCompleteEmail } from 'twenty-emails';
import { FieldMetadataType } from 'twenty-shared';
import { getFieldsData } from './data/fieldsData';
import { objectCreationArr } from './data/objectsData';
import { prompts } from './data/prompts';
import { getRelationsData } from './data/relationsData';
import { ApiKeyService } from './services/apiKeyCreation';
import { createArxEnrichments } from './services/arxEnrichmentsService';
import { MetadataUpdateService } from './services/metadata-update.service';
import { createVideoInterviewModels } from './services/videoInterviewModelService';
import {
  createVideoInterviewTemplates,
  getJobIds,
} from './services/videoInterviewTemplateService';
import { executeQuery } from './utils/graphqlClient.js';

interface CustomFieldOption {
  id?: string;
  label: string;
  value: string;
  color?: string;
  position: number;
}

interface ObjectCreationItem {
  object: {
    nameSingular: string;
    namePlural: string;
    labelSingular: string;
    labelPlural: string;
    description: string;
    icon: string;
  };
}

interface CustomFieldMetadata {
  objectMetadataId: string;
  type: FieldMetadataType;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  isNullable?: boolean;
  defaultValue?: any;
  options?: CustomFieldOption[];
}

interface CustomRelationMetadata {
  fromObjectMetadataId: string;
  toObjectMetadataId: string;
  fromName: string;
  toName: string;
  fromLabel: string;
  toLabel: string;
  fromDescription?: string;
  toDescription?: string;
}

@Injectable()
export class CreateMetaDataStructure {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly webSocketService: WebSocketService,
    private readonly objectMetadataService: ObjectMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly relationMetadataService: RelationMetadataService,
    private readonly metadataUpdateService: MetadataUpdateService,
  ) {}

  // Helper method to emit websocket events
  private emitProgress(userId: string, step: string, message: string) {
    if (this.webSocketService) {
      console.log('emitting websocket event', userId, step, message);
      this.webSocketService.sendToUser(userId, 'metadata-structure-progress', {
        step,
        message,
      });
    }
  }

  async axiosRequest(data: string, apiToken: string) {
    console.log('This is the url:', process.env.GRAPHQL_URL);
    try {
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

      // Log any GraphQL errors
      if (response.data?.errors) {
        console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
        throw new Error('GraphQL request failed: ' + JSON.stringify(response.data.errors));
      }

      // Validate response structure
      if (!response.data) {
        console.error('Empty response data');
        throw new Error('Empty response data from GraphQL server');
      }

      return response;
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('GraphQL request failed:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', error.message);
      }
      throw error;
    }
  }

  async getCurrentUser(apiToken: string, origin: string) {
    console.log('Getting current user with origin:', origin);
    const data = JSON.stringify({
      query: graphqlQueryToGetCurrentUser,
      variables: {},
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: process.env.GRAPHQL_URL,
      headers: {
        Origin: origin,
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

  async createAndUpdateWorkspaceMember(apiToken: string, origin: string) {
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
    const currentUser = await this.getCurrentUser(apiToken, origin);

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
      whatsapp_key: 'whatsapp-web',
      anthropic_key: undefined,
      facebook_whatsapp_api_token: process.env.FACEBOOK_WHATSAPP_API_TOKEN,
      facebook_whatsapp_phone_number_id: process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID,
      whatsapp_web_phone_number:'',
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
      (field: { node: { name: string; }; }) => field?.node?.name === "people"
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
  async createMetadataStructure(apiToken: string, origin: string): Promise<void> {
    try {
      console.log('Starting metadata structure creation...');
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      console.log('workspaceId', workspaceId);
      const currentUser = await getCurrentUser(apiToken, origin);
      console.log('currentUser', currentUser);
      const userId = currentUser?.workspaceMember?.id;
      console.log('userId', userId);

      const email = currentUser?.email;
      const firstName = currentUser?.firstName;
      const lastName = currentUser?.lastName;
      
      if (!userId) {
        console.error('Failed to get user ID from workspace');
        return;
      }

      const shouldCreateObjectMetadata = true;
      const shouldCreateVideoInterviews = true;
      const shouldCreateArxEnrichments = true;
      const shouldCreateApiKeys = true;
      const shoudUpdateCandidateViewField = true;

      if (shouldCreateObjectMetadata) {
        try {
          console.log('Creating objects...');
          const createdObjects: any[] = [];
          const failedObjects: string[] = [];
          const requiredObjects = new Set(objectCreationArr.map(item => item.object.nameSingular));

          // First fetch existing metadata to get person and company objects
          console.log('Fetching existing metadata for person and company objects...');
          let currentMetadata = await this.metadataUpdateService.fetchCurrentMetadata(apiToken);

          // Add detailed logging of the response
          console.log('GraphQL Response:', JSON.stringify(currentMetadata, null, 2));
          
          if (!currentMetadata?.data?.objects?.edges) {
            console.error('Invalid response structure. Expected data.objects.edges but got:', currentMetadata);
            throw new Error('Invalid GraphQL response structure');
          }

          // Extract person and company objects from existing metadata
          const existingObjects = currentMetadata.data.objects.edges
            .filter((edge: any) => ['person', 'company'].includes(edge.node.nameSingular))
            .map((edge: any) => edge.node);

          // Check if we found both required objects
          const foundObjectNames = new Set(existingObjects.map((obj: any) => obj.nameSingular));
          const missingSystemObjects = ['person', 'company'].filter(name => !foundObjectNames.has(name));
          
          if (missingSystemObjects.length > 0) {
            throw new Error(`Required system objects not found: ${missingSystemObjects.join(', ')}. These objects should exist in the system.`);
          }

          // Add existing objects to createdObjects array
          createdObjects.push(...existingObjects);
          console.log('Found existing objects:', existingObjects.map((obj: any) => obj.nameSingular));

          // Filter out person and company from objects to create
          const objectsToCreate = objectCreationArr.filter(
            item => !['person', 'company'].includes(item.object.nameSingular)
          );

          // Log the total number of objects to create
          console.log(`Creating ${objectsToCreate.length} new objects...`);
          console.log('Objects to create:', objectsToCreate.map(item => item.object.nameSingular));

          for (const item of objectsToCreate) {
            try {
              const createObjectInput: CreateObjectInput = {
                nameSingular: item.object.nameSingular,
                namePlural: item.object.namePlural,
                labelSingular: item.object.labelSingular,
                labelPlural: item.object.labelPlural,
                description: item.object.description || '',
                icon: item.object.icon || 'IconBox',
                workspaceId,
                dataSourceId: workspaceId,
              };
              const createdObject = await this.objectMetadataService.createOne(createObjectInput);
              if (!createdObject?.id) {
                console.error(`Failed to get ID for created object: ${item.object.nameSingular}`);
                failedObjects.push(item.object.nameSingular);
                continue;
              }
              createdObjects.push(createdObject);
              console.log(`Successfully created object: ${item.object.nameSingular} with ID: ${createdObject.id}`);
            } catch (error) {
              console.error(`Error creating object ${item.object.nameSingular}:`, error);
              failedObjects.push(item.object.nameSingular);
            }
          }

          if (failedObjects.length > 0) {
            console.error('Failed to create the following objects:', failedObjects);
            // Check if any failed objects were required (excluding person and company since they should exist)
            const failedRequiredObjects = failedObjects.filter(obj => 
              requiredObjects.has(obj) && !['person', 'company'].includes(obj)
            );
            if (failedRequiredObjects.length > 0) {
              throw new Error(`Failed to create required objects: ${failedRequiredObjects.join(', ')}`);
            }
          }

          console.log('Creating object name to ID map...');
          const objectNameToIdMap = createdObjects.reduce((acc: Record<string, string>, obj) => {
            if (!obj?.nameSingular || !obj?.id) {
              console.error('Invalid object data for mapping:', obj);
              return acc;
            }
            acc[obj.nameSingular] = obj.id;
            return acc;
          }, {});

          // Log the complete object name to ID map
          console.log('Complete object name to ID map:', objectNameToIdMap);
          console.log('Total objects in map:', Object.keys(objectNameToIdMap).length);

          // Validate that we have all required objects in the map
          const missingObjects = Array.from(requiredObjects).filter(obj => !objectNameToIdMap[obj]);
          if (missingObjects.length > 0) {
            throw new Error(`Missing required objects in ID map: ${missingObjects.join(', ')}`);
          }

          console.log('Creating fields...');
          const fieldsData = getFieldsData(objectNameToIdMap);
          
          // Validate fields data before creation
          const validFields = fieldsData.filter((field) => {
            const typedField = field as unknown as CustomFieldMetadata;
            if (!typedField?.objectMetadataId) {
              console.error(`Missing objectMetadataId for field: ${typedField?.name}`);
              return false;
            }
            return true;
          });

          console.log(`Attempting to create ${validFields.length} fields out of ${fieldsData.length} total fields`);

          const createdFields = await this.fieldMetadataService.createMany(
            validFields.map((field) => {
              const typedField = field as unknown as CustomFieldMetadata;
              return {
                workspaceId,
                objectMetadataId: typedField.objectMetadataId,
                type: typedField.type,
                name: typedField.name,
                label: typedField.label,
                description: typedField.description || '',
                icon: typedField.icon,
                isNullable: typedField.isNullable ?? true,
                defaultValue: typedField.defaultValue,
                options: typedField.options?.map((option, index) => ({
                  ...option,
                  position: option.position ?? index,
                })),
              } as CreateFieldInput;
            })
          );

          console.log('createdFields', createdFields);
          this.emitProgress(userId, 'fields-created', 'Fields created successfully');

          console.log('Creating relations...');
          const relationsData = getRelationsData(objectNameToIdMap);
          const createdRelations: any[] = [];
          for (const relation of relationsData) {
            const typedRelation = relation.relationMetadata;
            if (!typedRelation.fromObjectMetadataId || !typedRelation.toObjectMetadataId || 
                !typedRelation.fromName || !typedRelation.toName || 
                !typedRelation.fromLabel || !typedRelation.toLabel) {
              console.error('Invalid relation metadata:', typedRelation);
              continue;
            }
            const createdRelation = await this.relationMetadataService.createOne({
              workspaceId,
              relationType: RelationMetadataType.ONE_TO_MANY,
              fromObjectMetadataId: typedRelation.fromObjectMetadataId,
              toObjectMetadataId: typedRelation.toObjectMetadataId,
              fromName: typedRelation.fromName,
              toName: typedRelation.toName,
              fromLabel: typedRelation.fromLabel,
              toLabel: typedRelation.toLabel,
              fromDescription: typedRelation.fromDescription || '',
              toDescription: typedRelation.toDescription || '',
            });
            createdRelations.push(createdRelation);
          }

          this.emitProgress(userId, 'relations-created', 'Relations created successfully');
        } catch (error) {
          console.error('Error creating metadata structure:', error);
          throw error;
        }
      }

      if (shouldCreateVideoInterviews) {
        try {
          const videoInterviewModelIds = await createVideoInterviewModels(apiToken);
          const jobIds = await getJobIds(apiToken);
          await createVideoInterviewTemplates(videoInterviewModelIds, jobIds, apiToken);
          
          this.emitProgress(userId, 'video-interviews-created', 'Video interview models and templates created successfully');
        } catch (error) {
          console.error('Error creating video interviews:', error);
        }
      }

      if (shouldCreateArxEnrichments) {
        try {
          await createArxEnrichments(apiToken);
          console.log('Arx Enrichments created successfully');
        } catch (error) {
          console.error('Error creating Arx Enrichments:', error);
        }
      }

      if (shouldCreateApiKeys) {
        try {
          const apiKeyService = new ApiKeyService();
          const workspaceMemberId = await this.createAndUpdateWorkspaceMember(apiToken, origin);
          await this.createPrompts(apiToken);
          await apiKeyService.createApiKey(apiToken);
          await this.addAPIKeys(apiToken);
          
          this.emitProgress(userId, 'api-keys-added', 'API keys and prompts configured successfully');
        } catch (error) {
          console.error('Error during API key creation or workspace member update:', error);
        }
      }

      if (shoudUpdateCandidateViewField) {
        try {
          await this.updateCandidateViewField(apiToken);
          this.emitProgress(userId, 'candidate-view-updated', 'Candidate view field updated successfully');
          this.emitProgress(userId, 'metadata-structure-complete', 'Metadata structure creation completed successfully');
          
          // Send completion email to user
          const workspaceName = await this.workspaceQueryService.getWorkspaceNameFromToken(apiToken);
          
          const emailTemplate = WorkspaceSetupCompleteEmail({
            firstName,
            workspaceName: workspaceName || 'Arxena',
            locale: 'en',
          });

          const html = render(emailTemplate);
          const text = render(emailTemplate, {
            plainText: true,
          });

          await this.workspaceQueryService.emailService.send({
            from: `Arxena <${process.env.EMAIL_FROM_ADDRESS || 'no-reply@arxena.com'}>`,
            to: email,
            subject: 'Your Arxena Workspace is Ready! 🚀',
            html,
            text,
          });
        } catch (error) {
          console.error('Error updating candidate view field:', error);
        }
      }
    } catch (error) {
      console.error('Error creating metadata structure:', error);
      throw error;
    }
  }
}
