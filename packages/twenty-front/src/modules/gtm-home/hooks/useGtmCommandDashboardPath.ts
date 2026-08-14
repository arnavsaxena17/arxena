import { AppPath } from 'twenty-shared/types';
import { getAppPath, isDefined } from 'twenty-shared/utils';

import { GTM_COMMAND_DASHBOARD_TITLE } from '@/gtm-home/constants/gtm-command.constants';
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

export const useCanQueryDashboardRecords = () => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const dashboardMetadataItem = objectMetadataItems.find(
    (item) => item.nameSingular === 'dashboard',
  );

  return (
    isDefined(dashboardMetadataItem) && dashboardMetadataItem.fields.length > 0
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
    ? getAppPath(AppPath.RecordShowPage, {
        objectNameSingular: 'dashboard',
        objectRecordId: dashboard.id,
      })
    : getAppPath(AppPath.RecordIndexPage, {
        objectNamePlural: 'dashboards',
      });

  return {
    dashboard,
    dashboardPath,
    loading,
  };
};
