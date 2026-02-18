import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

export const useFetchContactDetailsAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    const tableState = useRecoilValue(tableStateAtom);
    const tokenPair = useRecoilValue(tokenPairState);
    const { enqueueSnackBar } = useSnackBar();

    const setNumberOfSelectedRecords = useSetRecoilComponentStateV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const setTargetedRecordsRule = useSetRecoilComponentStateV2(
      contextStoreTargetedRecordsRuleComponentState,
    );

    const [isLoading, setIsLoading] = useState(false);
    const [pollingJobId, setPollingJobId] = useState<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const resetState = useCallback(() => {
      setIsLoading(false);
      setNumberOfSelectedRecords(0);
      setTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setPollingJobId(null);
    }, [setNumberOfSelectedRecords, setTargetedRecordsRule]);

    // Poll job progress when jobId is set
    useEffect(() => {
      if (!pollingJobId || !tokenPair?.accessToken?.token) {
        return;
      }

      const pollJobProgress = async () => {
        try {
          const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
          const jobId = location.pathname.split('/job/')[1]?.split('/')[0];
          const response = await fetch(
            `${baseUrl}/contact-enrichment/jobs/${pollingJobId}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${tokenPair.accessToken.token}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error('Failed to fetch job progress');
          }

          const progress = await response.json();

          if (progress.status === 'completed') {
            // Job completed - update candidates
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            const results = progress.results || {};
            let updatedCount = 0;

            for (const [linkedinUrl, result] of Object.entries(results)) {
              const contactResult = result as {
                emails?: string[];
                phones?: string[];
              };

              if (
                (contactResult.emails && contactResult.emails.length > 0) ||
                (contactResult.phones && contactResult.phones.length > 0)
              ) {
                // Update candidate via backend
                try {
                  await fetch(
                    `${baseUrl}/candidate-sourcing/update-contact-from-enrichment`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${tokenPair.accessToken.token}`,
                      },
                      body: JSON.stringify({
                        linkedinUrl,
                        emails: contactResult.emails || [],
                        phones: contactResult.phones || [],
                        jobId,
                      }),
                    },
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

            enqueueSnackBar(
              `Successfully fetched and updated contacts for ${updatedCount}/${Object.keys(results).length} candidates`,
              {
                variant: SnackBarVariant.Success,
              },
            );

            setPollingJobId(null);
            resetState();
          } else if (progress.status === 'failed') {
            // Job failed
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            enqueueSnackBar(
              progress.error || 'Contact fetch failed',
              {
                variant: SnackBarVariant.Error,
              },
            );

            setPollingJobId(null);
            setIsLoading(false);
          }
          // If status is 'running' or 'queued', continue polling
        } catch (error) {
          console.error('Error polling job progress:', error);
        }
      };

      // Poll immediately, then every 2 seconds
      pollJobProgress();
      pollingIntervalRef.current = setInterval(pollJobProgress, 2000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }, [pollingJobId, tokenPair, location.pathname, enqueueSnackBar, resetState]);

    const onClick = useCallback(async () => {
      if (!tokenPair?.accessToken?.token) {
        enqueueSnackBar('Authentication required', {
          variant: SnackBarVariant.Error,
        });
        return;
      }

      // Get selected candidates from table state
      const selectedIds = isJobRoute
        ? (tableState?.selectedRowIds ?? [])
        : [];

      if (selectedIds.length === 0) {
        enqueueSnackBar('Please select at least one candidate', {
          variant: SnackBarVariant.Error,
        });
        return;
      }

      setIsLoading(true);

      try {
        const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
        const jobId = location.pathname.split('/job/')[1]?.split('/')[0];

        // Fetch candidate data to get LinkedIn URLs
        const response = await fetch(
          `${baseUrl}/candidate-sourcing/get-candidates-by-job-id`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair.accessToken.token}`,
            },
            body: JSON.stringify({
              jobId,
              candidateIds: selectedIds,
            }),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to fetch candidate data');
        }

        const candidates = await response.json();
        const linkedinUrls = candidates
          .map((c: any) => {
            const linkedinUrlField =
              c.linkedinUrl?.primaryLinkUrl ||
              c.linkedinUrl ||
              c.profile_url;
            return linkedinUrlField;
          })
          .filter((url: string) => url && url.includes('linkedin.com'));

        if (linkedinUrls.length === 0) {
          enqueueSnackBar(
            'No LinkedIn URLs found for selected candidates',
            {
              variant: SnackBarVariant.Warning,
            },
          );
          setIsLoading(false);
          return;
        }

        // Fetch contacts (bulk if > 20, otherwise sync)
        const fetchResponse = await fetch(
          `${baseUrl}/contact-enrichment/fetch`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair.accessToken.token}`,
            },
            body: JSON.stringify({
              linkedinUrls,
              wantEmail: true,
              wantPhone: true,
            }),
          },
        );

        if (!fetchResponse.ok) {
          throw new Error('Failed to fetch contact details');
        }

        const fetchData = await fetchResponse.json();

        // Handle async job response
        if (fetchData.jobId) {
          enqueueSnackBar(
            `Fetching contacts for ${linkedinUrls.length} candidates...`,
            {
              variant: SnackBarVariant.Info,
            },
          );
          setPollingJobId(fetchData.jobId);
          // Polling will be handled by useEffect
        } else {
          // Synchronous response - update candidates
          const results = fetchData.results || {};
          let updatedCount = 0;

          for (const [linkedinUrl, result] of Object.entries(results)) {
            const contactResult = result as {
              emails?: string[];
              phones?: string[];
            };

            if (
              (contactResult.emails && contactResult.emails.length > 0) ||
              (contactResult.phones && contactResult.phones.length > 0)
            ) {
              // Update candidate via backend
              try {
                await fetch(
                  `${baseUrl}/candidate-sourcing/update-contact-from-enrichment`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${tokenPair.accessToken.token}`,
                    },
                    body: JSON.stringify({
                      linkedinUrl,
                      emails: contactResult.emails || [],
                      phones: contactResult.phones || [],
                      jobId,
                    }),
                  },
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

          enqueueSnackBar(
            `Successfully fetched and updated contacts for ${updatedCount}/${linkedinUrls.length} candidates`,
            {
              variant: SnackBarVariant.Success,
            },
          );
        }

        resetState();
      } catch (error) {
        console.error('Fetch contact details failed:', error);
        enqueueSnackBar(
          error instanceof Error
            ? error.message
            : 'Failed to fetch contact details',
          {
            variant: SnackBarVariant.Error,
          },
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      isJobRoute,
      tableState,
      tokenPair,
      location.pathname,
      enqueueSnackBar,
      resetState,
    ]);

    return {
      onClick,
      isLoading,
      shouldBeRegistered: true,
    };
  };
