import { type FieldMetadataType } from 'twenty-shared/types';

export type ArxenaObjectDefinition = {
  object: {
    description?: string;
    icon?: string;
    labelPlural: string;
    labelSingular: string;
    nameSingular: string;
    namePlural: string;
  };
};

export type ArxenaFieldOption = {
  color?: string;
  label: string;
  position: number;
  value: string;
  id?: string;
};

export type ArxenaFieldDefinition = {
  description?: string;
  icon?: string;
  label: string;
  name: string;
  objectMetadataId: string;
  type: FieldMetadataType | string;
  options?: ArxenaFieldOption[];
  defaultValue?: unknown;
  isNullable?: boolean;
};

export type ArxenaFieldWithObject = {
  objectName: string;
  field: ArxenaFieldDefinition;
};

export type ArxenaRelationMetadata = {
  fromDescription?: string | null;
  fromIcon?: string;
  fromLabel: string;
  fromName: string;
  fromObjectMetadataId: string;
  relationType: 'ONE_TO_MANY' | 'MANY_TO_ONE' | string;
  toObjectMetadataId: string;
  toDescription?: string | null;
  toIcon?: string;
  toLabel: string;
  toName: string;
};

export type ArxenaRelationWithObjects = {
  fromObjectName: string;
  toObjectName: string;
  relationMetadata: ArxenaRelationMetadata;
};
