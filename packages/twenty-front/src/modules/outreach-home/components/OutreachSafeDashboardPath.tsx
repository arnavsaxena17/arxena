import { type ReactNode } from 'react';

import {
  getOutreachDashboardFallbackPath,
  useCanQueryDashboardRecords,
  useOutreachCommandDashboardPath,
} from '@/outreach-home/hooks/useOutreachCommandDashboardPath';

type OutreachSafeDashboardPathProps = {
  children: (dashboardPath: string) => ReactNode;
};

// Gates dashboard metadata before useFindManyRecords so missing/inactive
// dashboard objects never throw ObjectMetadataItemNotFoundError on mount.
export const OutreachSafeDashboardPath = ({
  children,
}: OutreachSafeDashboardPathProps) => {
  const canQueryDashboard = useCanQueryDashboardRecords();

  if (!canQueryDashboard) {
    return <>{children(getOutreachDashboardFallbackPath())}</>;
  }

  return (
    <OutreachSafeDashboardPathWithQuery>
      {children}
    </OutreachSafeDashboardPathWithQuery>
  );
};

const OutreachSafeDashboardPathWithQuery = ({
  children,
}: OutreachSafeDashboardPathProps) => {
  const { dashboardPath } = useOutreachCommandDashboardPath();

  return <>{children(dashboardPath)}</>;
};
