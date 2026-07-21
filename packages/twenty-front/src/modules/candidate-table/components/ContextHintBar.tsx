import { IconDatabase, IconTrash } from 'twenty-ui/icons';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { fetchedCandidatesCountSelector } from '@/candidate-search/states/searchResultsState';
import styled from '@emotion/styled';
import { IconBulb } from 'twenty-ui/icons';
import { useRecoilValue } from 'recoil';

const StyledContextHintBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledContextInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledHintSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledHintIcon = styled.div`
  color: ${({ theme }) => theme.color.orange};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${({ variant, theme }) => {
    switch (variant) {
      case 'primary':
        return `
          background-color: ${theme.color.blue};
          color: white;
          border-color: ${theme.color.blue};
          
          &:hover {
            background-color: ${theme.color.blue60};
            border-color: ${theme.color.blue60};
          }
        `;
      case 'danger':
        return `
          background-color: ${theme.color.red};
          color: white;
          border-color: ${theme.color.red};
          
          &:hover {
            background-color: ${theme.color.red60};
            border-color: ${theme.color.red60};
          }
        `;
      default:
        return `
          background-color: ${theme.background.primary};
          color: ${theme.font.color.primary};
          
          &:hover {
            background-color: ${theme.background.secondary};
            border-color: ${theme.border.color.strong};
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
  const fetchedCount = useRecoilValue(fetchedCandidatesCountSelector);
  const parsedJD = useRecoilValue(parsedJDSelector);

  // Determine hint based on current state
  const getHint = () => {
    if (fetchedCount > 0) {
      return "Enrich data before saving for better filtering";
    }
    return "Search for candidates to get started";
  };

  const getHintIcon = () => {
    if (fetchedCount > 0) {
      return <IconBulb size={16} />;
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
              <IconBulb size={14} />
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
