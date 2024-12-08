import { useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { useRecoilState, useResetRecoilState } from 'recoil';
import { FIND_MANY_AI_MODELS } from '@/ai-interview/interview-creation/queries/findManyAIModels';

import { ArxEnrichLeftSideContainer } from '@/arx-enrich/left-side/ArxEnrichLeftSideContainer';
import { ArxEnrichRightSideContainer } from '@/arx-enrich/right-side/ArxEnrichRightSideContainer';
import { isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';
const StyledModalContainer = styled.div`
  background-color: transparent;
  top: 0px;
  left: 0px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 100vh;
  width: 100vw;
  z-index: 1000;
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
`;

export const ArxEnrichmentModal = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  
  const closeModal = () => {
    setIsArxEnrichModalOpen(false);
  };

  const { loading, error, data } = useQuery(FIND_MANY_AI_MODELS);

  if (loading) {
    return (
      <StyledModalContainer onClick={closeModal}>
        <StyledAdjuster>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <div>Loading...</div>
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    );
  }

  if (error != null) {
    return <div>Error: {error.message}</div>;
  }

  if (!isArxEnrichModalOpen) {
    return null;
  }

  return (
    <StyledModalContainer onClick={closeModal}>
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
  );
};