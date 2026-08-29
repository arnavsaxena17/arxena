import { isNonEmptyString } from '@sniptt/guards';
import { type ReactNode, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { GTM_EXPERIMENT_VARIANT_QUERY_PARAM } from '@/gtm-dashboard/constants/gtm-dashboard.constants';
import {
  GtmDashboardScopeContext,
  type GtmDashboardExperimentVariantFilter,
} from '@/gtm-dashboard/contexts/GtmDashboardScopeContext';
import { useGtmDashboardProjects } from '@/gtm-dashboard/hooks/useGtmDashboardProjects';
import { useIsGtmCommandDashboardRecord } from '@/gtm-dashboard/hooks/useIsGtmCommandDashboardRecord';
import { GTM_PROJECT_ID_QUERY_PARAM } from '@/gtm-home/constants/gtm-command.constants';

type GtmDashboardScopeProviderProps = {
  objectNameSingular: string;
  objectRecordId: string;
  children: ReactNode;
};

const normalizeVariant = (
  value: string | null,
): GtmDashboardExperimentVariantFilter => {
  if (value === 'A' || value === 'B') {
    return value;
  }

  return 'ALL';
};

export const GtmDashboardScopeProvider = ({
  objectNameSingular,
  objectRecordId,
  children,
}: GtmDashboardScopeProviderProps) => {
  const isGtmCommandDashboard = useIsGtmCommandDashboardRecord({
    objectNameSingular,
    objectRecordId,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const { projectOptions, loading: projectsLoading } = useGtmDashboardProjects();

  const projectIdFromQuery = searchParams.get(GTM_PROJECT_ID_QUERY_PARAM);
  const variantFromQuery = searchParams.get(GTM_EXPERIMENT_VARIANT_QUERY_PARAM);

  const selectedProjectId = useMemo(() => {
    if (!isNonEmptyString(projectIdFromQuery)) {
      return null;
    }

    if (
      projectOptions.some((project) => project.id === projectIdFromQuery) ||
      projectsLoading
    ) {
      return projectIdFromQuery;
    }

    return null;
  }, [projectIdFromQuery, projectOptions, projectsLoading]);

  const experimentVariant = useMemo(
    () => normalizeVariant(variantFromQuery),
    [variantFromQuery],
  );

  const setSelectedProjectId = useCallback(
    (projectId: string | null) => {
      const next = new URLSearchParams(searchParams);

      if (!isNonEmptyString(projectId)) {
        next.delete(GTM_PROJECT_ID_QUERY_PARAM);
      } else {
        next.set(GTM_PROJECT_ID_QUERY_PARAM, projectId);
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setExperimentVariant = useCallback(
    (variant: GtmDashboardExperimentVariantFilter) => {
      const next = new URLSearchParams(searchParams);

      if (variant === 'ALL') {
        next.delete(GTM_EXPERIMENT_VARIANT_QUERY_PARAM);
      } else {
        next.set(GTM_EXPERIMENT_VARIANT_QUERY_PARAM, variant);
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  if (!isGtmCommandDashboard) {
    return children;
  }

  return (
    <GtmDashboardScopeContext.Provider
      value={{
        isActive: true,
        selectedProjectId,
        setSelectedProjectId,
        experimentVariant,
        setExperimentVariant,
        projectOptions,
        projectsLoading,
      }}
    >
      {children}
    </GtmDashboardScopeContext.Provider>
  );
};
