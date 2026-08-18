import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { refetchNamedQueriesIfActive } from '@/object-record/utils/refetchNamedQueriesIfActive';
import { capitalize } from 'twenty-shared/utils';

export const useRefetchFindManyRecords = ({
  objectMetadataNamePlural,
}: {
  objectMetadataNamePlural: string;
}) => {
  const apolloCoreClient = useApolloCoreClient();

  const refetchFindManyRecords = async () => {
    const findManyRecordsQueryName = `FindMany${capitalize(
      objectMetadataNamePlural,
    )}`;

    await refetchNamedQueriesIfActive({
      apolloClient: apolloCoreClient,
      queryNames: [findManyRecordsQueryName],
    });
  };

  return {
    refetchFindManyRecords,
  };
};
