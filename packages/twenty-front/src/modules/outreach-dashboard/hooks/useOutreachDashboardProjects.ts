import { useMemo } from 'react';
import { resolveOutreachConfigIcpSpecString } from 'twenty-shared/arx';

import { type OutreachProjectOption } from '@/outreach-home/types/outreach-home.types';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type OutreachProjectRecord = ObjectRecord & {
  name?: string | null;
  outreachWorkflowId?: string | null;
  outreachConfig?: unknown;
};

const parseIcpSegment = (icpSpec: string | null | undefined): string | null => {
  if (!icpSpec) {
    return null;
  }

  try {
    const parsed = JSON.parse(icpSpec) as { targetTitles?: string[] };

    if (Array.isArray(parsed.targetTitles) && parsed.targetTitles.length > 0) {
      return parsed.targetTitles.slice(0, 2).join(', ');
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
      outreachConfig: true,
      updatedAt: true,
    },
  });

  const projectOptions = useMemo((): OutreachProjectOption[] => {
    return records
      .map((project) => ({
        id: project.id,
        name: project.name?.trim() || 'Untitled GTM project',
        icpSegment: parseIcpSegment(
          resolveOutreachConfigIcpSpecString(project.outreachConfig),
        ),
      }));
  }, [records]);

  return {
    projectOptions,
    loading,
  };
};
