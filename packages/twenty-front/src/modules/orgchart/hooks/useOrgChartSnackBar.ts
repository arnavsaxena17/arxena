import { useCallback } from 'react';

import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { SnackBarComponentInstanceContext } from '@/ui/feedback/snack-bar-manager/contexts/SnackBarComponentInstanceContext';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import {
  snackBarInternalComponentState,
  type SnackBarOptions,
} from '@/ui/feedback/snack-bar-manager/states/snackBarInternalComponentState';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useStore } from 'jotai';

export const useOrgChartSnackBar = () => {
  const componentInstanceId = useAvailableComponentInstanceIdOrThrow(
    SnackBarComponentInstanceContext,
  );
  const store = useStore();
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();

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

  const enqueueSnackBar = useCallback(
    (
      message: string,
      options?: Omit<SnackBarOptions, 'message' | 'id' | 'variant'> & {
        variant?: SnackBarVariant;
      },
    ) => {
      const { variant = SnackBarVariant.Info, ...snackBarOptions } =
        options ?? {};

      switch (variant) {
        case SnackBarVariant.Success:
          enqueueSuccessSnackBar({ message, options: snackBarOptions });
          break;
        case SnackBarVariant.Error:
          enqueueErrorSnackBar({ message, options: snackBarOptions });
          break;
        case SnackBarVariant.Warning:
          enqueueWarningSnackBar({ message, options: snackBarOptions });
          break;
        default:
          enqueueInfoSnackBar({ message, options: snackBarOptions });
      }
    },
    [
      enqueueErrorSnackBar,
      enqueueInfoSnackBar,
      enqueueSuccessSnackBar,
      enqueueWarningSnackBar,
    ],
  );

  return {
    enqueueSnackBar,
    updateSnackBarByDedupeKey,
    closeSnackBarByDedupeKey,
  };
};
