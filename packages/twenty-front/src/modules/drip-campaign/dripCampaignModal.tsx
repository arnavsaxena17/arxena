import styled from '@emotion/styled';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';

import { DripCampaignLeftSideContainer } from '@/drip-campaign/left-side/DripCampaignLeftSideContainer';
import { DripCampaignRightSideContainer } from '@/drip-campaign/right-side/DripCampaignRightSideContainer';
import {
    currentJobIdForDripState,
    isDripCampaignModalMinimizedState,
    isDripCampaignModalOpenState
} from '@/drip-campaign/states/dripCampaignModalOpenState';
import { usePreviousHotkeyScope } from '@/ui/utilities/hotkey/hooks/usePreviousHotkeyScope';
import { AppHotkeyScope } from '@/ui/utilities/hotkey/types/AppHotkeyScope';

const StyledModalContainer = styled.div`
  background-color: solid;
  top: 10vh;
  left: 10vw;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 80vh;
  width: 80vw;
  z-index: 2000;
  pointer-events: none; /* This ensures clicks pass through to the backdrop */
`;

const StyledMinimizedModalContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: ${({ theme }) => theme.background.tertiary};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  z-index: 2001;
  display: flex;
  align-items: center;
  padding: 0 20px;
  transition: transform 0.3s ease;
`;

const StyledModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
  z-index: 1999; /* Just below your modal container */
  pointer-events: all; /* Ensures clicks are captured by this element */
`;

const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 120px;
  justify-content: center;
  align-items: center;
`;

const StyledModal = styled.div`
  background-color: ${({ theme }) => theme.background.tertiary};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 2002;
  overflow: hidden;
  max-height: 680px;
  box-sizing: border-box;
  position: relative;  // Ensure this is present
  pointer-events: auto;
  user-select: none;  // Prevent text selection

    & * {
    pointer-events: auto;
  }

  /* Add custom scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.background.quaternary || '#888'};
    border-radius: 4px;
    
    &:hover {
      background: ${({ theme }) => theme.background.noisy || '#666'};
    }
  }

  /* For Firefox */
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.background.quaternary || '#888'} ${theme.background.tertiary}`};
`;

const ScrollableContent = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding-right: 8px; /* Compensate for scrollbar width */
`;

export const DripCampaignModal = ({
  objectNameSingular,
  objectRecordId,
  onRefresh,
}: {
  objectNameSingular: string;
  objectRecordId: string;
  onRefresh?: () => void;
}) => {
  const [isDripCampaignModalOpen, setIsDripCampaignModalOpen] = useRecoilState(isDripCampaignModalOpenState);
  const [isMinimized, setIsMinimized] = useRecoilState(isDripCampaignModalMinimizedState);
  const [currentJobId] = useRecoilState(currentJobIdForDripState);
  
  const {
    setHotkeyScopeAndMemorizePreviousScope,
    goBackToPreviousHotkeyScope,
  } = usePreviousHotkeyScope();

  const closeModal = () => {
    setIsDripCampaignModalOpen(false);
    setIsMinimized(false);
    goBackToPreviousHotkeyScope();
    // Call refresh when modal is closed
    onRefresh?.();
  };

  useEffect(() => {
    if (isDripCampaignModalOpen) {
      setHotkeyScopeAndMemorizePreviousScope(AppHotkeyScope.App, {
        commandMenu: false,
        goto: false,
        keyboardShortcutMenu: false,
      });
    }
  }, [isDripCampaignModalOpen, setHotkeyScopeAndMemorizePreviousScope]);

  // Track modal mount/unmount
  useEffect(() => {
    console.log('🔗 [DripCampaignModal] Modal mounted');
    return () => {
      console.log('🔗 [DripCampaignModal] Modal unmounting');
    };
  }, []);

  if (!isDripCampaignModalOpen) {
    return null;
  }

  // If minimized, render the minimized version at the bottom
  if (isMinimized) {
    return (
      <StyledMinimizedModalContainer>
        <DripCampaignRightSideContainer
          closeModal={closeModal}
          objectNameSingular={objectNameSingular}
          objectRecordId={objectRecordId}
          onRefresh={onRefresh}
        />
      </StyledMinimizedModalContainer>
    );
  }

  // Normal modal rendering
  return (
    <>
      <StyledModalBackdrop onClick={closeModal} />
      <StyledModalContainer>
        <StyledAdjuster>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <DripCampaignLeftSideContainer />
            <DripCampaignRightSideContainer
              closeModal={closeModal}
              objectNameSingular={objectNameSingular}
              objectRecordId={objectRecordId}
              onRefresh={onRefresh}
            />
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    </>
  );
};
