import { tokenPairState } from '@/auth/states/tokenPairState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { getProjectIdFromPathname } from '@/command-menu-item/engine-command/record/arx/utils/isProjectRoute';
import { isProjectRoute } from '@/command-menu-item/engine-command/record/arx/utils/isProjectRoute';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type ContactAvailabilityResult = {
  emailAvailable?: boolean;
  phoneAvailable?: boolean;
  emails?: string[];
  phones?: string[];
};

export const useArxCheckContactAvailability = () => {
  const location = useLocation();
  const onProjectRoute = isProjectRoute(location.pathname);
  const tableState = useAtomStateValue(tableStateAtom);
  const tokenPair = useAtomStateValue(tokenPairState);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setPollingJobId(null);
  }, []);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const checkAvailability = useCallback(
    async (
      onComplete: (message: string, isError: boolean) => void,
    ): Promise<boolean> => {
      if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
        onComplete('Authentication required', true);
        return false;
      }

      const selectedIds = onProjectRoute
        ? (tableState?.selectedRowIds ?? [])
        : [];

      if (selectedIds.length === 0) {
        onComplete('Please select at least one candidate', true);
        return false;
      }

      const baseUrl = REACT_APP_SERVER_BASE_URL;
      const projectId = getProjectIdFromPathname(location.pathname);

      const response = await fetch(
        `${baseUrl}/candidate-sourcing/get-candidates-by-job-id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
          body: JSON.stringify({
            jobId: projectId,
            candidateIds: selectedIds,
          }),
        },
      );

      if (!response.ok) {
        onComplete('Failed to fetch candidate data', true);
        return false;
      }

      const candidates = await response.json();
      const linkedinUrls = candidates
        .map((candidate: Record<string, unknown>) => {
          const linkedinUrlField =
            (candidate.linkedinUrl as { primaryLinkUrl?: string } | undefined)
              ?.primaryLinkUrl ||
            candidate.linkedinUrl ||
            candidate.profile_url;
          return linkedinUrlField;
        })
        .filter(
          (url: unknown): url is string =>
            typeof url === 'string' && url.includes('linkedin.com'),
        );

      if (linkedinUrls.length === 0) {
        onComplete('No LinkedIn URLs found for selected candidates', true);
        return false;
      }

      const availabilityResponse = await fetch(
        `${baseUrl}/contact-enrichment/availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
          },
          body: JSON.stringify({ linkedinUrls }),
        },
      );

      if (!availabilityResponse.ok) {
        onComplete('Failed to check contact availability', true);
        return false;
      }

      const availabilityData = await availabilityResponse.json();

      if (availabilityData.jobId) {
        onComplete(
          `Checking availability for ${linkedinUrls.length} candidates...`,
          false,
        );

        setPollingJobId(availabilityData.jobId);

        pollingIntervalRef.current = setInterval(async () => {
          try {
            const progressResponse = await fetch(
              `${baseUrl}/contact-enrichment/jobs/${availabilityData.jobId}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken?.token}`,
                },
              },
            );

            if (!progressResponse.ok) {
              return;
            }

            const progress = await progressResponse.json();

            if (progress.status === 'completed') {
              clearPolling();
              const results = (progress.results || {}) as Record<
                string,
                ContactAvailabilityResult
              >;
              const availableCount = Object.values(results).filter(
                (result) =>
                  result.emailAvailable ||
                  result.phoneAvailable ||
                  (result.emails && result.emails.length > 0) ||
                  (result.phones && result.phones.length > 0),
              ).length;
              const total = progress.total || Object.keys(results).length;
              onComplete(
                `Contact availability check completed: ${availableCount}/${total} candidates have contact info available`,
                false,
              );
            } else if (progress.status === 'failed') {
              clearPolling();
              onComplete(
                progress.error || 'Contact availability check failed',
                true,
              );
            }
          } catch {
            // keep polling
          }
        }, 2000);

        return true;
      }

      const results = (availabilityData.results || {}) as Record<
        string,
        ContactAvailabilityResult
      >;
      const availableCount = Object.values(results).filter(
        (result) => result.emailAvailable || result.phoneAvailable,
      ).length;

      onComplete(
        `Contact availability: ${availableCount}/${linkedinUrls.length} candidates have contact info available`,
        false,
      );
      return true;
    },
    [
      clearPolling,
      location.pathname,
      onProjectRoute,
      tableState?.selectedRowIds,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

  return { checkAvailability, pollingJobId };
};
