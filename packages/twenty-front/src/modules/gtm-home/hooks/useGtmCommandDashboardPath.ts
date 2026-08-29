import { AppPath } from 'twenty-shared/types';
import { getAppPath, isDefined } from 'twenty-shared/utils';

import { GTM_COMMAND_DASHBOARD_TITLE, GTM_PROJECT_ID_QUERY_PARAM } from '@/gtm-home/constants/gtm-command.constants';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type DashboardNavRecord = ObjectRecord & {
  title: string;
};

export const getGtmCommandDashboardFallbackPath = () =>
  getAppPath(AppPath.RecordIndexPage, {
    objectNamePlural: 'dashboards',
  });

export const buildGtmCommandDashboardPath = ({
  dashboardId,
  projectId,
}: {
  dashboardId: string;
  projectId?: string | null;
}) => {
  const path = getAppPath(AppPath.RecordShowPage, {
    objectNameSingular: 'dashboard',
    objectRecordId: dashboardId,
  });

  if (!isDefined(projectId) || projectId.length === 0) {
    return path;
  }

  const searchParams = new URLSearchParams();

  searchParams.set(GTM_PROJECT_ID_QUERY_PARAM, projectId);

  return `${path}?${searchParams.toString()}`;
};

export const useCanQueryDashboardRecords = () => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const dashboardMetadataItem = objectMetadataItems.find(
    (item) => item.nameSingular === 'dashboard',
  );

  return (
    isDefined(dashboardMetadataItem) &&
    dashboardMetadataItem.isActive &&
    dashboardMetadataItem.fields.length > 0
  );
};

export const useGtmCommandDashboardPath = () => {
  const { records, loading } = useFindManyRecords<DashboardNavRecord>({
    objectNameSingular: 'dashboard',
    filter: {
      title: {
        eq: GTM_COMMAND_DASHBOARD_TITLE,
      },
    },
    limit: 1,
    recordGqlFields: {
      id: true,
      title: true,
    },
  });

  const dashboard = records[0];
  const dashboardPath = isDefined(dashboard)
    ? buildGtmCommandDashboardPath({ dashboardId: dashboard.id })
    : getAppPath(AppPath.RecordIndexPage, {
        objectNamePlural: 'dashboards',
      });

  return {
    dashboard,
    dashboardPath,
    loading,
  };
};
