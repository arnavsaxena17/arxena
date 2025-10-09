import styled from '@emotion/styled';
import { IconEdit } from '@tabler/icons-react';

const StyledEnrichmentCard = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledEnrichmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledEnrichmentTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledEditButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledEnrichmentDetail = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  
  strong {
    color: ${({ theme }) => theme.font.color.primary};
    font-weight: ${({ theme }) => theme.font.weight.semiBold};
  }
`;

const StyledFieldList = styled.ul`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  padding-left: ${({ theme }) => theme.spacing(3)};
  
  li {
    margin-bottom: ${({ theme }) => theme.spacing(1)};
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

const StyledTokenButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.color.blue20};
  }
`;

import { Enrichment } from '@/arx-enrich/states/arxEnrichModalOpenState';

type EnrichmentCardProps = {
  enrichment: Enrichment;
  enrichmentIndex: number;
  onEdit: (enrichmentIndex: number) => void;
  onComputeTokens: (enrichmentIndex: number) => void;
};

export const EnrichmentCard = ({ 
  enrichment, 
  enrichmentIndex,
  onEdit, 
  onComputeTokens 
}: EnrichmentCardProps) => {
  return (
    <StyledEnrichmentCard>
      <StyledEnrichmentHeader>
        <StyledEnrichmentTitle>{enrichment.modelName}</StyledEnrichmentTitle>
        <StyledEditButton onClick={() => onEdit(enrichmentIndex)}>
          <IconEdit size={16} />
          Edit
        </StyledEditButton>
      </StyledEnrichmentHeader>
      
      <StyledEnrichmentDetail>
        <strong>Filter Description:</strong> {enrichment.filterDescription}
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Prompt:</strong> {enrichment.prompt}
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Model:</strong> {enrichment.selectedModel}
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Output Columns:</strong>
        <StyledFieldList>
          {enrichment.fields?.map((field) => (
            <li key={field.id}>
              {field.name} ({field.type}): {field.description}
            </li>
          ))}
        </StyledFieldList>
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Input Fields:</strong> {enrichment.selectedMetadataFields?.join(', ')}
      </StyledEnrichmentDetail>
      
      <StyledTokenButton onClick={() => onComputeTokens(enrichmentIndex)}>
        Compute Tokens
      </StyledTokenButton>
    </StyledEnrichmentCard>
  );
};
