import styled from '@emotion/styled';
import { v4 as uid } from 'uuid';
import { useRecoilState } from 'recoil';
import { activeEnrichmentState, enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';

import { Button } from '@/ui/input/button/components/Button';
import DynamicModelCreator from './FormCreatorRightSide';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { ArxEnrichName } from './ArxEnrichName'; // Ensure this import is correct
import { useEffect, useState } from 'react';

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


export const ArxEnrichModalCloseButton = ({
  closeModal,
}: {
  closeModal: () => void;
}) => {
  return (
    <Button
      variant="secondary"
      accent="danger"
      size="small"
      onClick={closeModal}
      justify="center"
      title="Close"
      type="submit"
    />
  );
};



  export const ArxEnrichCreateButton = ({ onClick }: { onClick?: () => void }) => {
    return (
      <Button
        variant="primary"
        accent="blue"
        size="small"
        justify="center"
        title={'Create Enrichment'}
        onClick={onClick}
        type="submit"
      />
    );
  };
  
  
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

interface ArxEnrichRightSideContainerProps {
  closeModal: () => void;
  objectNameSingular: string;
  objectRecordId: string;
}


export const ArxEnrichRightSideContainer: React.FC<ArxEnrichRightSideContainerProps> = ({ 
  closeModal, 
  objectNameSingular, 
  objectRecordId,
}) => {
  const [activeEnrichment, setActiveEnrichment] = useRecoilState(activeEnrichmentState);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Get the current enrichment data
    const currentEnrichment = enrichments[activeEnrichment || 0];
    if (currentEnrichment) {
      console.log('Submitting enrichment:', currentEnrichment);
      // Here you can add API calls or other submission logic
      closeModal();
    }
  };

  return (
    <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`}>
      <StyledFormElement onSubmit={handleSubmit} id="NewArxEnrichForm">
      <ArxEnrichName 
          closeModal={closeModal}
          onSubmit={handleSubmit}
          index={activeEnrichment || 0}
        />
        <StyledQuestionsContainer type="1">
          {activeEnrichment !== null && activeEnrichment < enrichments.length && (
            <DynamicModelCreator 
              objectNameSingular={objectNameSingular} 
              index={activeEnrichment}
            />
          )}
        </StyledQuestionsContainer>
      </StyledFormElement>
    </StyledAllContainer>
  );
};
