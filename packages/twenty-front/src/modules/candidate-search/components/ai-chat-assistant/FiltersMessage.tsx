import { Button } from 'twenty-ui';
import { IconCheck, IconFilter } from 'twenty-ui/icons';
import { CandidateSearchFilter } from '@/candidate-search/types/candidate-search.types';
import styled from '@emotion/styled';
import React from 'react';
import { FiltersResponse } from 'twenty-shared';

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

const StyledStrategyCard = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledStrategyHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledStrategyName = styled.h4`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledStrategyPriority = styled.span<{ priority: 'quality' | 'quantity' | 'balanced' }>`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ priority, theme }) => {
    switch (priority) {
      case 'quality': return theme.color.green10;
      case 'quantity': return theme.color.blue10;
      case 'balanced': return theme.color.orange10;
      default: return theme.background.secondary;
    }
  }};
  color: ${({ priority, theme }) => {
    switch (priority) {
      case 'quality': return theme.color.green80;
      case 'quantity': return theme.color.blue80;
      case 'balanced': return theme.color.orange80;
      default: return theme.font.color.primary;
    }
  }};
`;

const StyledStrategyDescription = styled.p`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledStrategyDetails = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledDetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledDetailLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledDetailValue = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFiltersSection = styled.div`
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledFiltersHeader = styled.h5`
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledFiltersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFilterItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledFilterColumn = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFilterCondition = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledFilterValue = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const StyledReasoning = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledReasoningTitle = styled.h5`
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledReasoningText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
`;

type FiltersMessageProps = {
  filters: FiltersResponse;
  onApplyFilters?: () => void;
};

export const FiltersMessage: React.FC<FiltersMessageProps> = ({
  filters,
  onApplyFilters,
}) => {
  return (
    <StyledMessageContainer>
      <StyledHeader>
        <IconFilter size={20} />
        <StyledTitle>Filter Strategy Generated</StyledTitle>
      </StyledHeader>

      <StyledContent>
        <StyledStrategyCard>
          <StyledStrategyHeader>
            <StyledStrategyName>{filters.filterStrategy.name}</StyledStrategyName>
            <StyledStrategyPriority priority={filters.filterStrategy.priority}>
              {filters.filterStrategy.priority.toUpperCase()}
            </StyledStrategyPriority>
          </StyledStrategyHeader>
          
          <StyledStrategyDescription>
            {filters.filterStrategy.description}
          </StyledStrategyDescription>
          
          <StyledStrategyDetails>
            <StyledDetailItem>
              <StyledDetailLabel>Target Shortlist</StyledDetailLabel>
              <StyledDetailValue>{filters.filterStrategy.targetShortlistSize} candidates</StyledDetailValue>
            </StyledDetailItem>
            <StyledDetailItem>
              <StyledDetailLabel>Priority</StyledDetailLabel>
              <StyledDetailValue>{filters.filterStrategy.priority}</StyledDetailValue>
            </StyledDetailItem>
          </StyledStrategyDetails>
        </StyledStrategyCard>

        <StyledFiltersSection>
          <StyledFiltersHeader>
            Handsontable Filters ({filters.handsontableFilters.length})
          </StyledFiltersHeader>
          <StyledFiltersList>
            {filters.handsontableFilters.slice(0, 5).map((filter, index) => (
              <StyledFilterItem key={index}>
                <StyledFilterColumn>{filter.column}</StyledFilterColumn>
                <StyledFilterCondition>{filter.condition}</StyledFilterCondition>
                <StyledFilterValue>
                  {filter.value !== undefined ? String(filter.value) : ''}
                  {filter.value2 !== undefined ? ` - ${filter.value2}` : ''}
                </StyledFilterValue>
              </StyledFilterItem>
            ))}
            {filters.handsontableFilters.length > 5 && (
              <StyledFilterItem>
                <StyledFilterColumn>... and {filters.handsontableFilters.length - 5} more filters</StyledFilterColumn>
              </StyledFilterItem>
            )}
          </StyledFiltersList>
        </StyledFiltersSection>

        <StyledFiltersSection>
          <StyledFiltersHeader>
            Candidate Search Filters ({filters.candidateSearchFilters.length})
          </StyledFiltersHeader>
          <StyledFiltersList>
            {filters.candidateSearchFilters.slice(0, 5).map((filter, index) => (
              <StyledFilterItem key={index}>
                <StyledFilterColumn>{(filter as CandidateSearchFilter).label}</StyledFilterColumn>
                <StyledFilterCondition>({(filter as CandidateSearchFilter).type})</StyledFilterCondition>
                <StyledFilterValue>
                  {((filter as CandidateSearchFilter).value !== undefined ? String((filter as CandidateSearchFilter).value) : '')}
                  {((filter as CandidateSearchFilter).min !== undefined && (filter as CandidateSearchFilter).max !== undefined ? `${(filter as CandidateSearchFilter).min} - ${(filter as CandidateSearchFilter).max}` : '')}
                </StyledFilterValue>
              </StyledFilterItem>
            ))}
            {filters.candidateSearchFilters.length > 5 && (
              <StyledFilterItem>
                <StyledFilterColumn>... and {filters.candidateSearchFilters.length - 5} more filters</StyledFilterColumn>
              </StyledFilterItem>
            )}
          </StyledFiltersList>
        </StyledFiltersSection>

        <StyledReasoning>
          <StyledReasoningTitle>Filter Strategy Reasoning</StyledReasoningTitle>
          <StyledReasoningText>{filters.reasoning}</StyledReasoningText>
        </StyledReasoning>

        {filters.metadata.hasDataDistribution && (
          <StyledReasoning>
            <StyledReasoningTitle>Data Distribution Analysis</StyledReasoningTitle>
            <StyledReasoningText>
              Filters were optimized based on actual data distribution from {filters.metadata.dataDistributionFields?.length || 0} fields.
            </StyledReasoningText>
          </StyledReasoning>
        )}
      </StyledContent>

      <StyledActionButtons>
        <Button
          variant="primary"
          onClick={onApplyFilters}
          Icon={IconCheck}
        >
          Apply Filters
        </Button>
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
