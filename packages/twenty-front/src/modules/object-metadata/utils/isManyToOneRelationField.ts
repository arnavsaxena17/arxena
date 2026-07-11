import {
  FieldMetadataType,
  RelationDefinitionType,
} from '~/generated-metadata/graphql';

type FieldWithRelationDefinition = {
  type: FieldMetadataType;
  relationDefinition?: { direction: RelationDefinitionType } | null;
};

export const isManyToOneRelationField = <T extends FieldWithRelationDefinition>(
  field: T,
): field is T & { relationDefinition: NonNullable<T['relationDefinition']> } =>
  field.type === FieldMetadataType.RELATION &&
  (field.relationDefinition?.direction ===
    RelationDefinitionType.MANY_TO_ONE ||
    field.relationDefinition?.direction === RelationDefinitionType.ONE_TO_ONE);
