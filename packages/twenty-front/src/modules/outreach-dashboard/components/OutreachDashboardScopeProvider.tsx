import { isNonEmptyString } from '@sniptt/guards';
import { type ReactNode, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { OUTREACH_EXPERIMENT_VARIANT_QUERY_PARAM } from '@/outreach-dashboard/constants/outreach-dashboard.constants';
import {
  OutreachDashboardScopeContext,
  type OutreachDashboardExperimentVariantFilter,
} from '@/outreach-dashboard/contexts/OutreachDashboardScopeContext';
import { useOutreachDashboardProjects } from '@/outreach-dashboard/hooks/useOutreachDashboardProjects';
import { useIsOutreachCommandDashboardRecord } from '@/outreach-dashboard/hooks/useIsOutreachCommandDashboardRecord';
import { OUTREACH_PROJECT_ID_QUERY_PARAM } from '@/outreach-home/constants/outreach-command.constants';

type OutreachDashboardScopeProviderProps = {
  objectNameSingular: string;
  objectRecordId: string;
  children: ReactNode;
};

const normalizeVariant = (
  value: string | null,
): OutreachDashboardExperimentVariantFilter => {
  if (value === 'A' || value === 'B') {
    return value;
  }

  return 'ALL';
};

export const OutreachDashboardScopeProvider = ({
  objectNameSingular,
  objectRecordId,
  children,
}: OutreachDashboardScopeProviderProps) => {
  const isOutreachCommandDashboard = useIsOutreachCommandDashboardRecord({
    objectNameSingular,
    objectRecordId,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const { projectOptions, loading: projectsLoading } = useOutreachDashboardProjects();

  const projectIdFromQuery = searchParams.get(OUTREACH_PROJECT_ID_QUERY_PARAM);
  const variantFromQuery = searchParams.get(OUTREACH_EXPERIMENT_VARIANT_QUERY_PARAM);

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
        next.delete(OUTREACH_PROJECT_ID_QUERY_PARAM);
      } else {
        next.set(OUTREACH_PROJECT_ID_QUERY_PARAM, projectId);
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setExperimentVariant = useCallback(
    (variant: OutreachDashboardExperimentVariantFilter) => {
      const next = new URLSearchParams(searchParams);

      if (variant === 'ALL') {
        next.delete(OUTREACH_EXPERIMENT_VARIANT_QUERY_PARAM);
      } else {
        next.set(OUTREACH_EXPERIMENT_VARIANT_QUERY_PARAM, variant);
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  if (!isOutreachCommandDashboard) {
    return children;
  }

  return (
    <OutreachDashboardScopeContext.Provider
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
    </OutreachDashboardScopeContext.Provider>
  );
};
