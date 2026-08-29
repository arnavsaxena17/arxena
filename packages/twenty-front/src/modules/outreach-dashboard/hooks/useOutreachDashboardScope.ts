import { useContext, useMemo } from 'react';

import { OutreachDashboardScopeContext } from '@/outreach-dashboard/contexts/OutreachDashboardScopeContext';
import { mergeOutreachDashboardScopeIntoChartFilters } from '@/outreach-dashboard/utils/mergeOutreachDashboardScopeIntoChartFilters';
import { useObjectMetadataItemById } from '@/object-metadata/hooks/useObjectMetadataItemById';
import { type ChartFilters } from '@/side-panel/pages/page-layout/types/ChartFilters';
import { isDefined } from 'twenty-shared/utils';

export const useOutreachDashboardScopeContext = () => {
  const context = useContext(OutreachDashboardScopeContext);

  if (!context) {
    throw new Error(
      'useOutreachDashboardScopeContext must be used within OutreachDashboardScopeProvider',
    );
  }

  return context;
};

export const useOutreachDashboardScopeContextOptional = () =>
  useContext(OutreachDashboardScopeContext);

export const useOutreachDashboardScopedChartConfiguration = <
  T extends { filter?: ChartFilters | null },
>({
  configuration,
  objectMetadataItemId,
}: {
  configuration: T;
  objectMetadataItemId: string;
}): T => {
  const scope = useOutreachDashboardScopeContextOptional();
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
      filter: mergeOutreachDashboardScopeIntoChartFilters({
        chartFilters: configuration.filter ?? {},
        objectMetadataItem,
        projectId: scope.selectedProjectId,
        experimentVariant: scope.experimentVariant,
      }),
    };
  }, [configuration, objectMetadataItem, scope]);
};

export const useOutreachDashboardChartScopeKey = () => {
  const scope = useOutreachDashboardScopeContextOptional();

  return `${scope?.selectedProjectId ?? 'all-projects'}:${scope?.experimentVariant ?? 'ALL'}`;
};
