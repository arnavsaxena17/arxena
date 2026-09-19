import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxOutreachSelectionCommand } from '@/command-menu-item/engine-command/record/arx/hooks/useArxOutreachSelectionCommand';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

export const ArxStopOutreachCommand = () => {
  const { execute } = useArxOutreachSelectionCommand({
    endpoint: '/outreach-command/candidates/stop-outreach',
    failureMessage: 'Stop outreach failed',
  });
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const handleExecute = useCallback(async () => {
    try {
      const response = await execute();
      const stopped = response.stoppedCandidates ?? 0;

      enqueueSuccessSnackBar({
        message:
          stopped === 1
            ? 'Stopped outreach for 1 prospect'
            : `Stopped outreach for ${stopped} prospects`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Stop outreach failed',
      });
      throw error;
    }
  }, [enqueueErrorSnackBar, enqueueSuccessSnackBar, execute]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
