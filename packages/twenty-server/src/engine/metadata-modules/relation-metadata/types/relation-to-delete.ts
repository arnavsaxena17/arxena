export type RelationToDelete = {
  id: string;
  fromFieldMetadataId: string;
  toFieldMetadataId: string;
  fromFieldMetadataName: string;
  toFieldMetadataName: string;
  fromObjectMetadataId: string;
  toObjectMetadataId: string;
  fromObjectName: string;
  toObjectName: string;
  fromObjectMetadataIsCustom: boolean;
  toFieldMetadataIsCustom: boolean;
  toObjectMetadataIsCustom: boolean;
  direction: string;
};
