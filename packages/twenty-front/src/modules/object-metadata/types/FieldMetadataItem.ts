import { ThemeColor } from '@/ui/theme/constants/MainColorNames';
import {
  Field,
  Object as MetadataObject,
  Relation,
  RelationDefinition,
  RelationDefinitionType,
} from '~/generated-metadata/graphql';

export type FieldMetadataItemOption = {
  color: ThemeColor;
  id: string;
  label: string;
  position: number;
  value: string;
};

export type FieldMetadataItem = Omit<
  Field,
  | '__typename'
  | 'fromRelationMetadata'
  | 'toRelationMetadata'
  | 'defaultValue'
  | 'options'
  | 'settings'
  | 'relationDefinition'
> & {
  __typename?: string;
  fromRelationMetadata?:
    | (Pick<Relation, 'id' | 'toFieldMetadataId' | 'relationType'> & {
        toObjectMetadata: Pick<
          Relation['toObjectMetadata'],
          'id' | 'nameSingular' | 'namePlural' | 'isSystem' | 'isRemote'
        >;
      })
    | null;
  toRelationMetadata?:
    | (Pick<Relation, 'id' | 'fromFieldMetadataId' | 'relationType'> & {
        fromObjectMetadata: Pick<
          Relation['fromObjectMetadata'],
          'id' | 'nameSingular' | 'namePlural' | 'isSystem' | 'isRemote'
        >;
      })
    | null;
  defaultValue?: any;
  options?: FieldMetadataItemOption[];
  relationDefinition?: {
    relationId: RelationDefinition['relationId'];
    direction: RelationDefinitionType;
    sourceFieldMetadata: Pick<Field, 'id' | 'name'>;
    sourceObjectMetadata: Pick<
      MetadataObject,
      'id' | 'nameSingular' | 'namePlural'
    >;
    targetFieldMetadata: Pick<Field, 'id' | 'name'>;
    targetObjectMetadata: Pick<
      MetadataObject,
      'id' | 'nameSingular' | 'namePlural'
    >;
  } | null;
};
