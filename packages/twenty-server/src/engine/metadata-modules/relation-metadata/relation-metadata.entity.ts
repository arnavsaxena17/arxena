export enum RelationMetadataType {
  ONE_TO_ONE = 'ONE_TO_ONE',
  ONE_TO_MANY = 'ONE_TO_MANY',
  MANY_TO_ONE = 'MANY_TO_ONE',
  MANY_TO_MANY = 'MANY_TO_MANY',
}

// Compatibility type for callers that previously returned RelationMetadataEntity
export type RelationMetadataEntity = {
  id: string;
  relationType: RelationMetadataType;
  fromObjectMetadataId: string;
  toObjectMetadataId: string;
  workspaceId: string;
  fromName: string;
  toName: string;
};
