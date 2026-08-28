import { useMemo } from 'react';

import { GTM_COMMAND_DASHBOARD_RECORD_ID } from '@/gtm-dashboard/constants/gtm-dashboard.constants';
import { GTM_COMMAND_DASHBOARD_TITLE } from '@/gtm-home/constants/gtm-command.constants';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { CoreObjectNameSingular } from 'twenty-shared/types';

export const useIsGtmCommandDashboardRecord = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const dashboardTitle = useAtomFamilySelectorValue(recordStoreFamilySelector, {
    recordId: objectRecordId,
    fieldName: 'title',
  }) as string | null | undefined;

  return useMemo(() => {
    if (objectNameSingular !== CoreObjectNameSingular.Dashboard) {
      return false;
    }

    if (objectRecordId === GTM_COMMAND_DASHBOARD_RECORD_ID) {
      return true;
    }

    return dashboardTitle === GTM_COMMAND_DASHBOARD_TITLE;
  }, [dashboardTitle, objectNameSingular, objectRecordId]);
};
