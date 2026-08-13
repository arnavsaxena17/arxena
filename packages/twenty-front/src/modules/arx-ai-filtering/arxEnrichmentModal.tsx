import { useFetchOtherFieldKeys } from '@/arx-ai-filtering/hooks/useFetchOtherFieldKeys';
import { ArxEnrichLeftSideContainer } from '@/arx-ai-filtering/left-side/ArxEnrichLeftSideContainer';
import { ArxEnrichRightSideContainer } from '@/arx-ai-filtering/right-side/ArxEnrichRightSideContainer';
import {
  currentProjectIdState,
  isArxEnrichModalMinimizedState,
  isArxEnrichModalOpenState,
} from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { styled } from '@linaria/react';
import { useEffect } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useAiFilteringProgress } from '../websocket-context/useAiFilteringProgress';

const ARX_ENRICHMENT_MODAL_FOCUS_ID = 'arx-enrichment-modal';

const StyledModalContainer = styled.div`
  align-items: center;
  background-color: solid;
  display: flex;
  flex-direction: row;
  height: 80vh;
  justify-content: center;
  left: 10vw;
  pointer-events: none;
  position: fixed;
  top: 10vh;
  width: 80vw;
  z-index: 500;
`;

const StyledMinimizedModalContainer = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  bottom: 0;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  height: 60px;
  left: 0;
  padding: 0 20px;
  position: fixed;
  right: 0;
  transition: transform 0.3s ease;
  z-index: 500;
`;

const StyledModalBackdrop = styled.div`
  background-color: rgba(0, 0, 0, 0.5);
  bottom: 0;
  left: 0;
  pointer-events: all;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 499;
`;

const StyledAdjuster = styled.div`
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  padding: 0 120px;
  width: 100%;
`;

export type Enrichment = {
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
};

const StyledModal = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: 16px;
  box-shadow: ${themeCssVariables.boxShadow.superHeavy};
  box-sizing: border-box;
  display: flex;
  flex-basis: 900px;
  flex-direction: row;
  height: 100%;
  max-height: 680px;
  overflow: hidden;
  pointer-events: auto;
  position: relative;
  scrollbar-color: ${themeCssVariables.background.quaternary}
    ${themeCssVariables.background.tertiary};
  scrollbar-width: thin;

  & * {
    pointer-events: auto;
  }

  ::-webkit-scrollbar {
    height: 8px;
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${themeCssVariables.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${themeCssVariables.background.quaternary};
    border-radius: 4px;

    &:hover {
      background: ${themeCssVariables.background.noisy};
    }
  }

  user-select: none;
  z-index: 501;
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
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useAtomState(
    isArxEnrichModalOpenState,
  );
  const [isArxEnrichModalMinimized, setIsArxEnrichModalMinimized] = useAtomState(
    isArxEnrichModalMinimizedState,
  );
  const [currentProjectId] = useAtomState(currentProjectIdState);
  const { otherFieldKeys, isLoadingFields, apiError, fetchOtherFieldKeys } =
    useFetchOtherFieldKeys();

  const { aiFilteringProgress, isConnected, error: sseError, reconnect } =
    useAiFilteringProgress();

  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

  const closeModal = () => {
    setIsArxEnrichModalOpen(false);
    setIsArxEnrichModalMinimized(false);
    removeFocusItemFromFocusStackById({
      focusId: ARX_ENRICHMENT_MODAL_FOCUS_ID,
    });
    onRefresh?.();
  };

  useEffect(() => {
    if (isArxEnrichModalOpen) {
      pushFocusItemToFocusStack({
        focusId: ARX_ENRICHMENT_MODAL_FOCUS_ID,
        component: {
          type: FocusComponentType.MODAL,
          instanceId: ARX_ENRICHMENT_MODAL_FOCUS_ID,
        },
        globalHotkeysConfig: {
          enableGlobalHotkeysWithModifiers: false,
          enableGlobalHotkeysConflictingWithKeyboard: false,
        },
      });
      if (currentProjectId) {
        fetchOtherFieldKeys(currentProjectId);
      }
    }
  }, [
    isArxEnrichModalOpen,
    pushFocusItemToFocusStack,
    fetchOtherFieldKeys,
    currentProjectId,
  ]);

  useEffect(() => {
    console.log('🔗 [ArxEnrichmentModal] SSE Connection Status:', {
      isConnected,
      sseError,
      hasProgress: !!aiFilteringProgress,
      modalOpen: isArxEnrichModalOpen,
    });
  }, [isConnected, sseError, aiFilteringProgress, isArxEnrichModalOpen]);

  useEffect(() => {
    console.log('🔗 [ArxEnrichmentModal] Modal mounted');
    return () => {
      console.log('🔗 [ArxEnrichmentModal] Modal unmounting');
    };
  }, []);

  if (!isArxEnrichModalOpen) {
    return null;
  }

  if (isMinimized) {
    return (
      <StyledMinimizedModalContainer>
        <ArxEnrichRightSideContainer
          closeModal={closeModal}
          objectNameSingular={objectNameSingular}
          objectRecordId={objectRecordId}
          otherFieldKeys={otherFieldKeys}
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

  return (
    <>
      <StyledModalBackdrop onClick={closeModal} />
      <StyledModalContainer>
        <StyledAdjuster>
          <StyledModal onClick={(event) => event.stopPropagation()}>
            <ArxEnrichLeftSideContainer />
            <ArxEnrichRightSideContainer
              closeModal={closeModal}
              objectNameSingular={objectNameSingular}
              objectRecordId={objectRecordId}
              otherFieldKeys={otherFieldKeys}
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
