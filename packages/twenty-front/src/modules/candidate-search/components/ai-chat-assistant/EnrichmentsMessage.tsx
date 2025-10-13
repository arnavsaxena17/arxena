import { EnrichmentsResponse } from '@/search-plan/types/search-plan.types';
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

const StyledEnrichmentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledEnrichmentCard = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
`;

const StyledEnrichmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledEnrichmentName = styled.h4`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledEnrichmentCategory = styled.span<{ category: string }>`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue80};
`;

const StyledEnrichmentDescription = styled.p`
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

const StyledEnrichmentReasoning = styled.p`
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

type EnrichmentsMessageProps = {
  enrichments: EnrichmentsResponse;
  onExecuteEnrichments?: () => void;
  onGenerateFilters?: () => void;
};

export const EnrichmentsMessage: React.FC<EnrichmentsMessageProps> = ({
  enrichments,
  onExecuteEnrichments,
  onGenerateFilters,
}) => {
  return (
    <StyledMessageContainer>
      <StyledHeader>
        <IconBrain size={20} />
        <StyledTitle>Enrichment Strategy Generated</StyledTitle>
      </StyledHeader>

      <StyledContent>
        <p><strong>Enrichment Strategy:</strong> {enrichments.overallStrategy}</p>
        <p><strong>Overall Reasoning:</strong> {enrichments.reasoning}</p>
        
        {enrichments.metadata.hasSampleData && (
          <p><strong>Sample Data:</strong> Analyzed {enrichments.metadata.sampleDataSize} candidates</p>
        )}
      </StyledContent>

      <StyledEnrichmentsList>
        {enrichments.enrichments.map((enrichment) => (
          <StyledEnrichmentCard key={enrichment.id}>
            <StyledEnrichmentHeader>
              <StyledEnrichmentName>{enrichment.name}</StyledEnrichmentName>
              <StyledEnrichmentCategory category={enrichment.category}>
                {enrichment.category.toUpperCase()}
              </StyledEnrichmentCategory>
            </StyledEnrichmentHeader>
            
            <StyledEnrichmentDescription>
              {enrichment.description}
            </StyledEnrichmentDescription>
            
            <StyledFieldsList>
              <strong>Fields:</strong>
              {enrichment.fields.map((field) => (
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
                {enrichment.selectedMetadataFields.map((field) => (
                  <StyledMetadataField key={field}>
                    {field}
                  </StyledMetadataField>
                ))}
              </StyledMetadataFields>
            </StyledMetadataInfo>
            
            <StyledEnrichmentReasoning>
              <strong>Reasoning:</strong> {enrichment.reasoning}
            </StyledEnrichmentReasoning>
          </StyledEnrichmentCard>
        ))}
      </StyledEnrichmentsList>

      <StyledActionButtons>
        <Button
          variant="primary"
          onClick={onExecuteEnrichments}
          Icon={IconCheck}
        >
          Execute Enrichments
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
