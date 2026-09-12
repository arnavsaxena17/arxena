import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxOutreachSelectionCommand } from '@/command-menu-item/engine-command/record/arx/hooks/useArxOutreachSelectionCommand';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

type ArxLinkedinSelectionFetchCommandProps = {
  endpoint: string;
  failureMessage: string;
  successMessageSingular: string;
  successMessagePlural: (count: number) => string;
};

export const ArxLinkedinSelectionFetchCommand = ({
  endpoint,
  failureMessage,
  successMessageSingular,
  successMessagePlural,
}: ArxLinkedinSelectionFetchCommandProps) => {
  const { execute } = useArxOutreachSelectionCommand({
    endpoint,
    failureMessage,
  });
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const handleExecute = useCallback(async () => {
    try {
      const response = await execute();
      const successCount =
        response.results?.filter((result) => result.success).length ?? 0;

      enqueueSuccessSnackBar({
        message:
          successCount === 1
            ? successMessageSingular
            : successMessagePlural(successCount),
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message: error instanceof Error ? error.message : failureMessage,
      });
      throw error;
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    execute,
    failureMessage,
    successMessagePlural,
    successMessageSingular,
  ]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};

export const ArxFetchLinkedinMessagesCommand = () => (
  <ArxLinkedinSelectionFetchCommand
    endpoint="/outreach-command/fetch-linkedin-messages-for-selection"
    failureMessage="Fetch LinkedIn messages failed"
    successMessageSingular="Fetched LinkedIn messages and saved chat turns"
    successMessagePlural={(count) =>
      `Fetched LinkedIn messages for ${count} candidates`
    }
  />
);

export const ArxFetchLinkedinPostsCommand = () => (
  <ArxLinkedinSelectionFetchCommand
    endpoint="/outreach-command/fetch-linkedin-posts-for-selection"
    failureMessage="Fetch LinkedIn posts failed"
    successMessageSingular="Fetched LinkedIn posts and saved on candidate"
    successMessagePlural={(count) =>
      `Fetched LinkedIn posts for ${count} candidates`
    }
  />
);

export const ArxFetchLinkedinProfileCommand = () => (
  <ArxLinkedinSelectionFetchCommand
    endpoint="/outreach-command/fetch-linkedin-profiles-for-selection"
    failureMessage="Fetch LinkedIn profile failed"
    successMessageSingular="Fetched LinkedIn profile and saved on candidate"
    successMessagePlural={(count) =>
      `Fetched LinkedIn profiles for ${count} candidates`
    }
  />
);
