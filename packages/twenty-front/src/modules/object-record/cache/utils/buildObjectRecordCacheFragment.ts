import { gql } from '@apollo/client';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { mapObjectMetadataToGraphQLQuery } from '@/object-metadata/utils/mapObjectMetadataToGraphQLQuery';
import { type RecordGqlFields } from '@/object-record/graphql/record-gql-fields/types/RecordGqlFields';
import { type ObjectPermissions } from 'twenty-shared/types';
import { capitalize } from 'twenty-shared/utils';

const hashSelectionToGraphqlName = (selection: string) => {
  let hash = 0;

  for (let index = 0; index < selection.length; index++) {
    hash = (Math.imul(31, hash) + selection.charCodeAt(index)) | 0;
  }

  return `h${Math.abs(hash).toString(36)}`;
};

export const buildObjectRecordCacheFragment = ({
  fragmentNamePrefix,
  objectMetadataItem,
  objectMetadataItems,
  recordGqlFields,
  objectPermissionsByObjectMetadataId,
  computeReferences = false,
}: {
  fragmentNamePrefix: string;
  objectMetadataItem: Pick<
    EnrichedObjectMetadataItem,
    'fields' | 'nameSingular' | 'id' | 'readableFields'
  >;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  recordGqlFields?: RecordGqlFields;
  objectPermissionsByObjectMetadataId: Record<
    string,
    ObjectPermissions & { objectMetadataId: string }
  >;
  computeReferences?: boolean;
}) => {
  const capitalizedObjectName = capitalize(objectMetadataItem.nameSingular);
  const selection = mapObjectMetadataToGraphQLQuery({
    objectMetadataItems,
    objectMetadataItem,
    recordGqlFields,
    computeReferences,
    objectPermissionsByObjectMetadataId,
  });
  const fragmentName = `${fragmentNamePrefix}${capitalizedObjectName}_${hashSelectionToGraphqlName(
    selection,
  )}`;

  return gql`
    fragment ${fragmentName} on ${capitalizedObjectName} ${selection}
  `;
};
