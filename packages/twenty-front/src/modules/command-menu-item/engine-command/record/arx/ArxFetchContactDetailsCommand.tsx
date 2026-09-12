import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxFetchContactDetails } from '@/command-menu-item/engine-command/record/arx/hooks/useArxFetchContactDetails';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

const useFetchContactCommandExecute = ({
  wantEmail,
  wantPhone,
  progressNeedle,
}: {
  wantEmail: boolean;
  wantPhone: boolean;
  progressNeedle: string;
}) => {
  const { fetchContactDetails } = useArxFetchContactDetails({
    wantEmail,
    wantPhone,
  });
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueInfoSnackBar } =
    useSnackBar();

  return useCallback(async () => {
    await fetchContactDetails((message, isError) => {
      if (isError) {
        enqueueErrorSnackBar({ message });
        return;
      }

      if (message.includes(progressNeedle)) {
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
    progressNeedle,
  ]);
};

export const ArxFetchContactDetailsCommand = () => {
  const handleExecute = useFetchContactCommandExecute({
    wantEmail: true,
    wantPhone: true,
    progressNeedle: 'Fetching contacts',
  });

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};

export const ArxFetchEmailCommand = () => {
  const handleExecute = useFetchContactCommandExecute({
    wantEmail: true,
    wantPhone: false,
    progressNeedle: 'Fetching emails',
  });

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};

export const ArxFetchPhoneCommand = () => {
  const handleExecute = useFetchContactCommandExecute({
    wantEmail: false,
    wantPhone: true,
    progressNeedle: 'Fetching phones',
  });

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
