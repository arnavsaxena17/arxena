import { Injectable } from '@nestjs/common';

import { FieldMetadataType, isOrgChartEnabledEnv } from 'twenty-shared';

import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { CreateFieldInput } from 'src/engine/metadata-modules/field-metadata/dtos/create-field.input';
import {
  FieldMetadataComplexOption,
  FieldMetadataDefaultOption,
} from 'src/engine/metadata-modules/field-metadata/dtos/options.input';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { CreateObjectInput } from 'src/engine/metadata-modules/object-metadata/dtos/create-object.input';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { CreateRelationInput } from 'src/engine/metadata-modules/relation-metadata/dtos/create-relation.input';
import { RelationMetadataType } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';
import { RelationMetadataService } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.service';
import { WorkspaceMetadataVersionService } from 'src/engine/metadata-modules/workspace-metadata-version/services/workspace-metadata-version.service';

import { getFieldsData } from '../object-apis/data/fieldsData';
import { getObjectCreationArr } from '../object-apis/data/objectsData';
import { getRelationsData } from '../object-apis/data/relationsData';

function normalizeFieldOptions(
  options:
    | Array<{
        position?: number;
        label?: string;
        value?: string;
        color?: string;
      }>
    | undefined,
): FieldMetadataDefaultOption[] | FieldMetadataComplexOption[] | undefined {
  if (!options?.length) return undefined;
  return options.map(
    (option) =>
      ({
        position: option.position ?? 0,
        label: option.label ?? '',
        value: option.value ?? '',
        ...(option.color != null && { color: option.color }),
      }) as FieldMetadataDefaultOption | FieldMetadataComplexOption,
  );
}

@Injectable()
export class MetadataStructureSeedService {
  constructor(
    private readonly dataSourceService: DataSourceService,
    private readonly objectMetadataService: ObjectMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly relationMetadataService: RelationMetadataService,
    private readonly workspaceMetadataVersionService: WorkspaceMetadataVersionService,
  ) {}

  async seedForWorkspace(workspaceId: string): Promise<void> {
    const dataSource =
      await this.dataSourceService.getLastDataSourceMetadataFromWorkspaceIdOrFail(
        workspaceId,
      );
    const objectsNameIdMap = await this.buildObjectsNameIdMap(workspaceId);

    const objectCreationArr = getObjectCreationArr(isOrgChartEnabledEnv);

    for (const item of objectCreationArr) {
      if (!item?.object) continue;
      const { nameSingular, namePlural, labelSingular, labelPlural } =
        item.object;
      if (objectsNameIdMap[nameSingular]) continue;

      const createInput: CreateObjectInput = {
        nameSingular,
        namePlural,
        labelSingular,
        labelPlural,
        description: item.object.description ?? undefined,
        icon: item.object.icon ?? undefined,
      };
      const created = await this.objectMetadataService.createOneObject({
        createObjectInput: {
          ...createInput,
          // retained for callers/data-source linkage in seed payloads
          ...(dataSource.id ? { dataSourceId: dataSource.id } : {}),
        } as CreateObjectInput & { dataSourceId?: string },
        workspaceId,
      });
      objectsNameIdMap[created.nameSingular] = created.id;
    }

    const fieldsData = getFieldsData(objectsNameIdMap, isOrgChartEnabledEnv);
    const fieldInputs: Omit<CreateFieldInput, 'workspaceId'>[] = [];
    for (const item of fieldsData) {
      const objectMetadataId = item?.field?.objectMetadataId;
      const name = item?.field?.name;
      if (!objectMetadataId || !name) continue;
      fieldInputs.push({
        objectMetadataId,
        type: item.field!.type as FieldMetadataType,
        name,
        label: item.field!.label ?? name,
        description: item.field!.description ?? undefined,
        icon: item.field!.icon ?? undefined,
        options: normalizeFieldOptions(item.field!.options),
      });
    }
    if (fieldInputs.length > 0) {
      await this.fieldMetadataService.createManyFields({
        createFieldInputs: fieldInputs,
        workspaceId,
      });
    }

    const relationsData = getRelationsData(
      objectsNameIdMap,
      isOrgChartEnabledEnv,
    );
    for (const item of relationsData) {
      if (!item?.relationMetadata) continue;
      const relationMetadata = item.relationMetadata;
      if (
        !relationMetadata.fromObjectMetadataId ||
        !relationMetadata.toObjectMetadataId ||
        !relationMetadata.fromName ||
        !relationMetadata.toName ||
        !relationMetadata.fromLabel ||
        !relationMetadata.toLabel
      )
        continue;
      const relationType =
        relationMetadata.relationType === 'ONE_TO_MANY'
          ? RelationMetadataType.ONE_TO_MANY
          : (relationMetadata.relationType as RelationMetadataType);
      const relationInput: CreateRelationInput = {
        workspaceId,
        relationType,
        fromObjectMetadataId: relationMetadata.fromObjectMetadataId,
        toObjectMetadataId: relationMetadata.toObjectMetadataId,
        fromName: relationMetadata.fromName,
        toName: relationMetadata.toName,
        fromLabel: relationMetadata.fromLabel,
        toLabel: relationMetadata.toLabel,
        fromIcon: relationMetadata.fromIcon ?? undefined,
        toIcon: relationMetadata.toIcon ?? undefined,
        fromDescription: relationMetadata.fromDescription ?? undefined,
        toDescription: relationMetadata.toDescription ?? undefined,
      };
      await this.relationMetadataService.createOne(relationInput);
    }

    await this.workspaceMetadataVersionService.incrementMetadataVersion(
      workspaceId,
    );
  }

  private async buildObjectsNameIdMap(
    workspaceId: string,
  ): Promise<Record<string, string>> {
    const objects =
      await this.objectMetadataService.findManyWithinWorkspace(workspaceId);
    const map: Record<string, string> = {};
    for (const objectMetadata of objects) {
      if (objectMetadata.nameSingular) {
        map[objectMetadata.nameSingular] = objectMetadata.id;
      }
    }
    return map;
  }
}
