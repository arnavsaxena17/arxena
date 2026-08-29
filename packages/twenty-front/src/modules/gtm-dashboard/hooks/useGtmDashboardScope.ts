import { useContext, useMemo } from 'react';

import { GtmDashboardScopeContext } from '@/gtm-dashboard/contexts/GtmDashboardScopeContext';
import { mergeGtmDashboardScopeIntoChartFilters } from '@/gtm-dashboard/utils/mergeGtmDashboardScopeIntoChartFilters';
import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { type ChartFilters } from '@/side-panel/pages/page-layout/types/ChartFilters';
import { isDefined } from 'twenty-shared/utils';

export const useGtmDashboardScopeContext = () => {
  const context = useContext(GtmDashboardScopeContext);

  if (!context) {
    throw new Error(
      'useGtmDashboardScopeContext must be used within GtmDashboardScopeProvider',
    );
  }

  return context;
};

export const useGtmDashboardScopeContextOptional = () =>
  useContext(GtmDashboardScopeContext);

export const useGtmDashboardScopedChartConfiguration = <
  T extends { filter?: ChartFilters | null },
>({
  configuration,
  objectMetadataItemId,
}: {
  configuration: T;
  objectMetadataItemId: string;
}): T => {
  const scope = useGtmDashboardScopeContextOptional();
  const { objectMetadataItem } = useObjectMetadataItemById({
    objectId: objectMetadataItemId,
  });

  return useMemo(() => {
    if (!scope?.isActive) {
      return configuration;
    }

    const hasProject =
      isDefined(scope.selectedProjectId) &&
      scope.selectedProjectId.length > 0;
    const hasVariant = scope.experimentVariant !== 'ALL';

    if (!hasProject && !hasVariant) {
      return configuration;
    }

    return {
      ...configuration,
      filter: mergeGtmDashboardScopeIntoChartFilters({
        chartFilters: configuration.filter ?? {},
        objectMetadataItem,
        projectId: scope.selectedProjectId,
        experimentVariant: scope.experimentVariant,
      }),
    };
  }, [configuration, objectMetadataItem, scope]);
};

export const useGtmDashboardChartScopeKey = () => {
  const scope = useGtmDashboardScopeContextOptional();

  return `${scope?.selectedProjectId ?? 'all-projects'}:${scope?.experimentVariant ?? 'ALL'}`;
};
