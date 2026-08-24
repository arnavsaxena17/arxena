import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { gtmCommandContextState } from '@/gtm-home/states/gtmCommandContextState';
import { useAddGtmRecordsToCrm } from '@/gtm-home/hooks/useAddGtmRecordsToCrm';
import {
  type GtmCompanyRow,
  type GtmPersonRow,
} from '@/gtm-home/types/gtm-home.types';
import { applyMaxPersonasPerCompany } from '@/gtm-home/utils/gtm-persona-priority.util';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type GtmProjectRecord = ObjectRecord & {
  outreachWorkflowId?: string | null;
  maxPersonasPerCompany?: number | null;
};

export const useGtmOutreachEnroll = () => {
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const gtmCommandContext = useAtomStateValue(gtmCommandContextState);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { updateOneRecord } = useUpdateOneRecord();
  const { ensureCrmCompany } = useAddGtmRecordsToCrm();

  const projectId = gtmCommandContext.projectId;

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

      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

      if (!accessToken) {
        enqueueErrorSnackBar({ message: 'Sign in again to enroll people' });
        return 0;
      }

      const project = projects[0];
      const maxPersonas = project?.maxPersonasPerCompany ?? 2;
      const ranked = applyMaxPersonasPerCompany({
        people,
        maxPersonasPerCompany: maxPersonas,
      });

      let deferred = 0;
      const companyIdCache = new Map<string, string>();
      const toUpload: GtmPersonRow[] = [];

      for (const person of ranked) {
        if (person.doNotContact === true || person.stage === 'deferred') {
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

        toUpload.push(person);
      }

      if (toUpload.length === 0) {
        enqueueSuccessSnackBar({
          message: `Enrolled 0, deferred ${deferred}`,
        });
        return 0;
      }

      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-profiles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            linkedin_search_results: toUpload.map((person) => ({
              name: person.name,
              title: person.title,
              company: person.companyName,
              companyName: person.companyName,
              linkedinUrl: person.linkedinUrl,
              profileUrl: person.linkedinUrl,
              email: person.email,
            })),
            data_source: 'linkedin_search',
            projectId,
            twenty_job_id: projectId,
            job_id: projectId,
            job_name: 'GTM Outreach',
            job: {
              id: projectId,
              name: 'GTM Outreach',
            },
          }),
        },
      );

      const result = (await response.json()) as {
        status?: string;
        message?: string;
        error?: string;
      };

      if (result.status !== 'ok' && result.status !== 'success') {
        enqueueErrorSnackBar({
          message: result.message || result.error || 'Enroll failed',
        });
        return 0;
      }

      enqueueSuccessSnackBar({
        message: `Enrolled ${toUpload.length}, deferred ${deferred} (Project ${projectId.slice(0, 8)}…)`,
      });

      return toUpload.length;
    },
    [
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      ensureCrmCompany,
      projectId,
      projects,
      tokenPair,
    ],
  );

  const promoteDeferredCandidate = useCallback(
    async (candidateId: string) => {
      await updateOneRecord({
        objectNameSingular: 'candidate',
        idToUpdate: candidateId,
        updateOneRecordInput: {
          outreachSequenceStage: 'QUEUED',
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
