import { Injectable } from '@nestjs/common';

import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { CreateFieldInput } from 'src/engine/metadata-modules/field-metadata/dtos/create-field.input';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/field-metadata.service';
import { CreateObjectInput } from 'src/engine/metadata-modules/object-metadata/dtos/create-object.input';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { CreateRelationInput } from 'src/engine/metadata-modules/relation-metadata/dtos/create-relation.input';
import { RelationMetadataType } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';
import { RelationMetadataService } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.service';

import { getFieldsData } from '../data/fieldsData';
import { objectCreationArr } from '../data/objectsData';
import { getRelationsData } from '../data/relationsData';

@Injectable()
export class MetadataStructureCreationService {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly objectMetadataService: ObjectMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly relationMetadataService: RelationMetadataService,
  ) {}

  async createFullStructure(apiToken: string): Promise<void> {
    const validatedToken =
      await this.accessTokenService.validateToken(apiToken);
    const workspaceId = validatedToken.workspace.id;

    const objectsNameIdMap = await this.createObjects(workspaceId);
    await this.createFields(workspaceId, objectsNameIdMap);
    await this.createRelations(workspaceId, objectsNameIdMap);
  }

  private async createObjects(
    workspaceId: string,
  ): Promise<Record<string, string>> {
    const objectsNameIdMap: Record<string, string> = {};

    for (const item of objectCreationArr) {
      if (!item?.object) {
        continue;
      }
      const obj = item.object;
      const input: CreateObjectInput = {
        nameSingular: obj.nameSingular,
        namePlural: obj.namePlural,
        labelSingular: obj.labelSingular,
        labelPlural: obj.labelPlural,
        description: obj.description ?? '',
        icon: obj.icon ?? undefined,
        workspaceId,
        dataSourceId: '', // overwritten by ObjectMetadataService.createOne
      };
      const created = await this.objectMetadataService.createOne(input);
      if (created?.nameSingular && created?.id) {
        objectsNameIdMap[created.nameSingular] = created.id;
      }
    }

    return objectsNameIdMap;
  }

  private async createFields(
    workspaceId: string,
    objectsNameIdMap: Record<string, string>,
  ): Promise<void> {
    const fieldsData = getFieldsData(objectsNameIdMap);

    for (const item of fieldsData) {
      if (!item?.field?.objectMetadataId) {
        continue;
      }
      const f = item.field;
      const input: CreateFieldInput = {
        type: f.type as CreateFieldInput['type'],
        name: f.name ?? '',
        label: f.label ?? '',
        description: f.description ?? undefined,
        icon: f.icon ?? undefined,
        objectMetadataId: f.objectMetadataId!,
        options: f.options as CreateFieldInput['options'],
        workspaceId,
      };
      await this.fieldMetadataService.createOne(input);
    }
  }

  private async createRelations(
    workspaceId: string,
    objectsNameIdMap: Record<string, string>,
  ): Promise<void> {
    const relationsData = getRelationsData(objectsNameIdMap);

    for (const item of relationsData) {
      const r = item.relationMetadata;
      if (!r?.fromObjectMetadataId || !r?.toObjectMetadataId) {
        continue;
      }
      const input: CreateRelationInput = {
        relationType: (r.relationType as RelationMetadataType) ?? RelationMetadataType.ONE_TO_MANY,
        fromObjectMetadataId: r.fromObjectMetadataId,
        toObjectMetadataId: r.toObjectMetadataId,
        fromName: r.fromName ?? '',
        toName: r.toName ?? '',
        fromLabel: r.fromLabel ?? '',
        toLabel: r.toLabel ?? '',
        fromIcon: r.fromIcon ?? undefined,
        toIcon: r.toIcon ?? undefined,
        fromDescription: r.fromDescription ?? undefined,
        toDescription: r.toDescription ?? undefined,
        workspaceId,
      };
      await this.relationMetadataService.createOne(input);
    }
  }
}
