import { useMemo } from 'react';

import { isGtmProject } from '@/gtm-dashboard/utils/isGtmProject';
import { type GtmProjectOption } from '@/gtm-home/types/gtm-home.types';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type GtmProjectRecord = ObjectRecord & {
  name?: string | null;
  outreachWorkflowId?: string | null;
  icpSpec?: string | null;
};

const parseIcpSegment = (icpSpec: string | null | undefined): string | null => {
  if (!icpSpec) {
    return null;
  }

  try {
    const parsed = JSON.parse(icpSpec) as { buyerTitles?: string[] };

    if (Array.isArray(parsed.buyerTitles) && parsed.buyerTitles.length > 0) {
      return parsed.buyerTitles.slice(0, 2).join(', ');
    }
  } catch {
    return null;
  }

  return null;
};

export const useGtmDashboardProjects = () => {
  const { records, loading } = useFindManyRecords<GtmProjectRecord>({
    objectNameSingular: 'project',
    orderBy: [{ updatedAt: 'DescNullsFirst' }],
    limit: 50,
    recordGqlFields: {
      id: true,
      name: true,
      outreachWorkflowId: true,
      icpSpec: true,
      updatedAt: true,
    },
  });

  const projectOptions = useMemo((): GtmProjectOption[] => {
    return records
      .filter(isGtmProject)
      .map((project) => ({
        id: project.id,
        name: project.name?.trim() || 'Untitled GTM project',
        icpSegment: parseIcpSegment(project.icpSpec),
      }));
  }, [records]);

  return {
    projectOptions,
    loading,
  };
};
