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
import { SnackBarComponentInstanceContext } from '@/ui/feedback/snack-bar-manager/contexts/SnackBarComponentInstanceContext';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import {
  snackBarInternalComponentState,
  type SnackBarOptions,
} from '@/ui/feedback/snack-bar-manager/states/snackBarInternalComponentState';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useStore } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

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

export const useNaukriQueueStatus = () => {
  const {
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    enqueueErrorSnackBar,
  } = useSnackBar();
  const componentInstanceId = useAvailableComponentInstanceIdOrThrow(
    SnackBarComponentInstanceContext,
  );
  const store = useStore();
  const [queueStatus, setQueueStatus] = useAtomState(naukriQueueStatusState);
  const refreshDataFunction = useAtomStateValue(dataTableRefreshFunctionState);

  const activeSnackBarShownRef = useRef(false);
  const lastTerminalQueueIdRef = useRef<string | null>(null);

  const updateSnackBarByDedupeKey = useCallback(
    (dedupeKey: string, updates: Partial<SnackBarOptions>) => {
      store.set(
        snackBarInternalComponentState.atomFamily({
          instanceId: componentInstanceId,
        }),
        (previous) => ({
          ...previous,
          queue: previous.queue.map((snackBar) =>
            snackBar.dedupeKey === dedupeKey
              ? { ...snackBar, ...updates }
              : snackBar,
          ),
        }),
      );
    },
    [componentInstanceId, store],
  );

  const closeSnackBarByDedupeKey = useCallback(
    (dedupeKey: string) => {
      store.set(
        snackBarInternalComponentState.atomFamily({
          instanceId: componentInstanceId,
        }),
        (previous) => ({
          ...previous,
          queue: previous.queue.filter(
            (snackBar) => snackBar.dedupeKey !== dedupeKey,
          ),
        }),
      );
    },
    [componentInstanceId, store],
  );

  const handleStopQueue = useCallback(
    (queueId: string) => {
      stopNaukriQueueFromPage(queueId)
        .then((snapshot) => {
          if (snapshot) {
            setQueueStatus(snapshot);
          }
        })
        .catch((error) => {
          enqueueErrorSnackBar({
            message:
              error instanceof Error
                ? error.message
                : 'Failed to stop Naukri queue',
            options: { duration: 4000 },
          });
        });
    },
    [enqueueErrorSnackBar, setQueueStatus],
  );

  useEffect(() => {
    const unsubscribe = subscribeToNaukriQueueUpdates((snapshot) => {
      setQueueStatus(snapshot);
    });

    return unsubscribe;
  }, [setQueueStatus]);

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

  useEffect(() => {
    if (!queueStatus) {
      return;
    }

    const isTerminal = isTerminalNaukriQueueState(queueStatus.state);

    if (!isTerminal) {
      const snackBarOptions = {
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
        enqueueInfoSnackBar({
          message: 'Saving Naukri profiles',
          options: snackBarOptions,
        });
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
      const message =
        queueStatus.failedCount > 0
          ? `Saved ${queueStatus.completedCount}/${queueStatus.totalCount} Naukri profile(s), ${queueStatus.failedCount} failed`
          : `Saved ${queueStatus.completedCount}/${queueStatus.totalCount} Naukri profile(s)`;

      if (queueStatus.failedCount > 0) {
        enqueueWarningSnackBar({ message, options: { duration: 5000 } });
      } else {
        enqueueSuccessSnackBar({ message, options: { duration: 5000 } });
      }
    } else if (queueStatus.state === 'stopped') {
      enqueueWarningSnackBar({
        message: `Stopped Naukri queue after ${processed}/${queueStatus.totalCount} profile(s)`,
        options: { duration: 5000 },
      });
    } else if (queueStatus.state === 'failed') {
      enqueueErrorSnackBar({
        message: queueStatus.error ?? 'Naukri queue failed',
        options: { duration: 6000 },
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
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    enqueueErrorSnackBar,
    updateSnackBarByDedupeKey,
    closeSnackBarByDedupeKey,
    refreshDataFunction,
    handleStopQueue,
  ]);

  return { queueStatus };
};
