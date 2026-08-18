import { type ApolloClient } from '@apollo/client';
import { isDefined } from 'twenty-shared/utils';

export const refetchNamedQueriesIfActive = async ({
  apolloClient,
  queryNames,
}: {
  apolloClient: ApolloClient;
  queryNames: string[];
}) => {
  const activeQueryNames = new Set(
    [...apolloClient.getObservableQueries()]
      .map((query) => query.queryName)
      .filter(isDefined),
  );

  const include = queryNames.filter((queryName) =>
    activeQueryNames.has(queryName),
  );

  if (include.length === 0) {
    return;
  }

  await apolloClient.refetchQueries({
    include,
  });
};
