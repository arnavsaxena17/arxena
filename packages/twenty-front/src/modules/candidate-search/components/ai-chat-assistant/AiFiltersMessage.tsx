import { Button } from 'twenty-ui';
import { IconCheck, IconRefresh } from 'twenty-ui/icon';
import type { AiFiltersResponse } from '@/candidate-search/types/candidate-search.types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconBrain } from 'twenty-ui/icon';
import React from 'react';

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

const StyledAiFiltersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledAiFilterCard = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
`;

const StyledAiFilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledAiFilterName = styled.h4`
  margin: 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledAiFilterCategory = styled.span<{ category: string }>`
  padding: ${themeCssVariables.spacing['0.5']} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  background-color: ${themeCssVariables.color.blue10};
  color: ${themeCssVariables.color.blue8};
`;

const StyledAiFilterDescription = styled.p`
  margin: ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledFieldsList = styled.div`
  margin: ${themeCssVariables.spacing[1]} 0;
`;

const StyledFieldItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing['0.5']} 0;
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledFieldName = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledFieldType = styled.span`
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${themeCssVariables.background.secondary};
  font-size: 10px;
`;

const StyledAiFilterReasoning = styled.p`
  margin: ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-style: italic;
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledMetadataInfo = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledMetadataTitle = styled.h5`
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledMetadataFields = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledMetadataField = styled.span`
  padding: 2px 6px;
  background-color: ${themeCssVariables.color.blue10};
  color: ${themeCssVariables.color.blue8};
  border-radius: 4px;
  font-size: ${themeCssVariables.font.size.xs};
`;

type AiFiltersMessageProps = {
  aiFiltersResponse: AiFiltersResponse;
  onExecuteAiFilters?: () => void;
  onGenerateFilters?: () => void;
};

export const AiFiltersMessage: React.FC<AiFiltersMessageProps> = ({
  aiFiltersResponse,
  onExecuteAiFilters,
  onGenerateFilters,
}) => {
  const filters = aiFiltersResponse.aiFilters ?? (aiFiltersResponse as any).enrichments ?? [];
  return (
    <StyledMessageContainer>
      <StyledHeader>
        <IconBrain size={20} />
        <StyledTitle>AI Filter Strategy Generated</StyledTitle>
      </StyledHeader>

      <StyledContent>
        <p><strong>AI Filter Strategy:</strong> {aiFiltersResponse.overallStrategy}</p>
        <p><strong>Overall Reasoning:</strong> {aiFiltersResponse.reasoning}</p>
        
        {aiFiltersResponse.metadata.hasSampleData && (
          <p><strong>Sample Data:</strong> Analyzed {aiFiltersResponse.metadata.sampleDataSize} candidates</p>
        )}
      </StyledContent>

      <StyledAiFiltersList>
        {filters.map((filter: any) => (
          <StyledAiFilterCard key={filter.id}>
            <StyledAiFilterHeader>
              <StyledAiFilterName>{filter.name}</StyledAiFilterName>
              <StyledAiFilterCategory category={filter.category}>
                {filter.category.toUpperCase()}
              </StyledAiFilterCategory>
            </StyledAiFilterHeader>
            
            <StyledAiFilterDescription>
              {filter.description}
            </StyledAiFilterDescription>
            
            <StyledFieldsList>
              <strong>Fields:</strong>
              {filter.fields?.map((field: any) => (
                <StyledFieldItem key={field.name}>
                  <StyledFieldName>{field.name}</StyledFieldName>
                  <StyledFieldType>{field.type}</StyledFieldType>
                  {field.enumValues && (
                    <span>({field.enumValues.join(', ')})</span>
                  )}
                </StyledFieldItem>
              ))}
            </StyledFieldsList>

            <StyledMetadataInfo>
              <StyledMetadataTitle>Metadata Fields:</StyledMetadataTitle>
              <StyledMetadataFields>
                {filter.selectedMetadataFields?.map((field: string) => (
                  <StyledMetadataField key={field}>
                    {field}
                  </StyledMetadataField>
                ))}
              </StyledMetadataFields>
            </StyledMetadataInfo>
            
            <StyledAiFilterReasoning>
              <strong>Reasoning:</strong> {filter.reasoning}
            </StyledAiFilterReasoning>
          </StyledAiFilterCard>
        ))}
      </StyledAiFiltersList>

      <StyledActionButtons>
        <Button
          variant="primary"
          onClick={onExecuteAiFilters}
          Icon={IconCheck}
         title="Execute AI filters" />
        <Button
          variant="secondary"
          onClick={onGenerateFilters}
          Icon={IconRefresh}
         title="Generate Filters" />
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
