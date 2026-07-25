import { IconDatabase, IconTrash } from 'twenty-ui/icon';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { fetchedCandidatesCountSelector } from '@/candidate-search/states/searchResultsState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconBolt } from 'twenty-ui/icon';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledContextHintBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledContextInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledHintSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledHintIcon = styled.div`
  color: ${themeCssVariables.color.orange};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${({ variant }) => {
    switch (variant) {
      case 'primary':
        return `
          background-color: ${themeCssVariables.color.blue};
          color: white;
          border-color: ${themeCssVariables.color.blue};
          
          &:hover {
            background-color: ${themeCssVariables.color.blue6};
            border-color: ${themeCssVariables.color.blue6};
          }
        `;
      case 'danger':
        return `
          background-color: ${themeCssVariables.color.red};
          color: white;
          border-color: ${themeCssVariables.color.red};
          
          &:hover {
            background-color: ${themeCssVariables.color.red6};
            border-color: ${themeCssVariables.color.red6};
          }
        `;
      default:
        return `
          background-color: ${themeCssVariables.background.primary};
          color: ${themeCssVariables.font.color.primary};
          
          &:hover {
            background-color: ${themeCssVariables.background.secondary};
            border-color: ${themeCssVariables.border.color.strong};
          }
        `;
    }
  }}
`;

type ContextHintBarProps = {
  onCreateEnrichment?: () => void;
  onSaveAll?: () => void;
  onDiscard?: () => void;
  className?: string;
};

export const ContextHintBar = ({ 
  onCreateEnrichment, 
  onSaveAll, 
  onDiscard,
  className 
}: ContextHintBarProps) => {
  const fetchedCount = useAtomStateValue(fetchedCandidatesCountSelector);
  const parsedJD = useAtomStateValue(parsedJDSelector);

  // Determine hint based on current state
  const getHint = () => {
    if (fetchedCount > 0) {
      return "Enrich data before saving for better filtering";
    }
    return "Search for candidates to get started";
  };

  const getHintIcon = () => {
    if (fetchedCount > 0) {
      return <IconBolt size={16} />;
    }
    return <IconDatabase size={16} />;
  };

  const showActions = fetchedCount > 0;

  return (
    <StyledContextHintBar className={className}>
      <StyledContextInfo>
        <span>🔍 {fetchedCount} candidates fetched</span>
        {parsedJD && (
          <span>• {parsedJD.name}</span>
        )}
      </StyledContextInfo>

      <StyledHintSection>
        <StyledHintIcon>
          {getHintIcon()}
        </StyledHintIcon>
        <span>💡 Tip: {getHint()}</span>
      </StyledHintSection>

      {showActions && (
        <StyledActionButtons>
          {onCreateEnrichment && (
            <StyledActionButton onClick={onCreateEnrichment}>
              <IconBolt size={14} />
              Create Enrichment
            </StyledActionButton>
          )}
          {onSaveAll && (
            <StyledActionButton variant="primary" onClick={onSaveAll}>
              <IconDatabase size={14} />
              Save All
            </StyledActionButton>
          )}
          {onDiscard && (
            <StyledActionButton variant="danger" onClick={onDiscard}>
              <IconTrash size={14} />
              Discard
            </StyledActionButton>
          )}
        </StyledActionButtons>
      )}
    </StyledContextHintBar>
  );
};
