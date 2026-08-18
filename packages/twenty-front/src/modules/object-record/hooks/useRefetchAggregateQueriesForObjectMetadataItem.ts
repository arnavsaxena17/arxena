import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { getGroupByAggregateQueryName } from '@/object-record/record-aggregate/utils/getGroupByAggregateQueryName';
import { getAggregateQueryName } from '@/object-record/utils/getAggregateQueryName';
import { refetchNamedQueriesIfActive } from '@/object-record/utils/refetchNamedQueriesIfActive';

export const useRefetchAggregateQueriesForObjectMetadataItem = () => {
  const apolloCoreClient = useApolloCoreClient();

  const refetchAggregateQueriesForObjectMetadataItem = async ({
    objectMetadataItem,
  }: {
    objectMetadataItem: EnrichedObjectMetadataItem;
  }) => {
    const queryName = getAggregateQueryName(objectMetadataItem.namePlural);
    const groupByAggregateQueryName = getGroupByAggregateQueryName({
      objectMetadataNamePlural: objectMetadataItem.namePlural,
    });

    await refetchNamedQueriesIfActive({
      apolloClient: apolloCoreClient,
      queryNames: [queryName, groupByAggregateQueryName],
    });
  };

  return {
    refetchAggregateQueriesForObjectMetadataItem,
  };
};
