import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';
import { enrichmentsState, activeEnrichmentState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { useEffect, useState } from 'react';
import {  IconTrash } from 'twenty-ui';
import { Enrichment } from '@/arx-enrich/arxEnrichmentModal';
import { SampleEnrichments } from './SampleEnrichments';



const StyledContainer = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  gap: 32px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (1 / 6));
  max-width: 300px;
  min-width: 224px;
  flex-shrink: 1;
  position: relative;
  pointer-events: auto;
`;


const ScrollableContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex: 1;
  overflow-y: auto;
  min-height: 0; // Important for flex containers
  
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

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.background.quaternary || '#888'} ${theme.background.tertiary}`};
`;


const StyledModalNavElementContainer = styled.nav`
  display: flex;
  gap: 4px;
  padding: 6px 0 6px 0;
  flex-direction: column;
  overflow: visible;
`;





const StyledIntroductionNavElement = styled.div`
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: 6px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  &.active {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  color: ${({ theme }) => theme.grayScale.gray50};
  border-radius: 4px;
  width: 200px;
  cursor: pointer;
`;

const StyledButton = styled.div`
  border: none;
  font-family: inherit;
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  cursor: pointer;
  background-color: none;
  margin-top: 16px;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0px;
  list-style-type: none;
  scroll-behavior: smooth;
`;



const StyledListItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  &::marker {
    display: none;
    font-family: inherit;
    color: ${({ theme }) => theme.font.color.light};
    font-size: ${({ theme }) => theme.font.size.md};
    font-weight: ${({ theme }) => theme.font.weight.regular};
  }
`;

export const ModalNavElementContainer = () => {
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [activeEnrichment, setActiveEnrichment] = useRecoilState(activeEnrichmentState);

  useEffect(() => {
    if (enrichments.length === 0) {
      const initialEnrichment: Enrichment = {
        modelName: '',
        fields: [],
        selectedMetadataFields: [],
        prompt: '', // Add this field
        selectedModel: '',  // Add this field
      };
      setEnrichments([initialEnrichment]);
      setActiveEnrichment(0);
    }
  }, []);

  const addEnrichment = () => {
    const newEnrichment: Enrichment = {
      modelName: '',
      prompt: '', // Add this field
      fields: [],
      selectedMetadataFields: [],
      selectedModel: '',
    };
    setEnrichments(prev => [...prev.map(e => ({...e})), newEnrichment]);
    setActiveEnrichment(prev => (prev !== null ? prev + 1 : 0));
  };

  const deleteEnrichment = (index: number) => {
    setEnrichments(prev => prev.filter((_, i) => i !== index));
    if (activeEnrichment === index) {
      setActiveEnrichment(null);
    } else if (activeEnrichment !== null && activeEnrichment > index) {
      setActiveEnrichment(activeEnrichment - 1);
    }
  };

  const handleEnrichmentClick = (index: number) => {
    setActiveEnrichment(index);
  };

  return (
    <StyledModalNavElementContainer>
      <StyledQuestionsContainer type="1">
        {enrichments.map((_, index) => (
          <StyledListItem key={index}>
            <StyledIntroductionNavElement
              className={activeEnrichment === index ? 'active' : ''}
              onClick={() => handleEnrichmentClick(index)}
            >
              Enrichment - {index + 1}
            </StyledIntroductionNavElement>
            <IconTrash
              size={16}
              stroke={1.5}
              style={{ cursor: 'pointer' }}
              onClick={() => deleteEnrichment(index)}
            />
          </StyledListItem>
        ))}
      </StyledQuestionsContainer>
      <StyledButton onClick={addEnrichment}>+ Add Enrichment</StyledButton>
    </StyledModalNavElementContainer>
  );
};

export const ArxEnrichLeftSideContainer = () => {
  return (
    <StyledContainer>
      <div>New ARX Enrich</div>
      <ScrollableContent>
        <ModalNavElementContainer />
        <SampleEnrichments />
      </ScrollableContent>
    </StyledContainer>
  );
};

