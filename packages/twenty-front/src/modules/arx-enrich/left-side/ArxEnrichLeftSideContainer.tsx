import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';
import { enrichmentsState, activeEnrichmentState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { useEffect, useState } from 'react';
import {  IconTrash } from 'twenty-ui';
import { Enrichment } from '@/arx-enrich/arxEnrichmentModal';


const StyledContainer = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  gap: 32px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (1 / 3));
  max-width: 300px;
  min-width: 224px;
  flex-shrink: 1;
`;

const StyledModalNavElementContainer = styled.nav`
  display: flex;
  gap: 4px;
  padding: 6px 0 6px 0;
  flex-direction: column;
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
  flex-grow: 1;
  gap: 8px;
  padding: 0;
  margin: 0px;
  list-style-type: none;
  overflow-y: scroll;
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
        selectedMetadataFields: []
      };
      setEnrichments([initialEnrichment]);
      setActiveEnrichment(0);
    }
  }, []);

  const addEnrichment = () => {
    const newEnrichment: Enrichment = {
      modelName: '',
      fields: [],
      selectedMetadataFields: []
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
      <ModalNavElementContainer />
    </StyledContainer>
  );
};
