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

export const useCheckContactAvailabilityAction: ActionHookWithObjectMetadataItem =
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
            // Job completed
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            const results = progress.results || {};
            const availableCount = Object.values(results).filter(
              (r: any) =>
                (r.emailAvailable || r.phoneAvailable) !== undefined
                  ? r.emailAvailable || r.phoneAvailable
                  : (r.emails && r.emails.length > 0) ||
                    (r.phones && r.phones.length > 0),
            ).length;
            const total = progress.total || Object.keys(results).length;

            enqueueSnackBar(
              `Contact availability check completed: ${availableCount}/${total} candidates have contact info available`,
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
              progress.error || 'Contact availability check failed',
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
    }, [pollingJobId, tokenPair, enqueueSnackBar, resetState]);

    const onClick = useCallback(async () => {
      if (!tokenPair?.accessToken?.token) {
        enqueueSnackBar('Authentication required', {
          variant: SnackBarVariant.Error,
        });
        return;
      }

      // Get selected candidates from table state or context store
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
        // Fetch candidate data to get LinkedIn URLs
        const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
        const response = await fetch(
          `${baseUrl}/candidate-sourcing/get-candidates-by-job-id`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair.accessToken.token}`,
            },
            body: JSON.stringify({
              jobId: location.pathname.split('/job/')[1]?.split('/')[0],
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

        // Check availability (bulk if > 20, otherwise sync)
        const availabilityResponse = await fetch(
          `${baseUrl}/contact-enrichment/availability`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair.accessToken.token}`,
            },
            body: JSON.stringify({
              linkedinUrls,
            }),
          },
        );

        if (!availabilityResponse.ok) {
          throw new Error('Failed to check contact availability');
        }

        const availabilityData = await availabilityResponse.json();

        // Handle async job response
        if (availabilityData.jobId) {
          enqueueSnackBar(
            `Checking availability for ${linkedinUrls.length} candidates...`,
            {
              variant: SnackBarVariant.Info,
            },
          );
          setPollingJobId(availabilityData.jobId);
          // Polling will be handled by useEffect
        } else {
          // Synchronous response
          const results = availabilityData.results || {};
          const availableCount = Object.values(results).filter(
            (r: any) => r.emailAvailable || r.phoneAvailable,
          ).length;

          enqueueSnackBar(
            `Contact availability: ${availableCount}/${linkedinUrls.length} candidates have contact info available`,
            {
              variant: SnackBarVariant.Success,
            },
          );
        }

        resetState();
      } catch (error) {
        console.error('Check contact availability failed:', error);
        enqueueSnackBar(
          error instanceof Error
            ? error.message
            : 'Failed to check contact availability',
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
