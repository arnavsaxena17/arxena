import { tokenPairState } from '@/auth/states/tokenPairState';
import { tableStateAtom } from '@/candidate-table/states/states';
import {
  getProjectIdFromPathname,
  isProjectRoute,
} from '@/command-menu-item/engine-command/record/arx/utils/isProjectRoute';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const INSUFFICIENT_CONTACT_CREDITS_SNACKBAR =
  'You are out of contact credits. Add credits to continue.';

type ContactFetchResult = {
  emails?: string[];
  phones?: string[];
};

const getResponseErrorMessage = async (response: Response) => {
  try {
    const json = (await response.json()) as unknown;
    if (
      json !== null &&
      json !== undefined &&
      typeof json === 'object' &&
      'message' in json &&
      typeof (json as { message?: unknown }).message === 'string' &&
      (json as { message: string }).message.trim().length > 0
    ) {
      return (json as { message: string }).message.trim();
    }
  } catch {
    // ignore JSON parse errors
  }

  try {
    const text = await response.text();
    if (text.trim().length > 0) {
      return text.trim();
    }
  } catch {
    // ignore
  }

  return `Request failed (${response.status})`;
};

export const useArxFetchContactDetails = () => {
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

  const updateCandidateFromEnrichment = useCallback(
    async (
      linkedinUrl: string,
      contactResult: ContactFetchResult,
      projectId: string | undefined,
    ) => {
      const baseUrl = REACT_APP_SERVER_BASE_URL;

      await fetch(`${baseUrl}/candidate-sourcing/update-contact-from-enrichment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
        },
        body: JSON.stringify({
          linkedinUrl,
          emails: contactResult.emails || [],
          phones: contactResult.phones || [],
          jobId: projectId,
        }),
      });
    },
    [tokenPair?.accessOrWorkspaceAgnosticToken?.token],
  );

  const fetchContactDetails = useCallback(
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

      const fetchResponse = await fetch(`${baseUrl}/contact-enrichment/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
        },
        body: JSON.stringify({
          linkedinUrls,
          wantEmail: true,
          wantPhone: true,
        }),
      });

      if (!fetchResponse.ok) {
        const message = await getResponseErrorMessage(fetchResponse);
        onComplete(
          fetchResponse.status === 403 ||
            /insufficient contact credits/i.test(message)
            ? INSUFFICIENT_CONTACT_CREDITS_SNACKBAR
            : message,
          true,
        );
        return false;
      }

      const fetchData = await fetchResponse.json();

      if (fetchData.jobId) {
        onComplete(
          `Fetching contacts for ${linkedinUrls.length} candidates...`,
          false,
        );

        setPollingJobId(fetchData.jobId);

        pollingIntervalRef.current = setInterval(async () => {
          try {
            const progressResponse = await fetch(
              `${baseUrl}/contact-enrichment/jobs/${fetchData.jobId}`,
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
                ContactFetchResult
              >;
              let updatedCount = 0;

              for (const [linkedinUrl, result] of Object.entries(results)) {
                if (
                  (result.emails && result.emails.length > 0) ||
                  (result.phones && result.phones.length > 0)
                ) {
                  try {
                    await updateCandidateFromEnrichment(
                      linkedinUrl,
                      result,
                      projectId,
                    );
                    updatedCount++;
                  } catch (error) {
                    console.error(
                      `Failed to update candidate for ${linkedinUrl}:`,
                      error,
                    );
                  }
                }
              }

              onComplete(
                `Successfully fetched and updated contacts for ${updatedCount}/${Object.keys(results).length} candidates`,
                false,
              );
            } else if (progress.status === 'failed') {
              clearPolling();
              onComplete(progress.error || 'Contact fetch failed', true);
            }
          } catch {
            // keep polling
          }
        }, 2000);

        return true;
      }

      const results = (fetchData.results || {}) as Record<
        string,
        ContactFetchResult
      >;
      let updatedCount = 0;

      for (const [linkedinUrl, result] of Object.entries(results)) {
        if (
          (result.emails && result.emails.length > 0) ||
          (result.phones && result.phones.length > 0)
        ) {
          try {
            await updateCandidateFromEnrichment(
              linkedinUrl,
              result,
              projectId,
            );
            updatedCount++;
          } catch (error) {
            console.error(
              `Failed to update candidate for ${linkedinUrl}:`,
              error,
            );
          }
        }
      }

      onComplete(
        `Successfully fetched and updated contacts for ${updatedCount}/${linkedinUrls.length} candidates`,
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
      updateCandidateFromEnrichment,
    ],
  );

  return { fetchContactDetails, pollingJobId };
};
