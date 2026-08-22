import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { naukriQueueStatusState } from '@/candidate-table/states/naukriQueueStatusState';
import {
  getNaukriQueueStatusFromPage,
  isTerminalNaukriQueueState,
  type NaukriQueueSnapshot,
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
  const [naukriQueueStatus, setNaukriQueueStatus] = useAtomState(naukriQueueStatusState);
  const dataTableRefreshFunction = useAtomStateValue(dataTableRefreshFunctionState);

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
            setNaukriQueueStatus(snapshot);
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
    [enqueueErrorSnackBar, setNaukriQueueStatus],
  );

  useEffect(() => {
    const unsubscribe = subscribeToNaukriQueueUpdates((snapshot) => {
      setNaukriQueueStatus(snapshot);
    });

    return unsubscribe;
  }, [setNaukriQueueStatus]);

  useEffect(() => {
    let cancelled = false;

    getNaukriQueueStatusFromPage()
      .then((snapshot) => {
        if (!cancelled && snapshot) {
          setNaukriQueueStatus(snapshot);
        }
      })
      .catch(() => {
        /* extension not reachable; ignore */
      });

    return () => {
      cancelled = true;
    };
  }, [setNaukriQueueStatus]);

  useEffect(() => {
    if (!naukriQueueStatus) {
      return;
    }

    const isTerminal = isTerminalNaukriQueueState(naukriQueueStatus.state);

    if (!isTerminal) {
      const snackBarOptions = {
        showProgressBar: true,
        progress: getProgressPercentage(naukriQueueStatus),
        progressMessage: getProgressMessage(naukriQueueStatus),
        duration: PERSISTENT_SNACKBAR_DURATION_MS,
        dedupeKey: ACTIVE_SNACKBAR_DEDUPE_KEY,
        onCancel:
          naukriQueueStatus.state === 'stopping'
            ? undefined
            : () => handleStopQueue(naukriQueueStatus.queueId),
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

    if (lastTerminalQueueIdRef.current === naukriQueueStatus.queueId) {
      return;
    }
    lastTerminalQueueIdRef.current = naukriQueueStatus.queueId;

    const processed =
      naukriQueueStatus.completedCount + naukriQueueStatus.failedCount;

    if (naukriQueueStatus.state === 'completed') {
      const message =
        naukriQueueStatus.failedCount > 0
          ? `Saved ${naukriQueueStatus.completedCount}/${naukriQueueStatus.totalCount} Naukri profile(s), ${naukriQueueStatus.failedCount} failed`
          : `Saved ${naukriQueueStatus.completedCount}/${naukriQueueStatus.totalCount} Naukri profile(s)`;

      if (naukriQueueStatus.failedCount > 0) {
        enqueueWarningSnackBar({ message, options: { duration: 5000 } });
      } else {
        enqueueSuccessSnackBar({ message, options: { duration: 5000 } });
      }
    } else if (naukriQueueStatus.state === 'stopped') {
      enqueueWarningSnackBar({
        message: `Stopped Naukri queue after ${processed}/${naukriQueueStatus.totalCount} profile(s)`,
        options: { duration: 5000 },
      });
    } else if (naukriQueueStatus.state === 'failed') {
      enqueueErrorSnackBar({
        message: naukriQueueStatus.error ?? 'Naukri queue failed',
        options: { duration: 6000 },
      });
    }

    if (dataTableRefreshFunction) {
      dataTableRefreshFunction().catch((error) => {
        console.error(
          '[useNaukriQueueStatus] Failed to refresh table after queue finished:',
          error,
        );
      });
    }
  }, [
    naukriQueueStatus,
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    enqueueErrorSnackBar,
    updateSnackBarByDedupeKey,
    closeSnackBarByDedupeKey,
    dataTableRefreshFunction,
    handleStopQueue,
  ]);

  return { queueStatus: naukriQueueStatus };
};
