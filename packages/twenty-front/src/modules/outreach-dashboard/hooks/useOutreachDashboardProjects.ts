import { useMemo } from 'react';

import { isOutreachProject } from '@/outreach-dashboard/utils/isOutreachProject';
import { type OutreachProjectOption } from '@/outreach-home/types/outreach-home.types';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type OutreachProjectRecord = ObjectRecord & {
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

export const useOutreachDashboardProjects = () => {
  const { records, loading } = useFindManyRecords<OutreachProjectRecord>({
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

  const projectOptions = useMemo((): OutreachProjectOption[] => {
    return records
      .filter(isOutreachProject)
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
