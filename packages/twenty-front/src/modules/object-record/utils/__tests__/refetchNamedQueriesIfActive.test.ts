import { refetchNamedQueriesIfActive } from '@/object-record/utils/refetchNamedQueriesIfActive';
import { type ApolloClient } from '@apollo/client';

describe('refetchNamedQueriesIfActive', () => {
  it('should skip refetch when none of the named queries are active', async () => {
    const refetchQueries = jest.fn();
    const apolloClient = {
      getObservableQueries: () => new Set(),
      refetchQueries,
    } as unknown as ApolloClient;

    await refetchNamedQueriesIfActive({
      apolloClient,
      queryNames: [
        'AggregateWorkflowVersions',
        'WorkflowVersionsGroupByAggregates',
      ],
    });

    expect(refetchQueries).not.toHaveBeenCalled();
  });

  it('should refetch only currently active named queries', async () => {
    const refetchQueries = jest.fn().mockResolvedValue(undefined);
    const apolloClient = {
      getObservableQueries: () =>
        new Set([{ queryName: 'AggregateWorkflowVersions' }]),
      refetchQueries,
    } as unknown as ApolloClient;

    await refetchNamedQueriesIfActive({
      apolloClient,
      queryNames: [
        'AggregateWorkflowVersions',
        'WorkflowVersionsGroupByAggregates',
      ],
    });

    expect(refetchQueries).toHaveBeenCalledWith({
      include: ['AggregateWorkflowVersions'],
    });
  });
});
