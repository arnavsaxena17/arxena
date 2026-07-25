import { isArxEnrichModalOpenState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

export const useArxEnrichCreationModal = () => {
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useAtomState(
    isArxEnrichModalOpenState,
  );

  const openModal = () => {
    setIsArxEnrichModalOpen(true);
  };

  return {
    isArxEnrichModalOpen,
    openModal,
  };
};
