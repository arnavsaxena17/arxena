import { isNonEmptyString } from '@sniptt/guards';
import { type ReactNode, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { GtmDashboardScopeContext } from '@/gtm-dashboard/contexts/GtmDashboardScopeContext';
import { useGtmDashboardProjects } from '@/gtm-dashboard/hooks/useGtmDashboardProjects';
import { useIsGtmCommandDashboardRecord } from '@/gtm-dashboard/hooks/useIsGtmCommandDashboardRecord';
import { GTM_PROJECT_ID_QUERY_PARAM } from '@/gtm-home/constants/gtm-command.constants';

type GtmDashboardScopeProviderProps = {
  objectNameSingular: string;
  objectRecordId: string;
  children: ReactNode;
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

  if (!isGtmCommandDashboard) {
    return children;
  }

  return (
    <GtmDashboardScopeContext.Provider
      value={{
        isActive: true,
        selectedProjectId,
        setSelectedProjectId,
        projectOptions,
        projectsLoading,
      }}
    >
      {children}
    </GtmDashboardScopeContext.Provider>
  );
};
