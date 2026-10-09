import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type SaveTargetsToCrmCounts = {
  created: number;
  matched: number;
  skipped: number;
};

type SaveTargetsToCrmResponse = {
  success: boolean;
  error?: string;
  companies: SaveTargetsToCrmCounts;
  people: SaveTargetsToCrmCounts;
};

type SaveTargetsToCrmArgs = {
  target: 'companies' | 'people' | 'both';
  companyIds?: string[];
  personIds?: string[];
};

// Plain Company / Person save for the ephemeral Find tabs. Unlike enroll, this
// never creates a Candidate.
export const useSaveOutreachTargetsToCrm = () => {
  const [isSaving, setIsSaving] = useState(false);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const outreachContext = useAtomStateValue(outreachContextState);
  const tokenPair = useAtomStateValue(tokenPairState);

  const saveTargetsToCrm = useCallback(
    async ({ target, companyIds, personIds }: SaveTargetsToCrmArgs) => {
      const projectId = outreachContext.projectId;
      const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      if (!isDefined(projectId)) {
        enqueueErrorSnackBar({
          message: 'Select or create a project before saving to CRM',
        });

        return null;
      }

      if (!isDefined(accessToken)) {
        enqueueErrorSnackBar({ message: 'Sign in again to save to CRM' });

        return null;
      }

      setIsSaving(true);

      try {
        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/outreach-command/save-targets-to-crm`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              projectId,
              target,
              companyIds,
              personIds,
            }),
          },
        );
        const result = (await response.json()) as SaveTargetsToCrmResponse;

        if (!response.ok || !result.success) {
          enqueueErrorSnackBar({
            message: result.error ?? 'Failed to save to CRM',
          });

          return null;
        }

        const createdCount = result.companies.created + result.people.created;
        const existingCount = result.companies.matched + result.people.matched;

        enqueueSuccessSnackBar({
          message: `Saved ${createdCount} to CRM, ${existingCount} already there`,
          options: {
            detailedMessage: `Companies ${result.companies.created} new, people ${result.people.created} new, ${result.people.skipped} people skipped (no LinkedIn URL). Nobody was enrolled.`,
          },
        });

        return result;
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : 'Failed to save to CRM',
        });

        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      outreachContext.projectId,
      tokenPair,
    ],
  );

  return { isSaving, saveTargetsToCrm };
};
