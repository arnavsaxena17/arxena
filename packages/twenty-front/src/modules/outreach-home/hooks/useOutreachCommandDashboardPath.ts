import { AppPath } from 'twenty-shared/types';
import { getAppPath, isDefined } from 'twenty-shared/utils';

import {
  OUTREACH_DASHBOARD_TITLE,
  OUTREACH_PROJECT_ID_QUERY_PARAM,
} from '@/outreach-home/constants/outreach-command.constants';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type DashboardNavRecord = ObjectRecord & {
  title: string;
};

export const getOutreachDashboardFallbackPath = () =>
  getAppPath(AppPath.RecordIndexPage, {
    objectNamePlural: 'dashboards',
  });

export const buildOutreachCommandDashboardPath = ({
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

  searchParams.set(OUTREACH_PROJECT_ID_QUERY_PARAM, projectId);

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

export const useOutreachCommandDashboardPath = () => {
  const { records, loading } = useFindManyRecords<DashboardNavRecord>({
    objectNameSingular: 'dashboard',
    filter: {
      title: {
        eq: OUTREACH_DASHBOARD_TITLE,
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
    ? buildOutreachCommandDashboardPath({ dashboardId: dashboard.id })
    : getAppPath(AppPath.RecordIndexPage, {
        objectNamePlural: 'dashboards',
      });

  return {
    dashboard,
    dashboardPath,
    loading,
  };
};
