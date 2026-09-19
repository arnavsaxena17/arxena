import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxOutreachSelectionCommand } from '@/command-menu-item/engine-command/record/arx/hooks/useArxOutreachSelectionCommand';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

export const ArxStartOutreachCommand = () => {
  const { execute } = useArxOutreachSelectionCommand({
    endpoint: '/outreach-command/candidates/start-outreach',
    failureMessage: 'Start outreach failed',
  });
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const handleExecute = useCallback(async () => {
    try {
      const response = await execute();
      const started = response.startedCandidates ?? 0;

      enqueueSuccessSnackBar({
        message:
          started === 1
            ? 'Started outreach for 1 prospect'
            : `Started outreach for ${started} prospects`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Start outreach failed',
      });
      throw error;
    }
  }, [enqueueErrorSnackBar, enqueueSuccessSnackBar, execute]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
