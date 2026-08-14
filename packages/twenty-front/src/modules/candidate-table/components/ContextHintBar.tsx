import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { fetchedCandidatesCountSelector } from '@/candidate-search/states/searchResultsState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { IconBolt, IconDatabase, IconTrash } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContextHintBar = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledContextInfo = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHintSection = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledHintIcon = styled.div`
  color: ${themeCssVariables.color.orange};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledActionButton = styled.button<{
  variant?: 'primary' | 'secondary' | 'danger';
}>`
  align-items: center;
  background-color: ${({ variant }) => {
    if (variant === 'primary') {
      return themeCssVariables.color.blue;
    }
    if (variant === 'danger') {
      return themeCssVariables.color.red;
    }
    return themeCssVariables.background.primary;
  }};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-color: ${({ variant }) => {
    if (variant === 'primary') {
      return themeCssVariables.color.blue;
    }
    if (variant === 'danger') {
      return themeCssVariables.color.red;
    }
    return themeCssVariables.border.color.medium;
  }};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ variant }) =>
    variant === 'primary' || variant === 'danger'
      ? 'white'
      : themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ variant }) => {
      if (variant === 'primary') {
        return themeCssVariables.color.blue6;
      }
      if (variant === 'danger') {
        return themeCssVariables.color.red6;
      }
      return themeCssVariables.background.secondary;
    }};
    border-color: ${({ variant }) => {
      if (variant === 'primary') {
        return themeCssVariables.color.blue6;
      }
      if (variant === 'danger') {
        return themeCssVariables.color.red6;
      }
      return themeCssVariables.border.color.strong;
    }};
  }
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
  const fetchedCandidatesCount = useAtomStateValue(fetchedCandidatesCountSelector);
  const parsedJD = useAtomStateValue(parsedJDSelector);

  // Determine hint based on current state
  const getHint = () => {
    if (fetchedCandidatesCount > 0) {
      return "Enrich data before saving for better filtering";
    }
    return "Search for candidates to get started";
  };

  const getHintIcon = () => {
    if (fetchedCandidatesCount > 0) {
      return <IconBolt size={16} />;
    }
    return <IconDatabase size={16} />;
  };

  const showActions = fetchedCandidatesCount > 0;

  return (
    <StyledContextHintBar className={className}>
      <StyledContextInfo>
        <span>🔍 {fetchedCandidatesCount} candidates fetched</span>
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
