import { Enrichment } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import styled from '@emotion/styled';
import { IconEdit } from 'twenty-ui/icons';

const StyledAiFilterCard = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledAiFilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledAiFilterTitle = styled.h4`
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

const StyledAiFilterDetail = styled.div`
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

type AiFilterCardProps = {
  aiFilter: Enrichment;
  aiFilterIndex: number;
  onEdit: (aiFilterIndex: number) => void;
  onComputeTokens: (aiFilterIndex: number) => void;
};

export const AiFilterCard = ({
  aiFilter,
  aiFilterIndex,
  onEdit,
  onComputeTokens
}: AiFilterCardProps) => {
  return (
    <StyledAiFilterCard>
      <StyledAiFilterHeader>
        <StyledAiFilterTitle>{aiFilter.modelName}</StyledAiFilterTitle>
        <StyledEditButton onClick={() => onEdit(aiFilterIndex)}>
          <IconEdit size={16} />
          Edit
        </StyledEditButton>
      </StyledAiFilterHeader>
      
      <StyledAiFilterDetail>
        <strong>Filter Description:</strong> {aiFilter.filterDescription}
      </StyledAiFilterDetail>
      
      <StyledAiFilterDetail>
        <strong>Prompt:</strong> {aiFilter.prompt}
      </StyledAiFilterDetail>
      
      <StyledAiFilterDetail>
        <strong>Model:</strong> {aiFilter.selectedModel}
      </StyledAiFilterDetail>
      
      <StyledAiFilterDetail>
        <strong>Output Columns:</strong>
        <StyledFieldList>
          {aiFilter.fields?.map((field) => (
            <li key={field.id}>
              {field.name} ({field.type}): {field.description}
            </li>
          ))}
        </StyledFieldList>
      </StyledAiFilterDetail>
      
      <StyledAiFilterDetail>
        <strong>Input Fields:</strong> {aiFilter.selectedMetadataFields?.join(', ')}
      </StyledAiFilterDetail>
      
      <StyledTokenButton onClick={() => onComputeTokens(aiFilterIndex)}>
        Compute Tokens
      </StyledTokenButton>
    </StyledAiFilterCard>
  );
};
