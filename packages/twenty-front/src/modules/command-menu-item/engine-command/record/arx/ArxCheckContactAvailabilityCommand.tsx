import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCheckContactAvailability } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCheckContactAvailability';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

export const ArxCheckContactAvailabilityCommand = () => {
  const { checkAvailability } = useArxCheckContactAvailability();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueInfoSnackBar } =
    useSnackBar();

  const handleExecute = useCallback(async () => {
    await checkAvailability((message, isError) => {
      if (isError) {
        enqueueErrorSnackBar({ message });
        return;
      }

      if (message.includes('Checking availability')) {
        enqueueInfoSnackBar({ message });
        return;
      }

      enqueueSuccessSnackBar({ message });
    });
  }, [
    checkAvailability,
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
  ]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
