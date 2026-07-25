import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

import { isVideoInterviewModalOpenState } from '@/video-interview/interview-creation/states/videoInterviewModalState';

export const useInterviewCreationModal = () => {
  const [isVideoInterviewModalOpen, setIsVideoInterviewModalOpen] = useAtomState(
    isVideoInterviewModalOpenState,
  );

  const openModal = () => {
    console.log("openModal");
    setIsVideoInterviewModalOpen(true);
  };

  return {
    isVideoInterviewModalOpen,
    openModal,
  };
};
