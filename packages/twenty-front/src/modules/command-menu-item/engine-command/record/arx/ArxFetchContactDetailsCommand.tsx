import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxFetchContactDetails } from '@/command-menu-item/engine-command/record/arx/hooks/useArxFetchContactDetails';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

export const ArxFetchContactDetailsCommand = () => {
  const { fetchContactDetails } = useArxFetchContactDetails();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueInfoSnackBar } =
    useSnackBar();

  const handleExecute = useCallback(async () => {
    await fetchContactDetails((message, isError) => {
      if (isError) {
        enqueueErrorSnackBar({ message });
        return;
      }

      if (message.includes('Fetching contacts')) {
        enqueueInfoSnackBar({ message });
        return;
      }

      enqueueSuccessSnackBar({ message });
    });
  }, [
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
    fetchContactDetails,
  ]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
