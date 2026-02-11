import styled from '@emotion/styled';
import { useEffect } from 'react';
import { useRecoilState } from 'recoil';

import { useFetchCandidateFields } from '@/arx-ai-filtering/hooks/useFetchCandidateFields';
import { ArxEnrichLeftSideContainer } from '@/arx-ai-filtering/left-side/ArxEnrichLeftSideContainer';
import { ArxEnrichRightSideContainer } from '@/arx-ai-filtering/right-side/ArxEnrichRightSideContainer';
import { currentJobIdState, isArxEnrichModalMinimizedState, isArxEnrichModalOpenState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { usePreviousHotkeyScope } from '@/ui/utilities/hotkey/hooks/usePreviousHotkeyScope';
import { AppHotkeyScope } from '@/ui/utilities/hotkey/types/AppHotkeyScope';
import { useAiFilteringProgress } from '../websocket-context/useAiFilteringProgress';

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
  z-index: 500;
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
  z-index: 500;
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
  z-index: 499; /* Just below your modal container */
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

export interface Enrichment {
  modelName: string;
  prompt: string;
  filterDescription: string;

  fields: Array<{
    id: number;
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  selectedModel: string;
  selectedMetadataFields: string[];
}

const StyledModal = styled.div`
  background-color: ${({ theme }) => theme.background.tertiary};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 501;
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



export const ArxEnrichmentModal = ({
  objectNameSingular,
  objectRecordId,
  onRefresh,
}: {
  objectNameSingular: string;
  objectRecordId: string;
  onRefresh?: () => void;
}) => {
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const [isMinimized, setIsMinimized] = useRecoilState(isArxEnrichModalMinimizedState);
  const [currentJobId] = useRecoilState(currentJobIdState);
  const { candidateFields, isLoadingFields, apiError, fetchCandidateFields } = useFetchCandidateFields();
  
  // Initialize SSE connection at modal level to ensure it persists
  const { aiFilteringProgress, isConnected, error: sseError, reconnect } = useAiFilteringProgress();
  
  const {
    setHotkeyScopeAndMemorizePreviousScope,
    goBackToPreviousHotkeyScope,
  } = usePreviousHotkeyScope();

  const closeModal = () => {
    setIsArxEnrichModalOpen(false);
    setIsMinimized(false);
    goBackToPreviousHotkeyScope();
    // Call refresh when modal is closed
    onRefresh?.();
  };

  useEffect(() => {
    if (isArxEnrichModalOpen) {
      setHotkeyScopeAndMemorizePreviousScope(AppHotkeyScope.App, {
        commandMenu: false,
        goto: false,
        keyboardShortcutMenu: false,
      });
      if (currentJobId) {
        fetchCandidateFields(currentJobId);
      }
    }
  }, [isArxEnrichModalOpen, setHotkeyScopeAndMemorizePreviousScope, fetchCandidateFields, currentJobId]);

  // Debug SSE connection at modal level
  useEffect(() => {
    console.log('🔗 [ArxEnrichmentModal] SSE Connection Status:', {
      isConnected,
      sseError,
      hasProgress: !!aiFilteringProgress,
      modalOpen: isArxEnrichModalOpen
    });
  }, [isConnected, sseError, aiFilteringProgress, isArxEnrichModalOpen]);

  // Track modal mount/unmount
  useEffect(() => {
    console.log('🔗 [ArxEnrichmentModal] Modal mounted');
    return () => {
      console.log('🔗 [ArxEnrichmentModal] Modal unmounting');
    };
  }, []);

  if (!isArxEnrichModalOpen) {
    return null;
  }

  // If minimized, render the minimized version at the bottom
  if (isMinimized) {
    return (
      <StyledMinimizedModalContainer>
        <ArxEnrichRightSideContainer
          closeModal={closeModal}
          objectNameSingular={objectNameSingular}
          objectRecordId={objectRecordId}
          candidateFields={candidateFields}
          isLoadingFields={isLoadingFields}
          apiError={apiError}
          aiFilteringProgress={aiFilteringProgress}
          isConnected={isConnected}
          sseError={sseError}
          reconnect={reconnect}
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
            <ArxEnrichLeftSideContainer />
            <ArxEnrichRightSideContainer
              closeModal={closeModal}
              objectNameSingular={objectNameSingular}
              objectRecordId={objectRecordId}
              candidateFields={candidateFields}
              isLoadingFields={isLoadingFields}
              apiError={apiError}
              aiFilteringProgress={aiFilteringProgress}
              isConnected={isConnected}
              sseError={sseError}
              reconnect={reconnect}
              onRefresh={onRefresh}
            />
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    </>
  );
};