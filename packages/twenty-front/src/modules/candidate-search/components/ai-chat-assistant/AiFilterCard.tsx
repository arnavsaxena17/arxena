import { Enrichment } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconEdit } from 'twenty-ui/icon';

const StyledAiFilterCard = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[3]};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledAiFilterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledAiFilterTitle = styled.h4`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
`;

const StyledEditButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledAiFilterDetail = styled.div`
  margin-bottom: ${themeCssVariables.spacing[2]};
  
  strong {
    color: ${themeCssVariables.font.color.primary};
    font-weight: ${themeCssVariables.font.weight.semiBold};
  }
`;

const StyledFieldList = styled.ul`
  margin: ${themeCssVariables.spacing[1]} 0;
  padding-left: ${themeCssVariables.spacing[3]};
  
  li {
    margin-bottom: ${themeCssVariables.spacing[1]};
    color: ${themeCssVariables.font.color.secondary};
  }
`;

const StyledTokenButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.color.blue};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.color.blue10};
  color: ${themeCssVariables.color.blue};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${themeCssVariables.color.blue2};
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
