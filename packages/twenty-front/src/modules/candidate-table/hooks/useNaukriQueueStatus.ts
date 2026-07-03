import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { naukriQueueStatusState } from '@/candidate-table/states/naukriQueueStatusState';
import {
    getNaukriQueueStatusFromPage,
    isTerminalNaukriQueueState,
    NaukriQueueSnapshot,
    stopNaukriQueueFromPage,
    subscribeToNaukriQueueUpdates,
} from '@/chrome-extension/utils/naukriQueueExtensionBridge';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

const ACTIVE_SNACKBAR_DEDUPE_KEY = 'naukri-queue-active';
const PERSISTENT_SNACKBAR_DURATION_MS = 60 * 60 * 1000;

const getProgressPercentage = (snapshot: NaukriQueueSnapshot): number => {
  if (snapshot.totalCount === 0) {
    return 0;
  }

  const processed = snapshot.completedCount + snapshot.failedCount;
  return Math.round((processed / snapshot.totalCount) * 100);
};

const getProgressMessage = (snapshot: NaukriQueueSnapshot): string => {
  const processed = snapshot.completedCount + snapshot.failedCount;
  const failedSuffix =
    snapshot.failedCount > 0 ? ` (${snapshot.failedCount} failed)` : '';

  if (snapshot.state === 'stopping') {
    return `Stopping after the current profile - ${processed}/${snapshot.totalCount}${failedSuffix}`;
  }

  if (snapshot.isCoolingDown) {
    return `Cooling down before next batch - ${processed}/${snapshot.totalCount}${failedSuffix}`;
  }

  return `Processing ${processed}/${snapshot.totalCount}${failedSuffix}`;
};

/**
 * DataTable-scoped Naukri queue status. Subscribes to extension push updates,
 * rehydrates on mount, renders a live snackbar with a Stop control, and refreshes
 * the candidate table when the queue completes or stops.
 */
export const useNaukriQueueStatus = () => {
  const { enqueueSnackBar, updateSnackBarByDedupeKey, closeSnackBarByDedupeKey } =
    useSnackBar();
  const [queueStatus, setQueueStatus] = useRecoilState(naukriQueueStatusState);
  const refreshDataFunction = useRecoilValue(dataTableRefreshFunctionState);

  const activeSnackBarShownRef = useRef(false);
  const lastTerminalQueueIdRef = useRef<string | null>(null);

  const handleStopQueue = useCallback(
    (queueId: string) => {
      stopNaukriQueueFromPage(queueId)
        .then((snapshot) => {
          if (snapshot) {
            setQueueStatus(snapshot);
          }
        })
        .catch((error) => {
          enqueueSnackBar(
            error instanceof Error
              ? error.message
              : 'Failed to stop Naukri queue',
            {
              variant: SnackBarVariant.Error,
              duration: 4000,
            },
          );
        });
    },
    [enqueueSnackBar, setQueueStatus],
  );

  // Subscribe to extension push updates while mounted.
  useEffect(() => {
    const unsubscribe = subscribeToNaukriQueueUpdates((snapshot) => {
      setQueueStatus(snapshot);
    });

    return unsubscribe;
  }, [setQueueStatus]);

  // Rehydrate the latest snapshot on mount so navigation does not lose status.
  useEffect(() => {
    let cancelled = false;

    getNaukriQueueStatusFromPage()
      .then((snapshot) => {
        if (!cancelled && snapshot) {
          setQueueStatus(snapshot);
        }
      })
      .catch(() => {
        /* extension not reachable; ignore */
      });

    return () => {
      cancelled = true;
    };
  }, [setQueueStatus]);

  // Render snackbar updates based on the current snapshot.
  useEffect(() => {
    if (!queueStatus) {
      return;
    }

    const isTerminal = isTerminalNaukriQueueState(queueStatus.state);

    if (!isTerminal) {
      const snackBarOptions = {
        variant: SnackBarVariant.Info,
        showProgressBar: true,
        progress: getProgressPercentage(queueStatus),
        progressMessage: getProgressMessage(queueStatus),
        duration: PERSISTENT_SNACKBAR_DURATION_MS,
        dedupeKey: ACTIVE_SNACKBAR_DEDUPE_KEY,
        onCancel:
          queueStatus.state === 'stopping'
            ? undefined
            : () => handleStopQueue(queueStatus.queueId),
      };

      if (!activeSnackBarShownRef.current) {
        enqueueSnackBar('Saving Naukri profiles', snackBarOptions);
        activeSnackBarShownRef.current = true;
      } else {
        updateSnackBarByDedupeKey(ACTIVE_SNACKBAR_DEDUPE_KEY, {
          message: 'Saving Naukri profiles',
          progress: snackBarOptions.progress,
          progressMessage: snackBarOptions.progressMessage,
          onCancel: snackBarOptions.onCancel,
        });
      }

      return;
    }

    // Terminal state: close the live snackbar and show a final one once.
    if (activeSnackBarShownRef.current) {
      closeSnackBarByDedupeKey(ACTIVE_SNACKBAR_DEDUPE_KEY);
      activeSnackBarShownRef.current = false;
    }

    if (lastTerminalQueueIdRef.current === queueStatus.queueId) {
      return;
    }
    lastTerminalQueueIdRef.current = queueStatus.queueId;

    const processed = queueStatus.completedCount + queueStatus.failedCount;

    if (queueStatus.state === 'completed') {
      enqueueSnackBar(
        queueStatus.failedCount > 0
          ? `Saved ${queueStatus.completedCount}/${queueStatus.totalCount} Naukri profile(s), ${queueStatus.failedCount} failed`
          : `Saved ${queueStatus.completedCount}/${queueStatus.totalCount} Naukri profile(s)`,
        {
          variant:
            queueStatus.failedCount > 0
              ? SnackBarVariant.Warning
              : SnackBarVariant.Success,
          duration: 5000,
        },
      );
    } else if (queueStatus.state === 'stopped') {
      enqueueSnackBar(
        `Stopped Naukri queue after ${processed}/${queueStatus.totalCount} profile(s)`,
        {
          variant: SnackBarVariant.Warning,
          duration: 5000,
        },
      );
    } else if (queueStatus.state === 'failed') {
      enqueueSnackBar(queueStatus.error ?? 'Naukri queue failed', {
        variant: SnackBarVariant.Error,
        duration: 6000,
      });
    }

    if (refreshDataFunction) {
      refreshDataFunction().catch((error) => {
        console.error(
          '[useNaukriQueueStatus] Failed to refresh table after queue finished:',
          error,
        );
      });
    }
  }, [
    queueStatus,
    enqueueSnackBar,
    updateSnackBarByDedupeKey,
    closeSnackBarByDedupeKey,
    refreshDataFunction,
    handleStopQueue,
  ]);

  return { queueStatus };
};
