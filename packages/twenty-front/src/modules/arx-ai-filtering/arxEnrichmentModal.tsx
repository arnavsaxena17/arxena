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
  pointer-events: none;
`;

const StyledMinimizedModalContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: ${themeCssVariables.background.tertiary};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  box-shadow: ${themeCssVariables.boxShadow.strong};
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
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 499;
  pointer-events: all;
`;

const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 120px;
  justify-content: center;
  align-items: center;
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
  box-shadow: ${themeCssVariables.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 501;
  overflow: hidden;
  max-height: 680px;
  box-sizing: border-box;
  position: relative;
  pointer-events: auto;
  user-select: none;

  & * {
    pointer-events: auto;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
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

  scrollbar-width: thin;
  scrollbar-color: ${themeCssVariables.background.quaternary}
    ${themeCssVariables.background.tertiary};
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
  const [isMinimized, setIsMinimized] = useAtomState(
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
    setIsMinimized(false);
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
