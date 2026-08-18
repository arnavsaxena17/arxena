import { type ApolloCache } from '@apollo/client/cache';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { buildObjectRecordCacheFragment } from '@/object-record/cache/utils/buildObjectRecordCacheFragment';
import { getRecordNodeFromRecord } from '@/object-record/cache/utils/getRecordNodeFromRecord';
import { type RecordGqlFields } from '@/object-record/graphql/record-gql-fields/types/RecordGqlFields';
import { type RecordGqlNode } from '@/object-record/graphql/types/RecordGqlNode';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { type ObjectPermissions } from 'twenty-shared/types';
import { capitalize } from 'twenty-shared/utils';
import { isUndefinedOrNull } from '~/utils/isUndefinedOrNull';

export const updateRecordFromCache = <T extends ObjectRecord>({
  objectMetadataItems,
  objectMetadataItem,
  cache,
  recordGqlFields,
  record,
  objectPermissionsByObjectMetadataId,
}: {
  objectMetadataItems: EnrichedObjectMetadataItem[];
  objectMetadataItem: EnrichedObjectMetadataItem;
  cache: ApolloCache;
  recordGqlFields: RecordGqlFields;
  record: T;
  objectPermissionsByObjectMetadataId: Record<
    string,
    ObjectPermissions & { objectMetadataId: string }
  >;
}) => {
  if (isUndefinedOrNull(objectMetadataItem)) {
    return null;
  }

  const cacheWriteFragment = buildObjectRecordCacheFragment({
    fragmentNamePrefix: 'Write',
    objectMetadataItem,
    objectMetadataItems,
    recordGqlFields,
    objectPermissionsByObjectMetadataId,
    computeReferences: true,
  });

  const cachedRecordId = cache.identify({
    __typename: capitalize(objectMetadataItem.nameSingular),
    id: record.id,
  });

  const recordWithConnection = getRecordNodeFromRecord<T>({
    objectMetadataItems,
    objectMetadataItem,
    record,
  });

  if (isUndefinedOrNull(recordWithConnection)) {
    return;
  }

  cache.writeFragment<RecordGqlNode>({
    id: cachedRecordId,
    fragment: cacheWriteFragment,
    data: recordWithConnection,
  });
};
