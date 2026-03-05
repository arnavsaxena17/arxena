import { Injectable } from '@nestjs/common';
import { axiosRequestForMetadata } from 'src/engine/core-modules/candidate-sourcing/utils/utils';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from '../../workspace-modifications.service';
import { getFieldsData } from '../data/fieldsData';
import { getObjectCreationArr } from '../data/objectsData';
import { getRelationsData } from '../data/relationsData';
import { createFields } from './field-service';
import { createObjectMetadataItems } from './object-service';
import { createRelations } from './relation-service';

@Injectable()
export class MetadataUpdateService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}
  async fetchCurrentMetadata(token: string) {
    try {
      const data = JSON.stringify({
        query: `query ObjectMetadataItems($objectFilter: ObjectFilter, $fieldFilter: FieldFilter) {
          objects(paging: {first: 1000}, filter: $objectFilter) {
            edges {
              node {
                id
                dataSourceId
                nameSingular
                namePlural
                labelSingular
                labelPlural
                description
                icon
                isCustom
                isRemote
                isActive
                isSystem
                createdAt
                updatedAt
                labelIdentifierFieldMetadataId
                imageIdentifierFieldMetadataId
                fields(paging: {first: 1000}, filter: $fieldFilter) {
                  edges {
                    node {
                      id
                      type
                      name
                      label
                      description
                      icon
                      isCustom
                      isActive
                      isSystem
                      isNullable
                      createdAt
                      updatedAt
                      defaultValue
                      options
                      fromRelationMetadata {
                        id
                        relationType
                        toObjectMetadata {
                          id
                          dataSourceId
                          nameSingular
                          namePlural
                          isSystem
                          isRemote
                        }
                        toFieldMetadataId
                      }
                      toRelationMetadata {
                        id
                        relationType
                        fromObjectMetadata {
                          id
                          dataSourceId
                          nameSingular
                          namePlural
                          isSystem
                          isRemote
                        }
                        fromFieldMetadataId
                      }
                      relationDefinition {
                        relationId
                        direction
                        sourceObjectMetadata {
                          id
                          nameSingular
                          namePlural
                        }
                        sourceFieldMetadata {
                          id
                          name
                        }
                        targetObjectMetadata {
                          id
                          nameSingular
                          namePlural
                        }
                        targetFieldMetadata {
                          id
                          name
                        }
                      }
                    }
                  }
                  pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }`,
        variables: {},
      });

      const response = await axiosRequestForMetadata(data, token);
      return response.data;
    } catch (error) {
      console.error('Error fetching metadata:', error);
      throw error;
    }
  }

  compareMetadata(
    currentMetadata: any,
    objectsNameIdMap: Record<string, string>,
    isOrgChartEnabled?: boolean,
  ) {
    const objectIds = currentMetadata.data.objects.edges.map(
      (edge: any) => edge.node.id,
    );
    console.log('objectIds', objectIds);
    const existingObjectsById = new Map(
      currentMetadata.data.objects.edges.map((edge: any) => [
        edge.node.id,
        edge.node,
      ]),
    );
    console.log(
      'existingObjectsById',
      Array.from(existingObjectsById.values()).map(
        (edge: any) => edge.nameSingular,
      ),
    );
    const existingObjectNames = new Set(
      currentMetadata.data.objects.edges.map((edge: any) => edge.node.nameSingular),
    );
    const objectCreationArr = getObjectCreationArr(isOrgChartEnabled);
    const newObjects = objectCreationArr.filter(
      (obj) => !existingObjectNames.has(obj.object.nameSingular),
    );
    console.log('existingObjectNames', existingObjectNames);
    console.log('newObjects', newObjects);
    const fieldsData = getFieldsData(objectsNameIdMap, isOrgChartEnabled);
    console.log('Processing fields:', fieldsData.map(field => ({
      name: field?.field?.name,
      objectMetadataId: field?.field?.objectMetadataId,
      type: field?.field?.type
    })));
    const existingFields = new Map();
    currentMetadata.data.objects.edges.forEach((objEdge: any) => {
      const objName = objEdge.node.nameSingular;
      if (objEdge.node.fields?.edges) {
        objEdge.node.fields.edges.forEach((fieldEdge: any) => {
          const key = `${objName}:${fieldEdge.node.name}`;
          existingFields.set(key, fieldEdge.node);
        });
      }
    });
    console.log('Checking candidateEnrichment fields:');
    fieldsData
      .filter(field => field?.field?.objectMetadataId === objectsNameIdMap.candidateEnrichment)
      .forEach(field => {
        if (field?.field?.name) {
          const key = `candidateEnrichment:${field.field.name}`;
          console.log(`Field ${field.field.name} exists: ${existingFields.has(key)}`);
        }
    });

    console.log('existingFields', Array.from(existingFields.values()).map((edge: any) => edge.name));
    console.log('fieldsData', fieldsData.map((field: any) => field.field.name));
    const newFields = fieldsData.filter((field) => {
      if (!field?.field?.objectMetadataId || !field?.field?.name) {
        console.log('Skipping field due to missing objectMetadataId or name:', field?.field);
        return false;
      }

      const fieldData = field.field; // Capture the non-null field data
      
      // Find the object name by matching the objectMetadataId against the values in objectsNameIdMap
      const objectName = Object.entries(objectsNameIdMap).find(
        ([_, id]) => id === fieldData.objectMetadataId
      )?.[0];

      if (!objectName) {
        console.log('Skipping field due to missing object name for ID:', fieldData.objectMetadataId);
        return false;
      }

      const key = `${objectName}:${fieldData.name}`;
      console.log(`Checking field ${key}, exists: ${existingFields.has(key)}`);
      return !existingFields.has(key);
    });

    console.log('newFields', newFields.map((field: any) => ({
      name: field.field.name,
      objectId: field.field.objectMetadataId,
      key: `${currentMetadata.data.objects.edges.find(
        (edge: any) => edge.node.id === objectsNameIdMap[field.field.objectMetadataId]
      )?.node.nameSingular}:${field.field.name}`
    })));
    const relationsData = getRelationsData(
      objectsNameIdMap,
      isOrgChartEnabled,
    );
    const existingRelations = new Set();
    currentMetadata.data.objects.edges.forEach((objEdge: any) => {
      const objName = objEdge.node.nameSingular;
      if (objEdge.node.fields?.edges) {
        objEdge.node.fields.edges.forEach((fieldEdge: any) => {
          if (fieldEdge.node.type === 'RELATION') {
            const key = `${objName}:${fieldEdge.node.name}`;
            existingRelations.add(key);
          }
        });
      }
    });
    console.log('existingRelations', existingRelations);
    // Find new relations to create
    const newRelations = relationsData.filter((relation) => {
      const fromObjId = relation.relationMetadata.fromObjectMetadataId;
      const fromObjName = currentMetadata.data.objects.edges.find(
        (edge: any) => edge.node.id === fromObjId
      )?.node.nameSingular;
      
      if (!fromObjName) return false;
      
      const key = `${fromObjName}:${relation.relationMetadata.fromName}`;
      return !existingRelations.has(key);
    });
    console.log('newRelations', newRelations);
    return {
      newObjects,
      newFields,
      newRelations,
      objectIds, // Return object IDs for further processing if needed
    };
  }

  async fetchObjectMetadata(token: string, objectId: string) {
    try {
      const data = JSON.stringify({
        query: `query ObjectMetadataItems($objectFilter: ObjectFilter, $fieldFilter: FieldFilter) {
          objects(paging: {first: 1000}, filter: $objectFilter) {
            edges {
              node {
                id
                dataSourceId
                nameSingular
                namePlural
                labelSingular
                labelPlural
                description
                icon
                isCustom
                isRemote
                isActive
                isSystem
                createdAt
                updatedAt
                labelIdentifierFieldMetadataId
                imageIdentifierFieldMetadataId
                fields(paging: {first: 1000}, filter: $fieldFilter) {
                  edges {
                    node {
                      id
                      type
                      name
                      label
                      description
                      icon
                      isCustom
                      isActive
                      isSystem
                      isNullable
                      createdAt
                      updatedAt
                      defaultValue
                      options
                      fromRelationMetadata {
                        id
                        relationType
                        toObjectMetadata {
                          id
                          dataSourceId
                          nameSingular
                          namePlural
                          isSystem
                          isRemote
                        }
                        toFieldMetadataId
                      }
                      toRelationMetadata {
                        id
                        relationType
                        fromObjectMetadata {
                          id
                          dataSourceId
                          nameSingular
                          namePlural
                          isSystem
                          isRemote
                        }
                        fromFieldMetadataId
                      }
                      relationDefinition {
                        relationId
                        direction
                        sourceObjectMetadata {
                          id
                          nameSingular
                          namePlural
                        }
                        sourceFieldMetadata {
                          id
                          name
                        }
                        targetObjectMetadata {
                          id
                          nameSingular
                          namePlural
                        }
                        targetFieldMetadata {
                          id
                          name
                        }
                      }
                    }
                  }
                  pageInfo {
                    hasNextPage
                    hasPreviousPage
                    startCursor
                    endCursor
                  }
                }
              }
            }
          }
        }`,
        variables: {
          objectFilter: {
            id: {
              eq: objectId
            }
          },
          fieldFilter: {}
        },
      });

      const response = await axiosRequestForMetadata(data, token);
      return response.data;
    } catch (error) {
      console.error(`Error fetching metadata for object ${objectId}:`, error);
      throw error;
    }
  }

  async detectNewApiKeyFields(newFields: any[], workspaceId: string): Promise<{
    openaikey?: string;
    twilio_account_sid?: string;
    twilio_auth_token?: string;
    linkedin_url?: string;
    whatsapp_key?: string;
    linkedin_unipile_account_id?: string;
    whatsapp_unipile_account_id?: string;
    linkedin_profile_id?: string;
    anthropic_key?: string;
    facebook_whatsapp_api_token?: string;
    facebook_whatsapp_phone_number_id?: string;
    whatsapp_web_phone_number?: string;
    facebook_whatsapp_app_id?: string;
    facebook_whatsapp_asset_id?: string;
    is_chrome_extension_installed?: string;
    chrome_extension_id?: string;
  }> {
    try {
      // Get existing API keys from the workspace
      const existingKeys = await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      console.log('existingWorkspaceKeys from workspace:', existingKeys);
      
      // Get the field names that already exist in the workspace
      const existingFieldNames = Object.keys(existingKeys).map(name => name.toLowerCase());
      console.log('existingFieldNames from workspace:', existingFieldNames);
      
      // Get new field names from the new fields being added
      const newFieldNames = newFields
        .map(field => field?.field?.name?.toLowerCase())
        .filter(fieldName => fieldName);
      console.log('newFieldNames from metadata:', newFieldNames);
      
      // Find which new fields are not present in the existing API key fields
      const trulyNewApiKeyFields = newFieldNames.filter(fieldName => 
        !existingFieldNames.includes(fieldName)
      );
      console.log('trulyNewApiKeyFields:', trulyNewApiKeyFields);
      
      // Only return API keys if there are truly new fields that aren't already in the workspace
      if (trulyNewApiKeyFields.length > 0) {
        const apiKeyFields = {
          openaikey: process.env.OPENAI_KEY,
          twilio_account_sid: undefined,
          twilio_auth_token: undefined,
          linkedin_url: undefined,
          whatsapp_key: process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile',
          linkedin_unipile_account_id: undefined,
          whatsapp_unipile_account_id: undefined,
          linkedin_profile_id: undefined,
          anthropic_key: undefined,
          facebook_whatsapp_api_token: process.env.FACEBOOK_WHATSAPP_API_TOKEN,
          facebook_whatsapp_phone_number_id: process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID,
          whatsapp_web_phone_number: '',
          facebook_whatsapp_app_id: process.env.FACEBOOK_WHATSAPP_APP_ID,
          facebook_whatsapp_asset_id: process.env.FACEBOOK_WHATSAPP_ASSET_ID,
          is_chrome_extension_installed: 'false',
          chrome_extension_id: undefined,
        };
        
        console.log('Returning API keys for new fields:', apiKeyFields);
        return apiKeyFields;
      }
      
      console.log('No new API key fields detected, returning empty object');
      return {};
    } catch (error) {
      console.error('Error detecting new API key fields:', error);
      return {};
    }
  }

  async updateMetadata(token: string, origin: string) {
    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(token);
      const workspaceKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      const isOrgChartEnabled =
        (workspaceKeys?.is_org_chart_enabled ??
          process.env.IS_ORG_CHART_ENABLED ??
          'true') === 'true';

      // Fetch the metadata once
      const currentMetadata = await this.fetchCurrentMetadata(token);
      console.log("Current metadata is this::", currentMetadata);
      // Get the object name to ID mapping and objectIds from current metadata
      const objectsNameIdMap: Record<string, string> = {};
      const objectIds: string[] = [];
      console.log("Current metadata is this::", currentMetadata);
      currentMetadata.data.objects.edges.forEach(edge => {
        console.log(`Mapping object ${edge.node.nameSingular} to ID ${edge.node.id}`);
        objectsNameIdMap[edge.node.nameSingular] = edge.node.id;
        objectIds.push(edge.node.id);
      });

      // Debug logging for objectsNameIdMap
      console.log('objectsNameIdMap:', objectsNameIdMap);

      // Fetch detailed metadata for each object
      const detailedMetadata = {
        data: {
          objects: {
            edges: [] as Array<{
              node: {
                id: string;
                dataSourceId: string;
                nameSingular: string;
                namePlural: string;
                fields?: {
                  edges: Array<{
                    node: {
                      id: string;
                      type: string;
                      name: string;
                      [key: string]: any;
                    };
                  }>;
                };
                [key: string]: any;
              };
            }>
          }
        }
      };

      for (const objectId of objectIds) {
        const objectMetadata = await this.fetchObjectMetadata(token, objectId);
        if (objectMetadata.data.objects.edges.length > 0) {
          detailedMetadata.data.objects.edges.push(...(objectMetadata.data.objects.edges as any[]));
        }
      }

      // Single comparison with detailed metadata
      const { newObjects, newFields, newRelations } = this.compareMetadata(
        detailedMetadata,
        objectsNameIdMap,
        isOrgChartEnabled,
      );
      console.log('newObjects', newObjects.map((object: any) => object.object.nameSingular));
      console.log('newFields', newFields.map((field: any) => field.field.name));
      console.log('newRelations', newRelations.map((relation: any) => relation.relationMetadata.fromName));
      
      // Create new objects
      if (newObjects.length > 0) {
        await createObjectMetadataItems(token, newObjects, origin);
      }

      // Create new fields
      if (newFields.length > 0) {
        await createFields(newFields, token, origin, 3);
      }

      // Create new relations
      if (newRelations.length > 0) {
        await createRelations(newRelations, token, origin);
      }

      // Check if we need to update workspace API keys
      try {
        const newApiKeys = await this.detectNewApiKeyFields(newFields, workspaceId);
        
        if (Object.keys(newApiKeys).length > 0) {
          console.log('Updating workspace API keys with new keys:', newApiKeys);
          await this.workspaceQueryService.updateWorkspaceKeys(workspaceId, newApiKeys);
          console.log('Workspace API keys updated successfully');
        }
      } catch (error) {
        console.error('Error updating workspace API keys:', error);
        // Don't throw here as metadata update should continue even if API key update fails
      }

      return {
        message: 'Metadata update completed successfully',
        updates: {
          objects: newObjects.length,
          fields: newFields.length,
          relations: newRelations.length,
        },
      };
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw error;
    }
  }
} 