import { SearchParametersResponse } from '@/search-plan/types/search-plan.types';
import styled from '@emotion/styled';
import React from 'react';
import { Button, IconRefresh, IconSettings } from 'twenty-ui';

const StyledMessageContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledTitle = styled.h3`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledContent = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  line-height: 1.6;
`;

const StyledVariationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledVariationCard = styled.div<{ isSelected?: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme, isSelected }) => 
    isSelected ? theme.color.blue80 : theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isSelected }) => 
    isSelected ? theme.color.blue10 : theme.background.primary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue60};
    background-color: ${({ theme }) => theme.color.blue10};
  }
`;

const StyledVariationHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledVariationName = styled.h4`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledVariationType = styled.span<{ type: 'broad' | 'narrow' | 'targeted' }>`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ type, theme }) => {
    switch (type) {
      case 'broad': return theme.color.green10;
      case 'narrow': return theme.color.orange10;
      case 'targeted': return theme.color.blue10;
      default: return theme.background.secondary;
    }
  }};
  color: ${({ type, theme }) => {
    switch (type) {
      case 'broad': return theme.color.green80;
      case 'narrow': return theme.color.orange80;
      case 'targeted': return theme.color.blue80;
      default: return theme.font.color.primary;
    }
  }};
`;

const StyledVariationDescription = styled.p`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledVariationReasoning = styled.p`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-style: italic;
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const StyledComplexityBadge = styled.div<{ complexity: 'simple' | 'moderate' | 'complex' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ complexity, theme }) => {
    switch (complexity) {
      case 'simple': return theme.color.green10;
      case 'moderate': return theme.color.orange10;
      case 'complex': return theme.color.red10;
      default: return theme.background.secondary;
    }
  }};
  color: ${({ complexity, theme }) => {
    switch (complexity) {
      case 'simple': return theme.color.green80;
      case 'moderate': return theme.color.orange80;
      case 'complex': return theme.color.red80;
      default: return theme.font.color.primary;
    }
  }};
`;

type SearchParametersMessageProps = {
  searchParameters: SearchParametersResponse;
  selectedVariationId?: string;
  onVariationSelect?: (variationId: string) => void;
  onGenerateEnrichments?: () => void;
};

export const SearchParametersMessage: React.FC<SearchParametersMessageProps> = ({
  searchParameters,
  selectedVariationId,
  onVariationSelect,
  onGenerateEnrichments,
}) => {
  return (
    <StyledMessageContainer>
      <StyledHeader>
        <IconSettings size={20} />
        <StyledTitle>Search Strategy Generated</StyledTitle>
        <StyledComplexityBadge complexity={searchParameters.complexity}>
          {searchParameters.complexity.toUpperCase()}
        </StyledComplexityBadge>
      </StyledHeader>

      <StyledContent>
        <p><strong>Overall Strategy:</strong> {searchParameters.overallStrategy}</p>
        <p><strong>Complexity Analysis:</strong> {searchParameters.reasoning}</p>
      </StyledContent>

      <StyledVariationsList>
        {searchParameters.variations.map((variation) => (
          <StyledVariationCard
            key={variation.id}
            isSelected={selectedVariationId === variation.id}
            onClick={() => onVariationSelect?.(variation.id)}
          >
            <StyledVariationHeader>
              <StyledVariationName>{variation.name}</StyledVariationName>
              <StyledVariationType type={variation.type}>
                {variation.type.toUpperCase()}
              </StyledVariationType>
            </StyledVariationHeader>
            
            <StyledVariationDescription>
              {variation.description}
            </StyledVariationDescription>
            
            <StyledVariationReasoning>
              <strong>Expected Results:</strong> {variation.expectedResultSize} | 
              <strong> Reasoning:</strong> {variation.reasoning}
            </StyledVariationReasoning>
          </StyledVariationCard>
        ))}
      </StyledVariationsList>

      <StyledActionButtons>
        <Button
          variant="primary"
          onClick={onGenerateEnrichments}
          Icon={IconRefresh}
        >
          Generate Enrichments
        </Button>
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
