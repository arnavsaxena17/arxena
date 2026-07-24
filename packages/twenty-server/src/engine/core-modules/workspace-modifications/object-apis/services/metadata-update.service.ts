import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { WorkspaceQueryService } from '../../workspace-modifications.service';
import { getFieldsData } from '../data/fieldsData';
import { getObjectCreationArr } from '../data/objectsData';
import { getRelationsData } from '../data/relationsData';
import { createFields } from './field-service';
import { createObjectMetadataItems } from './object-service';
import { createRelations } from './relation-service';

type MetadataObjectNode = {
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
      };
    }>;
  };
};

type MetadataComparisonSnapshot = {
  data: {
    objects: {
      edges: Array<{
        node: MetadataObjectNode;
      }>;
    };
  };
};

export type MetadataUpdateResult = {
  message: string;
  updates: {
    objects: number;
    fields: number;
    relations: number;
  };
  requiresDatabaseIndices: boolean;
};

@Injectable()
export class MetadataUpdateService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    @InjectRepository(ObjectMetadataEntity, 'metadata')
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
    @InjectRepository(FieldMetadataEntity, 'metadata')
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
  ) {}

  private toComparisonSnapshot(
    objects: ObjectMetadataEntity[],
    fieldsByObjectId: Map<string, FieldMetadataEntity[]>,
  ): MetadataComparisonSnapshot {
    return {
      data: {
        objects: {
          edges: objects.map((object) => ({
            node: {
              id: object.id,
              dataSourceId: object.dataSourceId,
              nameSingular: object.nameSingular,
              namePlural: object.namePlural,
              fields: {
                edges: (fieldsByObjectId.get(object.id) ?? []).map((field) => ({
                  node: {
                    id: field.id,
                    type: field.type,
                    name: field.name,
                  },
                })),
              },
            },
          })),
        },
      },
    };
  }

  /**
   * Loads object + field metadata in one DB round-trip (no HTTP / N+1 GraphQL).
   */
  async loadDetailedMetadata(workspaceId: string): Promise<{
    detailedMetadata: MetadataComparisonSnapshot;
    objectsNameIdMap: Record<string, string>;
  }> {
    const objects = await this.objectMetadataRepository.find({
      where: { workspaceId },
      select: ['id', 'dataSourceId', 'nameSingular', 'namePlural'],
    });

    const objectIds = objects.map((object) => object.id);
    const fieldsByObjectId = new Map<string, FieldMetadataEntity[]>();

    if (objectIds.length > 0) {
      const fields = await this.fieldMetadataRepository
        .createQueryBuilder('field')
        .select(['field.id', 'field.name', 'field.type', 'field.objectMetadataId'])
        .where('field.objectMetadataId IN (:...objectIds)', { objectIds })
        .andWhere('field.workspaceId = :workspaceId', { workspaceId })
        .getMany();

      for (const field of fields) {
        const existing = fieldsByObjectId.get(field.objectMetadataId) ?? [];
        existing.push(field);
        fieldsByObjectId.set(field.objectMetadataId, existing);
      }
    }

    const objectsNameIdMap: Record<string, string> = {};
    for (const object of objects) {
      objectsNameIdMap[object.nameSingular] = object.id;
    }

    return {
      detailedMetadata: this.toComparisonSnapshot(objects, fieldsByObjectId),
      objectsNameIdMap,
    };
  }

  compareMetadata(
    currentMetadata: MetadataComparisonSnapshot,
    objectsNameIdMap: Record<string, string>,
    isOrgChartEnabled?: boolean,
  ) {
    const objectIds = currentMetadata.data.objects.edges.map(
      (edge) => edge.node.id,
    );
    const existingObjectNames = new Set(
      currentMetadata.data.objects.edges.map((edge) => edge.node.nameSingular),
    );
    const objectCreationArr = getObjectCreationArr(isOrgChartEnabled);
    const newObjects = objectCreationArr.filter(
      (obj) => !existingObjectNames.has(obj.object.nameSingular),
    );

    const fieldsData = getFieldsData(objectsNameIdMap, isOrgChartEnabled);
    const existingFields = new Map<string, { name: string }>();
    currentMetadata.data.objects.edges.forEach((objEdge) => {
      const objName = objEdge.node.nameSingular;
      if (objEdge.node.fields?.edges) {
        objEdge.node.fields.edges.forEach((fieldEdge) => {
          const key = `${objName}:${fieldEdge.node.name}`;
          existingFields.set(key, fieldEdge.node);
        });
      }
    });

    const newFields = fieldsData.filter((field) => {
      if (!field?.field?.objectMetadataId || !field?.field?.name) {
        return false;
      }

      const fieldData = field.field;
      const objectName = Object.entries(objectsNameIdMap).find(
        ([, id]) => id === fieldData.objectMetadataId,
      )?.[0];

      if (!objectName) {
        return false;
      }

      const key = `${objectName}:${fieldData.name}`;
      return !existingFields.has(key);
    });

    const relationsData = getRelationsData(
      objectsNameIdMap,
      isOrgChartEnabled,
    );
    const existingRelations = new Set<string>();
    currentMetadata.data.objects.edges.forEach((objEdge) => {
      const objName = objEdge.node.nameSingular;
      if (objEdge.node.fields?.edges) {
        objEdge.node.fields.edges.forEach((fieldEdge) => {
          if (fieldEdge.node.type === 'RELATION') {
            const key = `${objName}:${fieldEdge.node.name}`;
            existingRelations.add(key);
          }
        });
      }
    });

    const newRelations = relationsData.filter((relation) => {
      const fromObjId = relation.relationMetadata.fromObjectMetadataId;
      const fromObjName = currentMetadata.data.objects.edges.find(
        (edge) => edge.node.id === fromObjId,
      )?.node.nameSingular;

      if (!fromObjName) return false;

      const key = `${fromObjName}:${relation.relationMetadata.fromName}`;
      return !existingRelations.has(key);
    });

    return {
      newObjects,
      newFields,
      newRelations,
      objectIds,
    };
  }

  private requiresDatabaseIndices(
    newObjects: ReturnType<MetadataUpdateService['compareMetadata']>['newObjects'],
    newFields: ReturnType<MetadataUpdateService['compareMetadata']>['newFields'],
    newRelations: ReturnType<MetadataUpdateService['compareMetadata']>['newRelations'],
  ): boolean {
    if (newObjects.length > 0 || newRelations.length > 0) {
      return true;
    }

    return newFields.some((field) => field?.field?.type !== 'RAW_JSON');
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
      const existingKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);

      const existingFieldNames = Object.keys(existingKeys).map((name) =>
        name.toLowerCase(),
      );

      const newFieldNames = newFields
        .map((field) => field?.field?.name?.toLowerCase())
        .filter((fieldName): fieldName is string => Boolean(fieldName));

      const trulyNewApiKeyFields = newFieldNames.filter(
        (fieldName) => !existingFieldNames.includes(fieldName),
      );

      if (trulyNewApiKeyFields.length > 0) {
        const apiKeyFields: {
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
        } = {};

        for (const fieldName of trulyNewApiKeyFields) {
          switch (fieldName) {
            case 'openaikey':
              if (!existingKeys.openaikey && process.env.OPENAI_KEY) {
                apiKeyFields.openaikey = process.env.OPENAI_KEY;
              }
              break;
            case 'whatsapp_key':
              if (!existingKeys.whatsapp_key) {
                apiKeyFields.whatsapp_key =
                  process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile';
              }
              break;
            case 'facebook_whatsapp_api_token':
              if (
                !existingKeys.facebook_whatsapp_api_token &&
                process.env.FACEBOOK_WHATSAPP_API_TOKEN
              ) {
                apiKeyFields.facebook_whatsapp_api_token =
                  process.env.FACEBOOK_WHATSAPP_API_TOKEN;
              }
              break;
            case 'facebook_whatsapp_phone_number_id':
              if (
                !existingKeys.facebook_whatsapp_phone_number_id &&
                process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID
              ) {
                apiKeyFields.facebook_whatsapp_phone_number_id =
                  process.env.FACEBOOK_WHATSAPP_PHONE_NUMBER_ID;
              }
              break;
            case 'facebook_whatsapp_app_id':
              if (
                !existingKeys.facebook_whatsapp_app_id &&
                process.env.FACEBOOK_WHATSAPP_APP_ID
              ) {
                apiKeyFields.facebook_whatsapp_app_id =
                  process.env.FACEBOOK_WHATSAPP_APP_ID;
              }
              break;
            case 'facebook_whatsapp_asset_id':
              if (
                !existingKeys.facebook_whatsapp_asset_id &&
                process.env.FACEBOOK_WHATSAPP_ASSET_ID
              ) {
                apiKeyFields.facebook_whatsapp_asset_id =
                  process.env.FACEBOOK_WHATSAPP_ASSET_ID;
              }
              break;
            case 'whatsapp_web_phone_number':
              if (!existingKeys.whatsapp_web_phone_number) {
                apiKeyFields.whatsapp_web_phone_number = '';
              }
              break;
            case 'is_chrome_extension_installed':
              if (!existingKeys.is_chrome_extension_installed) {
                apiKeyFields.is_chrome_extension_installed = 'false';
              }
              break;
            default:
              break;
          }
        }

        return apiKeyFields;
      }

      return {};
    } catch (error) {
      console.error('Error detecting new API key fields:', error);
      return {};
    }
  }

  async updateMetadata(
    token: string,
    origin: string,
  ): Promise<MetadataUpdateResult> {
    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(token);
      const workspaceKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      const isOrgChartEnabled =
        (workspaceKeys?.is_org_chart_enabled ??
          process.env.IS_ORG_CHART_ENABLED ??
          'true') === 'true';

      let { detailedMetadata, objectsNameIdMap } =
        await this.loadDetailedMetadata(workspaceId);

      let { newObjects, newFields, newRelations } = this.compareMetadata(
        detailedMetadata,
        objectsNameIdMap,
        isOrgChartEnabled,
      );

      console.log(
        `Metadata diff for workspace ${workspaceId}: objects=${newObjects.length}, fields=${newFields.length}, relations=${newRelations.length}`,
      );

      if (newObjects.length > 0) {
        await createObjectMetadataItems(token, newObjects, origin);
        const reloaded = await this.loadDetailedMetadata(workspaceId);
        detailedMetadata = reloaded.detailedMetadata;
        objectsNameIdMap = reloaded.objectsNameIdMap;
        const afterCreate = this.compareMetadata(
          detailedMetadata,
          objectsNameIdMap,
          isOrgChartEnabled,
        );
        newFields = afterCreate.newFields;
        newRelations = afterCreate.newRelations;
      }

      if (newFields.length > 0) {
        await createFields(newFields, token, origin, 3);
      }

      if (newRelations.length > 0) {
        await createRelations(newRelations, token, origin);
      }

      try {
        const newApiKeys = await this.detectNewApiKeyFields(
          newFields,
          workspaceId,
        );

        if (Object.keys(newApiKeys).length > 0) {
          await this.workspaceQueryService.updateWorkspaceKeys(
            workspaceId,
            newApiKeys,
          );
        }
      } catch (error) {
        console.error('Error updating workspace API keys:', error);
      }

      return {
        message: 'Metadata update completed successfully',
        updates: {
          objects: newObjects.length,
          fields: newFields.length,
          relations: newRelations.length,
        },
        requiresDatabaseIndices: this.requiresDatabaseIndices(
          newObjects,
          newFields,
          newRelations,
        ),
      };
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw error;
    }
  }
}
