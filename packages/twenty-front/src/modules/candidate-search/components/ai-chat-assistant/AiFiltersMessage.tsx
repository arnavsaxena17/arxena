import type { AiFiltersResponse } from 'twenty-shared';
import styled from '@emotion/styled';
import { IconBrain } from '@tabler/icons-react';
import React from 'react';
import { Button, IconCheck, IconRefresh } from 'twenty-ui';

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

const StyledAiFiltersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledAiFilterCard = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
`;

const StyledAiFilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledAiFilterName = styled.h4`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledAiFilterCategory = styled.span<{ category: string }>`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue80};
`;

const StyledAiFilterDescription = styled.p`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledFieldsList = styled.div`
  margin: ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledFieldItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(0.5)} 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledFieldName = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledFieldType = styled.span`
  padding: 2px 6px;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.background.secondary};
  font-size: 10px;
`;

const StyledAiFilterReasoning = styled.p`
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

const StyledMetadataInfo = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledMetadataTitle = styled.h5`
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledMetadataFields = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledMetadataField = styled.span`
  padding: 2px 6px;
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue80};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.font.size.xs};
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
        >
          Execute AI filters
        </Button>
        <Button
          variant="secondary"
          onClick={onGenerateFilters}
          Icon={IconRefresh}
        >
          Generate Filters
        </Button>
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
