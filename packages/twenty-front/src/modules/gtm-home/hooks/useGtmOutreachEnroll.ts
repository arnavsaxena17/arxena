import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { gtmCommandContextState } from '@/gtm-home/states/gtmCommandContextState';
import { useAddGtmRecordsToCrm } from '@/gtm-home/hooks/useAddGtmRecordsToCrm';
import {
  type GtmCompanyRow,
  type GtmPersonRow,
} from '@/gtm-home/types/gtm-home.types';
import { applyMaxPersonasPerCompany } from '@/gtm-home/utils/gtm-persona-priority.util';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

type GtmProjectRecord = ObjectRecord & {
  gtmRunKey?: string | null;
  outreachWorkflowId?: string | null;
  maxPersonasPerCompany?: number | null;
};

export const useGtmOutreachEnroll = () => {
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const gtmCommandContext = useAtomStateValue(gtmCommandContextState);
  const { updateOneRecord } = useUpdateOneRecord();
  const { createOneRecord: createCandidate } = useCreateOneRecord({
    objectNameSingular: 'candidate',
  });
  const { ensureCrmCompany } = useAddGtmRecordsToCrm();

  const projectId = commandContext.projectId;

  const { records: projects } = useFindManyRecords<GtmProjectRecord>({
    objectNameSingular: 'project',
    filter: isDefined(projectId)
      ? {
          id: { eq: projectId },
        }
      : undefined,
    limit: 1,
    skip: !isDefined(projectId),
    recordGqlFields: {
      id: true,
      gtmRunKey: true,
      outreachWorkflowId: true,
      maxPersonasPerCompany: true,
    },
  });

  const enrollSelectedPeople = useCallback(
    async (
      people: GtmPersonRow[],
      companiesByWorkingSetId?: Record<string, GtmCompanyRow>,
    ) => {
      if (!isDefined(projectId)) {
        enqueueErrorSnackBar({
          message: 'Select a GTM Project before enrolling',
        });
        return 0;
      }

      if (people.length === 0) {
        enqueueErrorSnackBar({ message: 'Select people to enroll' });
        return 0;
      }

      const project = projects[0];
      const maxPersonas = project?.maxPersonasPerCompany ?? 2;
      const ranked = applyMaxPersonasPerCompany({
        people,
        maxPersonasPerCompany: maxPersonas,
      });

      let enrolled = 0;
      let deferred = 0;
      const companyIdCache = new Map<string, string>();

      for (const person of ranked) {
        if (person.doNotContact === true) {
          deferred += 1;
          continue;
        }

        if (person.stage === 'deferred') {
          deferred += 1;
          continue;
        }

        const ephemeralCompany = companiesByWorkingSetId?.[person.companyId];

        if (isDefined(ephemeralCompany)) {
          const cacheKey = ephemeralCompany.domain || ephemeralCompany.name;

          if (!companyIdCache.has(cacheKey)) {
            const crmCompanyId = await ensureCrmCompany(ephemeralCompany);

            if (isDefined(crmCompanyId)) {
              companyIdCache.set(cacheKey, crmCompanyId);
            }
          }
        }

        await createCandidate({
          name: person.name,
          jobTitle: person.title,
          jobCompanyName: person.companyName,
          projectsId: projectId,
          gtmRunKey: projectId,
          outreachSequenceStage: 'QUEUED',
          connectionStatus: 'NONE',
          enrichStatus: 'NOT_STARTED',
          connectionDegree: person.connectionDegree ?? null,
          personaPriorityScore: person.personaPriorityScore ?? null,
          messagingChannel: 'LINKEDIN',
          campaign: projectId,
          source: 'gtm-home-enroll',
        });
        enrolled += 1;
      }

      enqueueSuccessSnackBar({
        message: `Enrolled ${enrolled}, deferred ${deferred} (Project ${projectId.slice(0, 8)}…)`,
      });

      return enrolled;
    },
    [
      createCandidate,
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      ensureCrmCompany,
      projectId,
      projects,
    ],
  );

  const promoteDeferredCandidate = useCallback(
    async (candidateId: string) => {
      await updateOneRecord({
        objectNameSingular: 'candidate',
        idToUpdate: candidateId,
        updateOneRecordInput: {
          outreachSequenceStage: 'QUEUED',
          stoppedReason: null,
        },
      });

      enqueueSuccessSnackBar({
        message: 'Promoted deferred candidate to QUEUED',
      });
    },
    [enqueueSuccessSnackBar, updateOneRecord],
  );

  return {
    enrollSelectedPeople,
    promoteDeferredCandidate,
    projectId,
    outreachWorkflowId: projects[0]?.outreachWorkflowId ?? null,
  };
};
