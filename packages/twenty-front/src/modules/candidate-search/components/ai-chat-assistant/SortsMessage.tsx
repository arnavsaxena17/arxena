import type { SortsResponse } from 'twenty-shared/types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconCheck, IconSortAscending } from 'twenty-ui/icon';
import React from 'react';
import { Button } from 'twenty-ui';

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

const StyledStrategyName = styled.h4`
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledStrategyDescription = styled.p`
  margin: ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledSortColumnsSection = styled.div`
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledSortColumnsHeader = styled.h5`
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledSortColumnsList = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin: 0;
  padding-left: ${themeCssVariables.spacing[3]};
`;

const StyledSortColumnItem = styled.li`
  padding: ${themeCssVariables.spacing['1.5']};
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledSortColumnName = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledSortOrder = styled.span<{ sortOrder: 'asc' | 'desc' }>`
  margin-left: ${themeCssVariables.spacing[1]};
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${({ sortOrder }) => 
    sortOrder === 'asc' ? themeCssVariables.color.green10 : themeCssVariables.color.blue10};
  color: ${({ sortOrder }) => 
    sortOrder === 'asc' ? themeCssVariables.color.green8 : themeCssVariables.color.blue8};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledSortReasoning = styled.div`
  margin-top: ${themeCssVariables.spacing['0.5']};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-style: italic;
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

const StyledMetadataInfo = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledMetadataBadge = styled.span`
  padding: ${themeCssVariables.spacing['0.5']} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  background-color: ${themeCssVariables.color.blue10};
  color: ${themeCssVariables.color.blue8};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
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
          {(sorts.metadata.hasAiFilters) && (
            <StyledMetadataBadge>
              {sorts.metadata.aiFiltersCount} AI filters considered
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
         title="Apply Sorting" />
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
