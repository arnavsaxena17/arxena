import styled from '@emotion/styled';
import { v4 as uid } from 'uuid';
import { useRecoilState } from 'recoil';
import { activeEnrichmentState, enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import axios from 'axios';

import { Button } from '@/ui/input/button/components/Button';

import DynamicModelCreator from './FormCreatorRightSide';

const StyledAllContainer = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 44px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (2 / 3));
  min-width: 264px;
  flex-shrink: 1;
`;

const StyledFormElement = styled.form`
  display: flex;
  gap: 44px;
  flex-grow: 1;
  flex-direction: column;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding: 0;
  margin: 0px;
  list-style-type: none;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

const StyledArxEnrichNameContainer = styled.div`
  display: flex;
`;

const StyledButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: min-content;
  gap: 8px;
`;

const StyledInput = styled.input`
  align-items: flex-start;
  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
    font-size: ${({ theme }) => theme.font.size.lg};
    font-weight: ${({ theme }) => theme.font.weight.medium};
    font-family: ${({ theme }) => theme.font.family};
  }
  &:focus {
    outline: none;
  }
  display: flex;
  flex-grow: 1;
  border: none;
  height: auto;
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

export const ArxEnrichModalCloseButton = ({ closeModal }: { closeModal: () => void }) => {
  return <Button variant="secondary" accent="danger" size="small" onClick={closeModal} justify="center" title="Close" type="submit" />;
};

export const ArxEnrichCreateButton = ({ onClick }: { onClick?: (event: React.FormEvent<HTMLFormElement>) => void }) => {
  return <Button 
    variant="primary" 
    accent="blue" 
    size="small" 
    justify="center" 
    title={'Create Enrichment'} 
    type="submit"  // Changed to type="submit" to trigger form submission
  />;
};

interface ArxEnrichNameProps {
  closeModal: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  index: number; // Add this
}

export const ArxEnrichName: React.FC<ArxEnrichNameProps> = ({
  closeModal,
  // modelName,
  // setModelName,
  onSubmit,
  index,
}) => {
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);

  const handleModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newModelName = e.target.value;
    setEnrichments(prev => {
      const newEnrichments = prev.map((enrichment, idx) => {
        if (idx === index) {
          return {
            ...enrichment,
            modelName: newModelName,
          };
        }
        return enrichment;
      });
      return newEnrichments;
    });
  };

  return (
    <StyledArxEnrichNameContainer>
      <StyledInput type="text" placeholder="Model Name..." name="ModelName[]" value={enrichments[index]?.modelName || ''} onChange={handleModelNameChange} required />
      <StyledButtonsContainer>
        <ArxEnrichModalCloseButton closeModal={closeModal} />
        <ArxEnrichCreateButton onClick={onSubmit} />
      </StyledButtonsContainer>
    </StyledArxEnrichNameContainer>
  );
};

interface ArxEnrichRightSideContainerProps {
  closeModal: () => void;
  objectNameSingular: string;
  objectRecordId: string;
}

export const ArxEnrichRightSideContainer: React.FC<ArxEnrichRightSideContainerProps> = ({ 
  closeModal, 
  objectNameSingular, 
  objectRecordId 
}) => {
  const [activeEnrichment, setActiveEnrichment] = useRecoilState(activeEnrichmentState);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      console.log("Enrichments:", enrichments);
      const response = await axios.post('/api/create-enrichments', {
        enrichments,
        objectNameSingular,
        objectRecordId,
      });

      if (response.status === 200) {
        console.log('Enrichments created successfully:', response.data);
        closeModal();
      } else {
        console.error('Failed to create enrichments:', response.status);
      }
    } catch (error) {
      console.error('Error creating enrichments:', error);
    }
  };

  return (
    <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`}>
      <StyledFormElement onSubmit={handleSubmit} id="NewArxEnrichForm">
        <ArxEnrichName
          closeModal={closeModal}
          onSubmit={handleSubmit}
          index={activeEnrichment || 0} // Use activeEnrichment and provide a fallback of 0
        />
        <StyledQuestionsContainer type="1">{activeEnrichment !== null && activeEnrichment < enrichments.length && <DynamicModelCreator objectNameSingular={objectNameSingular} index={activeEnrichment} />}</StyledQuestionsContainer>
      </StyledFormElement>
    </StyledAllContainer>
  );
};