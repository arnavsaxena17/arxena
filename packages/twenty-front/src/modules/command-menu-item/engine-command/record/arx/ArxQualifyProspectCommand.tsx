import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxQualifyProspect } from '@/command-menu-item/engine-command/record/arx/hooks/useArxQualifyProspect';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

export const ArxQualifyProspectCommand = () => {
  const { qualifyProspect } = useArxQualifyProspect();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const handleExecute = useCallback(async () => {
    try {
      const response = await qualifyProspect();
      const successCount =
        response.results?.filter((result) => result.success).length ?? 0;

      enqueueSuccessSnackBar({
        message:
          successCount === 1
            ? 'Qualified prospect and stamped enrichment on candidate'
            : `Qualified ${successCount} prospects and stamped enrichment`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Qualify prospect failed',
      });
      throw error;
    }
  }, [enqueueErrorSnackBar, enqueueSuccessSnackBar, qualifyProspect]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
