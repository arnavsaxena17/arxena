import { useRecoilState } from 'recoil';

import { isVideoInterviewModalOpenState } from '@/video-interview/interview-creation/states/videoInterviewModalState';

export const useInterviewCreationModal = () => {
  const [isVideoInterviewModalOpen, setIsVideoInterviewModalOpen] = useRecoilState(
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
