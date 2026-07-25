import { Injectable } from '@nestjs/common';

import { FieldMetadataType, RelationType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { v4 as uuidV4 } from 'uuid';

import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { CreateRelationInput } from 'src/engine/metadata-modules/relation-metadata/dtos/create-relation.input';
import {
  RelationMetadataEntity,
  RelationMetadataType,
} from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';

// Adapts legacy RelationMetadataService.createOne calls to the current
// FieldMetadata relationCreationPayload API without changing seed data shapes.
@Injectable()
export class RelationMetadataService {
  constructor(private readonly fieldMetadataService: FieldMetadataService) {}

  async createOne(
    relationMetadataInput: CreateRelationInput,
    _options?: { skipMetadataVersionIncrement?: boolean },
  ): Promise<RelationMetadataEntity> {
    const relationType = this.toSharedRelationType(
      relationMetadataInput.relationType,
    );

    await this.fieldMetadataService.createManyFields({
      workspaceId: relationMetadataInput.workspaceId,
      createFieldInputs: [
        {
          objectMetadataId: relationMetadataInput.fromObjectMetadataId,
          type: FieldMetadataType.RELATION,
          name: relationMetadataInput.fromName,
          label: relationMetadataInput.fromLabel,
          description: relationMetadataInput.fromDescription,
          icon: relationMetadataInput.fromIcon,
          relationCreationPayload: {
            type: relationType,
            targetObjectMetadataId: relationMetadataInput.toObjectMetadataId,
            targetFieldLabel: relationMetadataInput.toLabel,
            targetFieldIcon: relationMetadataInput.toIcon ?? 'IconRelationOneToMany',
          },
        },
      ],
    });

    return {
      id: uuidV4(),
      relationType: relationMetadataInput.relationType,
      fromObjectMetadataId: relationMetadataInput.fromObjectMetadataId,
      toObjectMetadataId: relationMetadataInput.toObjectMetadataId,
      workspaceId: relationMetadataInput.workspaceId,
      fromName: relationMetadataInput.fromName,
      toName: relationMetadataInput.toName,
    };
  }

  private toSharedRelationType(
    relationMetadataType: RelationMetadataType,
  ): RelationType {
    if (relationMetadataType === RelationMetadataType.MANY_TO_ONE) {
      return RelationType.MANY_TO_ONE;
    }

    // ONE_TO_ONE / MANY_TO_MANY are not first-class in the current API;
    // seed data uses ONE_TO_MANY which maps cleanly.
    if (
      relationMetadataType === RelationMetadataType.ONE_TO_MANY ||
      !isDefined(relationMetadataType)
    ) {
      return RelationType.ONE_TO_MANY;
    }

    return RelationType.ONE_TO_MANY;
  }
}
