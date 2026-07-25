import { Button } from 'twenty-ui';
import { IconCheck, IconFilter } from 'twenty-ui/icon';
import { CandidateSearchFilter } from '@/candidate-search/types/candidate-search.types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import React from 'react';
import type { FiltersResponse } from 'twenty-shared/types';

const StyledMessageContainer = styled.div`
  padding: ${themeCssVariables.spacing[3]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.md};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.h3`
  margin: 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
`;

const StyledContent = styled.div`
  margin-bottom: ${themeCssVariables.spacing[3]};
  line-height: 1.6;
`;

const StyledStrategyCard = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledStrategyHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledStrategyName = styled.h4`
  margin: 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledStrategyPriority = styled.span<{ priority: 'quality' | 'quantity' | 'balanced' }>`
  padding: ${themeCssVariables.spacing['0.5']} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  background-color: ${({ priority }) => {
    switch (priority) {
      case 'quality': return themeCssVariables.color.green10;
      case 'quantity': return themeCssVariables.color.blue10;
      case 'balanced': return themeCssVariables.color.orange10;
      default: return themeCssVariables.background.secondary;
    }
  }};
  color: ${({ priority }) => {
    switch (priority) {
      case 'quality': return themeCssVariables.color.green8;
      case 'quantity': return themeCssVariables.color.blue8;
      case 'balanced': return themeCssVariables.color.orange8;
      default: return themeCssVariables.font.color.primary;
    }
  }};
`;

const StyledStrategyDescription = styled.p`
  margin: ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledStrategyDetails = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  margin: ${themeCssVariables.spacing[1]} 0;
`;

const StyledDetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing['0.5']};
`;

const StyledDetailLabel = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledDetailValue = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledFiltersSection = styled.div`
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledFiltersHeader = styled.h5`
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledFiltersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFilterItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]};
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledFilterColumn = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledFilterCondition = styled.span`
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledFilterValue = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledReasoning = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledReasoningTitle = styled.h5`
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledReasoningText = styled.p`
  margin: 0;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
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
         title="Apply Filters" />
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
