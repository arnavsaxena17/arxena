import axios from 'axios';
import {
    createViewFieldMutation,
    findManyViewsQuery,
    FindManyWorkspaceMembers,
    findWorkspaceMemberProfiles,
    graphqlQueryToGetCurrentUser,
    graphqlToCreateOnePrompt,
    graphQLToCreateOneWorkspaceMemberProfile,
    graphQLToUpdateOneWorkspaceMemberProfile,
    isOrgChartEnabledEnv,
    queryObjectMetadataItems,
    resolveIsOrgChartEnabledFromWorkspace,
} from 'twenty-shared';

// import { getCurrentUser } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';

// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// eslint-disable-next-line no-restricted-imports
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { WorkspaceQueryService } from '../workspace-modifications.service';

import { render } from '@react-email/render';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { FieldMetadataInterface } from 'src/engine/metadata-modules/field-metadata/interfaces/field-metadata.interface';
import { WorkspaceSetupCompleteEmail } from 'twenty-emails';
import { getFieldsData } from './data/fieldsData';
import { getObjectCreationArr } from './data/objectsData';
import { prompts } from './data/prompts';
import { getRelationsData } from './data/relationsData';
import { ApiKeyService } from './services/apiKeyCreation';
import { createArxAiFilters } from './services/arxAiFiltersService';
import { createFields } from './services/field-service';
import { createObjectMetadataItems } from './services/object-service';
import { createRelations } from './services/relation-service';
import { createVideoInterviewModels } from './services/videoInterviewModelService';
import {
    createVideoInterviewTemplates,
    getJobIds,
} from './services/videoInterviewTemplateService';
import { executeQuery } from './utils/graphqlClient';

type MetadataObjectsResponse = {
  data?: {
    objects?: {
      edges?: Array<{
        node?: {
          nameSingular?: string;
          id?: string;
          fields?: { edges?: Array<{ node?: { name?: string } }> };
        };
      }>;
    };
  };
};

export class CreateMetaDataStructure {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly environmentService: EnvironmentService,
    private readonly webSocketService?: WebSocketService,


  ) {}

  // Helper method to emit websocket events
  private async emitProgress(userId: string, step: string, message: string) {
    console.log('Attempting to emit progress - userId:', userId, 'step:', step, 'message:', message);
    if (!this.webSocketService) {
      console.error('WebSocketService is not available in CreateMetaDataStructure');
      return;
    }
    if (!userId) {
      console.error('No userId provided to emitProgress');
      return;
    }
    
    try {
      console.log('Calling webSocketService.sendToUser with:', {userId, event: 'metadata-structure-progress', data: {step, message}});
      this.webSocketService.sendToUser(userId, 'metadata-structure-progress', {
        step,
        message,
      });

      // Wait for acknowledgment with a 5-second timeout
      await this.webSocketService.waitForAcknowledgment(userId, 5000);
      console.log(`Progress message acknowledged by user ${userId} for step ${step}`);
    } catch (error) {
      console.error(`Failed to get acknowledgment from user ${userId} for step ${step}:`, error);
      // Continue execution even if acknowledgment fails - don't block the metadata creation process
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
    origin: string,
  ) {
    try {
      const response = await executeQuery<MetadataObjectsResponse>(
        queryObjectMetadataItems,
        { after: cursor || undefined, objectFilter: { id: { eq: objectId } } },
        apiToken,
        origin,
        3,
      );
      console.log('fetchFieldsPage response:', response?.data);
      return response;
    } catch (error) {
      console.error('Error fetching fields page:', error);
      throw error;
    }
  }

  fetchAllObjects = async (
    apiToken: string,
    origin: string,
    maxRetries: number = 3,
  ): Promise<MetadataObjectsResponse> => {
    const objectsResponse = await executeQuery<MetadataObjectsResponse>(
      queryObjectMetadataItems,
      {},
      apiToken,
      origin,
      maxRetries,
    );
    console.log('fetchAllObjects (metadata HTTP):', objectsResponse?.data);
    return objectsResponse;
  };

  async fetchObjectsNameIdMap(
    apiToken: string,
    origin: string,
    maxRetries: number = 3
  ): Promise<Record<string, string>> {
    const objectsResponse = await this.fetchAllObjects(apiToken, origin);

    console.log('objectsResponse:', objectsResponse);
    console.log(
      'objectsResponse.data.objects.edges length',
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
    // console.log("createAndUpdateWorkspaceMember::", apiToken);
    console.log("createAndUpdateWorkspaceMember::", origin);
    const currentWorkspaceMemberResponse = await this.staticGraphQLService.executeGraphQL(FindManyWorkspaceMembers, { limit: 60, orderBy: [{ createdAt: 'AscNullsLast' }] }, apiToken);

    // console.log(
    //   'This is the curent workspace member response first:',
    //   JSON.stringify(currentWorkspaceMemberResponse?.data, null, 2),
    // );

    const currentWorkspaceMemberId =
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node
        .id;

    const currentWorkspaceMemberName =
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node
        .name.firstName +
      ' ' +
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node
        .name.lastName;
    const currentUser = await this.getCurrentUser(apiToken, origin);

    console.log('currentUser', currentUser);

    const memberNode =
      currentWorkspaceMemberResponse.data.data.workspaceMembers.edges[0].node;
    const profilePayload = {
      typeWorkspaceMember: 'recruiterType' as const,
      name: currentWorkspaceMemberName,
      workspaceMemberId: currentWorkspaceMemberId,
      firstName: memberNode.name.firstName,
      lastName: memberNode.name.lastName,
      email: memberNode.userEmail,
      phoneNumber: memberNode.phoneNumber,
      companyName: currentUser.workspaces[0].workspace.displayName,
      jobTitle:'Senior Recruiter',
      companyDescription: 'A Global Recruitment Firm',
      position: 'first',
    };

    const existingProfileResponse =
      await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberProfiles,
        {
          filter: { workspaceMemberId: { eq: currentWorkspaceMemberId } },
          limit: 1,
        },
        apiToken,
      );

    const existingProfileId =
      existingProfileResponse?.data?.data?.workspaceMemberProfiles?.edges?.[0]
        ?.node?.id;

    if (existingProfileId) {
      const { workspaceMemberId: _omitMemberId, ...profileUpdateInput } =
        profilePayload;
      const updateResponse =
        await this.staticGraphQLService.executeGraphQL(
          graphQLToUpdateOneWorkspaceMemberProfile,
          {
            idToUpdate: existingProfileId,
            input: profileUpdateInput,
          },
          apiToken,
        );
      console.log(
        'Workspace member profile updated successfully',
        updateResponse.data,
      );
    } else {
      const createResponse =
        await this.staticGraphQLService.executeGraphQL(
          graphQLToCreateOneWorkspaceMemberProfile,
          { input: profilePayload },
          apiToken,
        );
      console.log(
        'Workspace member profile created successfully',
        createResponse.data,
      );
    }

    return currentWorkspaceMemberId;
  }

  async createPrompts(apiToken: string) {
    for (const prompt of prompts) {

      const createResponse = await this.staticGraphQLService.executeGraphQL(graphqlToCreateOnePrompt, {
        input: {
          name: prompt.name,
          prompt: prompt.prompt,
          position: 'first',
        },
      }, apiToken);
      console.log(`${prompt.name} created successfully`);
    }
  }

  async addAPIKeys(apiToken: string) {
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    await this.workspaceQueryService.updateWorkspaceKeys(workspaceId, {
      openaikey: process.env.OPENAI_KEY,
      twilio_account_sid: undefined,
      twilio_auth_token: undefined,
      linkedin_url: undefined,
      whatsapp_key: process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile',
      anthropic_key: undefined,
      facebook_whatsapp_api_token: process.env.FACEBOOK_WHATSAPP_API_TOKEN,
      facebook_whatsapp_phone_number_id: process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID,
      whatsapp_web_phone_number:'',
      facebook_whatsapp_app_id: process.env.FACEBOOK_WHATSAPP_APP_ID,
      facebook_whatsapp_asset_id: process.env.FACEBOOK_WHATSAPP_ASSET_ID,
      is_org_chart_enabled: isOrgChartEnabledEnv ? 'true' : 'false',
      // waba_phone_number: undefined,
      // company_description_oneliner: 'A Global Recruitment Firm',
      // company_name: 'Arxena Inc',
    });
    console.log('API keys updated successfully');

    return;
  }


  async updateCandidateViewField(apiToken: string, origin:string) {
    const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    console.log('workspaceId', workspaceId);

    const objectsResponse = await this.fetchAllObjects(apiToken, origin);
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


    const fieldsPageResponse = await this.fetchFieldsPage(candidateObjectMetadataId || '', null, apiToken, origin);
    console.log('fieldsPageResponse', fieldsPageResponse);
    const fieldsEdges = fieldsPageResponse?.data?.objects?.edges;
    console.log('fieldsPageResponse edges', fieldsEdges?.[0]?.node?.fields);
    console.log('fieldsPageResponse edges length', fieldsEdges?.length ?? 0);

    const peopleField = fieldsEdges?.[0]?.node?.fields?.edges?.find(
      (field: { node: { name: string } }) => field?.node?.name === 'people',
    );
    console.log('peopleField', peopleField);

    if (!peopleField?.node) {
      throw new Error("People field not found in candidate object");
    }

    const fieldMetadataId = (peopleField.node as FieldMetadataInterface).id;
    console.log('fieldMetadataId', fieldMetadataId);

    const viewsResponse = await this.staticGraphQLService.executeGraphQL(findManyViewsQuery, { filter: { objectMetadataId: { eq: candidateObjectMetadataId } } }, apiToken);

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


      const response = await this.staticGraphQLService.executeGraphQL(createViewFieldMutation, { input }, apiToken);

      console.log('View field created successfully:', response.data);
    } catch (error) {
      console.error('Error creating view field:', error);
      throw error;
    }
  }

  async createDatabaseIndices(apiToken: string) {
    try {
      console.log('Creating database indices...');
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const dataSourceSchema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
      
      console.log('Creating indices for schema:', dataSourceSchema);

      // Helper function to check if table exists
      const checkTableExists = async (tableName: string): Promise<boolean> => {
        return this.workspaceQueryService.checkIfTableExists(dataSourceSchema, tableName);
      };

      // Helper function to check if column exists in table
      const checkColumnExists = async (tableName: string, columnName: string): Promise<boolean> => {
        return this.workspaceQueryService.checkIfColumnExists(dataSourceSchema, tableName, columnName);
      };

      // Define indices with their table and column requirements
      const indexDefinitions = [
        {
          name: 'idx_whatsapp_message_comprehensive',
          table: '_whatsappMessage',
          query: `CREATE INDEX IF NOT EXISTS idx_whatsapp_message_comprehensive ON "${dataSourceSchema}"."_whatsappMessage" ( "candidateId", "updatedAt" DESC, "createdAt" DESC, "id", "message", "whatsappDeliveryStatus", "name", "recruiterId", "jobsId", "position", "phoneTo", "phoneFrom" )`,
          requiredColumns: ['candidateId', 'updatedAt', 'createdAt', 'id', 'message', 'whatsappDeliveryStatus', 'name', 'recruiterId', 'jobsId', 'position', 'phoneTo', 'phoneFrom']
        },
        {
          name: 'idx_whatsapp_message_delivery_status',
          table: '_whatsappMessage',
          query: `CREATE INDEX IF NOT EXISTS idx_whatsapp_message_delivery_status ON "${dataSourceSchema}"."_whatsappMessage" ("whatsappDeliveryStatus")`,
          requiredColumns: ['whatsappDeliveryStatus']
        },
        {
          name: 'idx_whatsapp_message_recruiter',
          table: '_whatsappMessage',
          query: `CREATE INDEX IF NOT EXISTS idx_whatsapp_message_recruiter ON "${dataSourceSchema}"."_whatsappMessage" ("recruiterId")`,
          requiredColumns: ['recruiterId']
        },
        {
          name: 'idx_whatsapp_message_job',
          table: '_whatsappMessage',
          query: `CREATE INDEX IF NOT EXISTS idx_whatsapp_message_job ON "${dataSourceSchema}"."_whatsappMessage" ("jobsId")`,
          requiredColumns: ['jobsId']
        },
        {
          name: 'idx_whatsapp_message_created_at',
          table: '_whatsappMessage',
          query: `CREATE INDEX IF NOT EXISTS idx_whatsapp_message_created_at ON "${dataSourceSchema}"."_whatsappMessage" ("createdAt")`,
          requiredColumns: ['createdAt']
        },
        {
          name: 'idx_candidate_comprehensive',
          table: '_candidate',
          query: `CREATE INDEX IF NOT EXISTS idx_candidate_comprehensive ON "${dataSourceSchema}"."_candidate" ( "jobsId", "updatedAt" DESC, "engagementStatus", "candConversationStatus", "stopChat", "startChat", "startVideoInterviewChatCompleted", "status", "source", "campaign", "id" ) WHERE "deletedAt" IS NULL`,
          requiredColumns: ['jobsId', 'updatedAt', 'engagementStatus', 'candConversationStatus', 'stopChat', 'startChat', 'startVideoInterviewChatCompleted', 'status', 'source', 'campaign', 'id', 'deletedAt']
        },
        {
          name: 'idx_candidate_deleted_at',
          table: '_candidate',
          query: `CREATE INDEX IF NOT EXISTS idx_candidate_deleted_at ON "${dataSourceSchema}"."_candidate" ("deletedAt") WHERE "deletedAt" IS NULL`,
          requiredColumns: ['deletedAt']
        },
        {
          name: 'idx_candidate_field_value_comprehensive',
          table: '_candidateFieldValue',
          query: `CREATE INDEX IF NOT EXISTS idx_candidate_field_value_comprehensive ON "${dataSourceSchema}"."_candidateFieldValue" ( "candidateId", "candidateFieldsId", "position", "id", "name" )`,
          requiredColumns: ['candidateId', 'candidateFieldsId', 'position', 'id', 'name']
        },
        {
          name: 'idx_candidate_field_value_candidate_id',
          table: '_candidateFieldValue',
          query: `CREATE INDEX IF NOT EXISTS idx_candidate_field_value_candidate_id ON "${dataSourceSchema}"."_candidateFieldValue" ("candidateId")`,
          requiredColumns: ['candidateId']
        },
        {
          name: 'idx_candidate_field_value_field_id',
          table: '_candidateFieldValue',
          query: `CREATE INDEX IF NOT EXISTS idx_candidate_field_value_field_id ON "${dataSourceSchema}"."_candidateFieldValue" ("candidateFieldsId")`,
          requiredColumns: ['candidateFieldsId']
        },
        {
          name: 'idx_candidate_field_comprehensive',
          table: '_candidateField',
          query: `CREATE INDEX IF NOT EXISTS idx_candidate_field_comprehensive ON "${dataSourceSchema}"."_candidateField" ( "jobsId", "position", "id", "name" )`,
          requiredColumns: ['jobsId', 'position', 'id', 'name']
        },
        {
          name: 'idx_candidate_field_id',
          table: '_candidateField',
          query: `CREATE INDEX IF NOT EXISTS idx_candidate_field_id ON "${dataSourceSchema}"."_candidateField" ("id")`,
          requiredColumns: ['id']
        },
        {
          name: 'idx_phone_call_candidate_updated',
          table: '_phoneCall',
          query: `CREATE INDEX IF NOT EXISTS idx_phone_call_candidate_updated ON "${dataSourceSchema}"."_phoneCall" ( "candidateId", "updatedAt" DESC )`,
          requiredColumns: ['candidateId', 'updatedAt']
        },
        {
          name: 'idx_attachment_comprehensive',
          table: '_attachment',
          query: `CREATE INDEX IF NOT EXISTS idx_attachment_comprehensive ON "${dataSourceSchema}"."_attachment" ( "candidateId", "createdAt" DESC, "id", "name", "fullPath", "authorId", "type" )`,
          requiredColumns: ['candidateId', 'createdAt', 'id', 'name', 'fullPath', 'authorId', 'type']
        },
        {
          name: 'idx_attachment_author_id',
          table: '_attachment',
          query: `CREATE INDEX IF NOT EXISTS idx_attachment_author_id ON "${dataSourceSchema}"."_attachment" ("authorId")`,
          requiredColumns: ['authorId']
        },
        {
          name: 'idx_jobs_active',
          table: '_job',
          query: `CREATE INDEX IF NOT EXISTS idx_jobs_active ON "${dataSourceSchema}"."_job" ("isActive") WHERE "isActive" = true`,
          requiredColumns: ['isActive']
        }
      ];

      for (const indexDef of indexDefinitions) {
        try {
          // Check if table exists
          const tableExists = await checkTableExists(indexDef.table);
          if (!tableExists) {
            console.log(`Skipping index ${indexDef.name} - table ${indexDef.table} does not exist`);
            continue;
          }

          let allColumnsExist = true;
          for (const column of indexDef.requiredColumns) {
            const columnExists = await checkColumnExists(indexDef.table, column);
            if (!columnExists) {
              console.log(`Skipping index ${indexDef.name} - column ${column} does not exist in table ${indexDef.table}`);
              allColumnsExist = false;
              break;
            }
          }

          if (!allColumnsExist) {
            continue;
          }

          await this.workspaceQueryService.executeRawQuery(indexDef.query, [], workspaceId);
        } catch (error) {
          console.error('Error creating index:', indexDef.query, error);
        }
      }

      console.log('Database indices created successfully');
    } catch (error) {
      console.error('Error creating database indices:', error);
      throw error;
    }
  }

  async createMetadataStructure(apiToken: string, origin: string): Promise<void> {
    try {
      console.log('Starting metadata structure creation... for origin', origin);
      const workspaceId = await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      console.log('workspaceId', workspaceId);
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      console.log('currentUser', currentUser);
      const userId = currentUser?.workspaceMember?.id;
      console.log('userId', userId);

      const email = currentUser?.email;
      console.log('email', email);
      const firstName = currentUser?.firstName;
      console.log('firstName', firstName);
      const lastName = currentUser?.lastName;
      console.log('lastName', lastName);
      
      if (!userId) {
        console.error('Failed to get user ID from workspace');
        return;
      }
      console.log('userId', userId);

      const workspaceKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      const isOrgChartEnabled = resolveIsOrgChartEnabledFromWorkspace(
        workspaceKeys?.is_org_chart_enabled,
      );
      console.log('workspace keys:', workspaceKeys?.is_org_chart_enabled);
        console.log("workspace isOrgChartEnabled:", isOrgChartEnabled)
      const objectCreationArr = getObjectCreationArr(isOrgChartEnabled);

      const shouldCreateVideoInterviews = false;
      const shouldCreateArxEnrichments = true;
      const shouldCreateApiKeys = true;
      const shouldCreatePrompts = true;
      const shoudUpdateCandidateViewField = true;
      const shouldCreateDatabaseIndices = true;

      const customObjectNames = objectCreationArr
        .map((item) => item?.object?.nameSingular)
        .filter((name): name is string => !!name);
      const objectsNameIdMap = await this.fetchObjectsNameIdMap(
        apiToken,
        origin,
        3,
      );
      const customMetadataAlreadyExists = customObjectNames.every(
        (name) => !!objectsNameIdMap[name],
      );

      if (!customMetadataAlreadyExists) {
        try {
          console.log('This is the object creation array:');
          await createObjectMetadataItems(apiToken, objectCreationArr, origin);
          console.log('Object metadata items created successfully');
          const mapAfterCreate = await this.fetchObjectsNameIdMap(
            apiToken,
            origin,
            3,
          );
          const fieldsData = getFieldsData(mapAfterCreate, isOrgChartEnabled);
          console.log('Number of fieldsData', fieldsData.length);

          await createFields(fieldsData, apiToken, origin, 3);
          console.log('Fields created successfully');
          const relationsFields = getRelationsData(
            mapAfterCreate,
            isOrgChartEnabled,
          );

          await createRelations(relationsFields, apiToken, origin, 3);
          console.log('Relations created successfully');

          this.emitProgress(
            userId,
            'relations-created',
            'Objects and relationships created successfully',
          );
        } catch (error) {
          console.log(
            'Error creating object metadata items, fields, or relations:',
            error,
          );
        }
      }

      if (shouldCreateDatabaseIndices) {
        try {
          await this.createDatabaseIndices(apiToken);
          console.log('Database indices created successfully');
          
          // Send websocket notification after indices are created
          this.emitProgress(userId, 'indices-created', 'Database indices created successfully');
        } catch (error) {
          console.log('Error creating database indices:', error);
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
          
          // Send websocket notification after video interview templates are created
          this.emitProgress(userId, 'video-interviews-created', 'Video interview models and templates created successfully');
        } catch (error) {
          console.log('Error creating Video Interview Models:', error);
        }
      }

      if (shouldCreateArxEnrichments) {
        try {
          console.log('Creating Arx Enrichments...');
          await createArxAiFilters(apiToken);
          console.log('Arx Enrichments created successfully');
        } catch (error) {
          console.log('Error creating Arx Enrichments:', error);
        }
      }

      console.log('Creating prompts...');
      if (shouldCreatePrompts) {
        try {
          console.log('Creating prompts...');
          await this.createPrompts(apiToken);
          console.log('Prompts created successfully');
        } catch (error) {
          console.log('Error creating prompts:', error);
        }
      }

      console.log('Creating API keys...');
      if (shouldCreateApiKeys) {
        try {
          console.log('Creating API keys...');
          const apiKeyService = new ApiKeyService();
          const workspaceMemberId =
            await this.createAndUpdateWorkspaceMember(apiToken, origin);
          const apiKey = await apiKeyService.createApiKey(apiToken, origin);

          console.log('API key created successfully:', apiKey);
          await this.addAPIKeys(apiToken);
          
          // Send websocket notification after API keys are added
          this.emitProgress(userId, 'api-keys-added', 'API keys and prompts configured successfully');
        } catch (error) {
          console.log(
            'Error during API key creation or workspace member update:',
            error,
          );
        }
      }

      if (shoudUpdateCandidateViewField) {
        try {
          await this.updateCandidateViewField(apiToken, origin);
          
          // Send websocket notification after candidate view field is updated
          this.emitProgress(userId, 'candidate-view-updated', 'Candidate view field updated successfully');
          
          // Send completion event to trigger page reload
          this.emitProgress(userId, 'metadata-structure-complete', 'Metadata structure creation completed successfully');
          console.log('Sending completion email to user');
          const workspaceName =
            await this.workspaceQueryService.getWorkspaceNameFromToken(apiToken);

          if (this.environmentService.get('SKIP_WORKSPACE_SETUP_COMPLETE_EMAIL')) {
            console.log( 'SKIP WORKSPACE SETUP COMPLETE EMAIL is true; skipping workspace ready email' );
          } else {
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
              from: `${this.environmentService.get(
                'EMAIL_FROM_NAME',
              )} <${this.environmentService.get('EMAIL_FROM_ADDRESS')}>`,
              to: email,
              subject: 'Your Arxena Workspace is Ready! 🚀',
              html,
              text,
            });
          }

        } catch (error) {
          console.log('Error updating candidate view field:', error);
        }
      }
    } catch (error) {
      console.log('Error creating metadata structure:', error);
    }
  }
}
