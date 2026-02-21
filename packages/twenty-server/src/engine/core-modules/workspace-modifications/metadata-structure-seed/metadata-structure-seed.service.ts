import { Injectable } from '@nestjs/common';

import { FieldMetadataType } from 'twenty-shared';

import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { CreateFieldInput } from 'src/engine/metadata-modules/field-metadata/dtos/create-field.input';
import {
  FieldMetadataComplexOption,
  FieldMetadataDefaultOption,
} from 'src/engine/metadata-modules/field-metadata/dtos/options.input';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/field-metadata.service';
import { CreateObjectInput } from 'src/engine/metadata-modules/object-metadata/dtos/create-object.input';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { CreateRelationInput } from 'src/engine/metadata-modules/relation-metadata/dtos/create-relation.input';
import { RelationMetadataType } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';
import { RelationMetadataService } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.service';

import { getFieldsData } from '../object-apis/data/fieldsData';
import { objectCreationArr } from '../object-apis/data/objectsData';
import { getRelationsData } from '../object-apis/data/relationsData';

function normalizeFieldOptions(
  options: Array<{
    position?: number;
    label?: string;
    value?: string;
    color?: string;
  }> | undefined,
): FieldMetadataDefaultOption[] | FieldMetadataComplexOption[] | undefined {
  if (!options?.length) return undefined;
  return options.map(
    (o) =>
      ({
        position: o.position ?? 0,
        label: o.label ?? '',
        value: o.value ?? '',
        ...(o.color != null && { color: o.color }),
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
  ) {}

  async seedForWorkspace(workspaceId: string): Promise<void> {
    const dataSource =
      await this.dataSourceService.getLastDataSourceMetadataFromWorkspaceIdOrFail(
        workspaceId,
      );
    const objectsNameIdMap = await this.buildObjectsNameIdMap(workspaceId);

    for (const item of objectCreationArr) {
      if (!item?.object) continue;
      const { nameSingular, namePlural, labelSingular, labelPlural } =
        item.object;
      if (objectsNameIdMap[nameSingular]) continue;

      const createInput: CreateObjectInput = {
        workspaceId,
        dataSourceId: dataSource.id,
        nameSingular,
        namePlural,
        labelSingular,
        labelPlural,
        description: item.object.description ?? undefined,
        icon: item.object.icon ?? undefined,
      };
      const created = await this.objectMetadataService.createOne(createInput);
      objectsNameIdMap[created.nameSingular] = created.id;
    }

    const fieldsData = getFieldsData(objectsNameIdMap);
    for (const item of fieldsData) {
      const objId = item?.field?.objectMetadataId;
      const name = item?.field?.name;
      if (!objId || !name) continue;
      const fieldInput: CreateFieldInput = {
        workspaceId,
        objectMetadataId: objId,
        type: item.field!.type as FieldMetadataType,
        name,
        label: item.field!.label ?? name,
        description: item.field!.description ?? undefined,
        icon: item.field!.icon ?? undefined,
        options: normalizeFieldOptions(item.field!.options),
      };
      await this.fieldMetadataService.createOne(fieldInput);
    }

    const relationsData = getRelationsData(objectsNameIdMap);
    for (const item of relationsData) {
      if (!item?.relationMetadata) continue;
      const r = item.relationMetadata;
      if (
        !r.fromObjectMetadataId ||
        !r.toObjectMetadataId ||
        !r.fromName ||
        !r.toName ||
        !r.fromLabel ||
        !r.toLabel
      )
        continue;
      const relationType =
        r.relationType === 'ONE_TO_MANY'
          ? RelationMetadataType.ONE_TO_MANY
          : (r.relationType as RelationMetadataType);
      const relationInput: CreateRelationInput = {
        workspaceId,
        relationType,
        fromObjectMetadataId: r.fromObjectMetadataId,
        toObjectMetadataId: r.toObjectMetadataId,
        fromName: r.fromName,
        toName: r.toName,
        fromLabel: r.fromLabel,
        toLabel: r.toLabel,
        fromIcon: r.fromIcon ?? undefined,
        toIcon: r.toIcon ?? undefined,
        fromDescription: r.fromDescription ?? undefined,
        toDescription: r.toDescription ?? undefined,
      };
      await this.relationMetadataService.createOne(relationInput);
    }
  }

  private async buildObjectsNameIdMap(
    workspaceId: string,
  ): Promise<Record<string, string>> {
    const objects = await this.objectMetadataService.findManyWithinWorkspace(
      workspaceId,
    );
    const map: Record<string, string> = {};
    for (const obj of objects) {
      if (obj.nameSingular) {
        map[obj.nameSingular] = obj.id;
      }
    }
    return map;
  }
}
