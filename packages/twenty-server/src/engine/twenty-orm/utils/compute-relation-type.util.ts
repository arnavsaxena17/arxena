import { Logger } from '@nestjs/common';

import { FieldMetadataInterface } from 'src/engine/metadata-modules/field-metadata/interfaces/field-metadata.interface';

import {
  RelationMetadataEntity,
  RelationMetadataType,
} from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';
import {
  RelationDirection,
  deduceRelationDirection,
} from 'src/engine/utils/deduce-relation-direction.util';

const logger = new Logger('ComputeRelationType');

export const computeRelationType = (
  fieldMetadata: FieldMetadataInterface,
  relationMetadata: RelationMetadataEntity,
) => {
  const relationDirection = deduceRelationDirection(
    fieldMetadata,
    relationMetadata,
  );

  const rawType = relationMetadata.relationType;

  switch (rawType) {
    case RelationMetadataType.ONE_TO_MANY: {
      return relationDirection === RelationDirection.FROM
        ? 'one-to-many'
        : 'many-to-one';
    }
    case RelationMetadataType.MANY_TO_ONE: {
      return relationDirection === RelationDirection.FROM
        ? 'many-to-one'
        : 'one-to-many';
    }
    case RelationMetadataType.ONE_TO_ONE:
      return 'one-to-one';
    case RelationMetadataType.MANY_TO_MANY:
      return 'many-to-many';
    default:
      // Defensive: treat unknown/stale relation types (e.g. from cache or legacy DB)
      // as MANY_TO_ONE so the server does not throw. Prefer cleaning up invalid
      // relation metadata and invalidating workspace cache.
      logger.warn(
        `Unexpected relation type "${rawType ?? 'undefined'}" for relation ${relationMetadata.id}, treating as MANY_TO_ONE`,
      );
      return relationDirection === RelationDirection.FROM
        ? 'many-to-one'
        : 'one-to-many';
  }
};
