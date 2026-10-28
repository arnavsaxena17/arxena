import { useCallback, useState } from 'react';
import { resolveOutreachConfigMaxPersonasPerCompany } from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { useAddOutreachRecordsToCrm } from '@/outreach-home/hooks/useAddOutreachRecordsToCrm';
import {
  type OutreachCompanyRow,
  type OutreachPersonRow,
  type OutreachProjectRecord,
} from '@/outreach-home/types/outreach-home.types';
import { applyMaxPersonasPerCompany } from '@/outreach-home/utils/outreach-persona-priority.util';
import {
  collectPeopleNeedingEnrollment,
  resolveEnrolledCandidateIds,
} from '@/outreach-home/utils/resolve-enrolled-candidate-ids.util';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type OutreachProjectQueryRecord = ObjectRecord & OutreachProjectRecord;

type EnrollSelectedPeopleOptions = {
  silent?: boolean;
};

export const useOutreachEnroll = () => {
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const outreachContext = useAtomStateValue(outreachContextState);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { updateOneRecord } = useUpdateOneRecord();
  const { ensureCrmCompany } = useAddOutreachRecordsToCrm();
  const [isEnrolling, setIsEnrolling] = useState(false);

  const projectId = outreachContext.projectId;

  const { records: projects } = useFindManyRecords<OutreachProjectQueryRecord>({
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
      outreachConfig: true,
    },
  });

  const enrollSelectedPeople = useCallback(
    async (
      people: OutreachPersonRow[],
      companiesByTabId?: Record<string, OutreachCompanyRow>,
      options?: EnrollSelectedPeopleOptions,
    ) => {
      if (!isDefined(projectId)) {
        enqueueErrorSnackBar({
          message: 'Select a project before enrolling',
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
      const maxPersonas = resolveOutreachConfigMaxPersonasPerCompany(
        project?.outreachConfig,
        project?.maxPersonasPerCompany,
      );
      const ranked = applyMaxPersonasPerCompany({
        people,
        maxPersonasPerCompany: maxPersonas,
      });

      let deferred = 0;
      const companyIdCache = new Map<string, string>();
      const toUpload: OutreachPersonRow[] = [];

      for (const person of ranked) {
        if (person.doNotContact === true || person.stage === 'DEFERRED') {
          deferred += 1;
          continue;
        }

        const ephemeralCompany = companiesByTabId?.[person.companyId];

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
        if (options?.silent !== true) {
          enqueueSuccessSnackBar({
            message: `Enrolled 0, deferred ${deferred}`,
          });
        }
        return 0;
      }

      setIsEnrolling(true);

      try {
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
              job_name: 'Outreach',
              job: {
                id: projectId,
                name: 'Outreach',
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

        if (options?.silent !== true) {
          enqueueSuccessSnackBar({
            message: `Enrolled ${toUpload.length}, deferred ${deferred} (Project ${projectId.slice(0, 8)}…)`,
          });
        }

        return toUpload.length;
      } finally {
        setIsEnrolling(false);
      }
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

  // Assign owner on discovery rows: enroll first, wait for Candidates, return ids.
  const enrollAndResolveCandidateIds = useCallback(
    async (
      people: OutreachPersonRow[],
      companiesByTabId?: Record<string, OutreachCompanyRow>,
    ): Promise<string[]> => {
      if (!isDefined(projectId)) {
        enqueueErrorSnackBar({
          message: 'Select a project before assigning',
        });
        return [];
      }

      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

      if (!accessToken) {
        enqueueErrorSnackBar({ message: 'Sign in again to assign owners' });
        return [];
      }

      const needingEnrollment = collectPeopleNeedingEnrollment(people);

      if (needingEnrollment.length > 0) {
        const enrolledCount = await enrollSelectedPeople(
          needingEnrollment,
          companiesByTabId,
          { silent: true },
        );

        if (enrolledCount === 0 && needingEnrollment.length > 0) {
          const alreadyEnrolled = people
            .map((person) => person.candidateId)
            .filter((candidateId): candidateId is string =>
              isDefined(candidateId),
            );

          if (alreadyEnrolled.length === 0) {
            return [];
          }
        }

        enqueueSuccessSnackBar({
          message: `Enrolling ${needingEnrollment.length}… waiting for Candidates`,
        });
      }

      setIsEnrolling(true);

      try {
        const candidateIds = await resolveEnrolledCandidateIds({
          projectId,
          accessToken,
          people,
        });

        if (candidateIds.length === 0) {
          enqueueErrorSnackBar({
            message:
              'Enrollment is still processing. Try Assign again in a moment.',
          });
        }

        return candidateIds;
      } finally {
        setIsEnrolling(false);
      }
    },
    [
      enrollSelectedPeople,
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      projectId,
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
    enrollAndResolveCandidateIds,
    promoteDeferredCandidate,
    isEnrolling,
    projectId,
    outreachWorkflowId: projects[0]?.outreachWorkflowId ?? null,
  };
};
