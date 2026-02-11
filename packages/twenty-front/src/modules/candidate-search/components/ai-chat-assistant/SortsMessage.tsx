import { SortsResponse } from '@/candidate-search/types/candidate-search.types';
import styled from '@emotion/styled';
import { IconCheck, IconSortAscending } from '@tabler/icons-react';
import React from 'react';
import { Button } from 'twenty-ui';

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

const StyledStrategyName = styled.h4`
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledStrategyDescription = styled.p`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledSortColumnsSection = styled.div`
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledSortColumnsHeader = styled.h5`
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledSortColumnsList = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing(3)};
`;

const StyledSortColumnItem = styled.li`
  padding: ${({ theme }) => theme.spacing(1.5)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledSortColumnName = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSortOrder = styled.span<{ sortOrder: 'asc' | 'desc' }>`
  margin-left: ${({ theme }) => theme.spacing(1)};
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${({ sortOrder, theme }) => 
    sortOrder === 'asc' ? theme.color.green10 : theme.color.blue10};
  color: ${({ sortOrder, theme }) => 
    sortOrder === 'asc' ? theme.color.green80 : theme.color.blue80};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledSortReasoning = styled.div`
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-style: italic;
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

const StyledMetadataInfo = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledMetadataBadge = styled.span`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue80};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

type SortsMessageProps = {
  sorts: SortsResponse;
  onApplySorts?: () => void;
};

export const SortsMessage: React.FC<SortsMessageProps> = ({
  sorts,
  onApplySorts,
}) => {
  return (
    <StyledMessageContainer>
      <StyledHeader>
        <IconSortAscending size={20} />
        <StyledTitle>Sorting Strategy Generated</StyledTitle>
      </StyledHeader>

      <StyledContent>
        <StyledStrategyCard>
          <StyledStrategyName>{sorts.sortStrategy.name}</StyledStrategyName>
          <StyledStrategyDescription>
            {sorts.sortStrategy.description}
          </StyledStrategyDescription>
        </StyledStrategyCard>

        <StyledSortColumnsSection>
          <StyledSortColumnsHeader>
            Sorting Order ({sorts.sortStrategy.sortColumns.length} columns)
          </StyledSortColumnsHeader>
          <StyledSortColumnsList>
            {sorts.sortStrategy.sortColumns.map((sortCol, index) => (
              <StyledSortColumnItem key={index}>
                <StyledSortColumnName>{sortCol.column}</StyledSortColumnName>
                <StyledSortOrder sortOrder={sortCol.sortOrder}>
                  {sortCol.sortOrder.toUpperCase()}
                </StyledSortOrder>
                <StyledSortReasoning>{sortCol.reasoning}</StyledSortReasoning>
              </StyledSortColumnItem>
            ))}
          </StyledSortColumnsList>
        </StyledSortColumnsSection>

        <StyledReasoning>
          <StyledReasoningTitle>Strategy Reasoning</StyledReasoningTitle>
          <StyledReasoningText>{sorts.sortStrategy.reasoning}</StyledReasoningText>
        </StyledReasoning>

        <StyledReasoning>
          <StyledReasoningTitle>Overall Reasoning</StyledReasoningTitle>
          <StyledReasoningText>{sorts.reasoning}</StyledReasoningText>
        </StyledReasoning>

        <StyledMetadataInfo>
          {(sorts.metadata.hasAiFilters ?? sorts.metadata.hasEnrichments) && (
            <StyledMetadataBadge>
              {sorts.metadata.aiFiltersCount ?? sorts.metadata.enrichmentsCount} AI filters considered
            </StyledMetadataBadge>
          )}
          {sorts.metadata.hasFilters && (
            <StyledMetadataBadge>
              {sorts.metadata.filtersCount} Filters Applied
            </StyledMetadataBadge>
          )}
          {sorts.metadata.hasSampleData && sorts.metadata.sampleDataSize && (
            <StyledMetadataBadge>
              Analyzed {sorts.metadata.sampleDataSize} samples
            </StyledMetadataBadge>
          )}
        </StyledMetadataInfo>
      </StyledContent>

      <StyledActionButtons>
        <Button
          variant="primary"
          onClick={onApplySorts}
          Icon={IconCheck}
        >
          Apply Sorting
        </Button>
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
