import { useMemo } from 'react';

import { OUTREACH_DASHBOARD_RECORD_ID } from '@/outreach-dashboard/constants/outreach-dashboard.constants';
import { OUTREACH_DASHBOARD_TITLE } from '@/outreach-home/constants/outreach-command.constants';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { CoreObjectNameSingular } from 'twenty-shared/types';

export const useIsOutreachCommandDashboardRecord = ({
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

    if (objectRecordId === OUTREACH_DASHBOARD_RECORD_ID) {
      return true;
    }

    return dashboardTitle === OUTREACH_DASHBOARD_TITLE;
  }, [dashboardTitle, objectNameSingular, objectRecordId]);
};
