import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxGenerateSampleLinkedinMessage } from '@/command-menu-item/engine-command/record/arx/hooks/useArxGenerateSampleLinkedinMessage';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';

export const ArxGenerateSampleLinkedinMessageCommand = () => {
  const { generateSampleLinkedinMessage } =
    useArxGenerateSampleLinkedinMessage();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const handleExecute = useCallback(async () => {
    try {
      const response = await generateSampleLinkedinMessage();
      const total = response.total ?? 0;

      enqueueSuccessSnackBar({
        message:
          total === 1
            ? 'Drafting sample LinkedIn message for 1 person'
            : `Drafting sample LinkedIn messages for ${total} people`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Generate sample LinkedIn message failed',
      });
      throw error;
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    generateSampleLinkedinMessage,
  ]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
