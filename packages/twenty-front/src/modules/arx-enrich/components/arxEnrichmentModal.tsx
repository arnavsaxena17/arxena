import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';

import { ArxEnrichLeftSideContainer } from '@/arx-enrich/left-side/ArxEnrichLeftSideContainer';
import { ArxEnrichRightSideContainer } from '@/arx-enrich/right-side/ArxEnrichRightSideContainer';
import { isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';

const StyledModalContainer = styled.div`
  background-color: solid;
  top: 20vh;
  left: 10vw;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 60vh;
  width: 80vw;
  z-index: 1000;
  pointer-events: none;
`;

const StyledModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => theme.background.overlayPrimary};
  z-index: 999;
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

export interface Enrichment {
  modelName: string;
  prompt: string;
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
  z-index: 1001;
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
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.background.quaternary};
    border-radius: 4px;

    &:hover {
      background: ${({ theme }) => theme.background.primary};
    }
  }

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.background.quaternary} ${theme.background.tertiary}`};
`;

const StyledScrollableContent = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding-right: 8px;
`;

export const ArxEnrichmentModal = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(
    isArxEnrichModalOpenState,
  );

  const closeModal = () => {
    setIsArxEnrichModalOpen(false);
  };

  if (!isArxEnrichModalOpen) {
    return null;
  }

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
            />
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    </>
  );
};
