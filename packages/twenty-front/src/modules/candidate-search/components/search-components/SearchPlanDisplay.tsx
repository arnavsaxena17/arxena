import styled from '@emotion/styled';

const StyledSearchPlanSelector = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  
  select {
    width: 100%;
    padding: ${({ theme }) => theme.spacing(2)};
    border: 1px solid ${({ theme }) => theme.border.color.medium};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    background-color: ${({ theme }) => theme.background.primary};
    color: ${({ theme }) => theme.font.color.primary};
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;

const StyledSearchPlan = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledSearchPlanTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledSearchPlanContent = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const StyledEnrichmentSection = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding-top: ${({ theme }) => theme.spacing(2)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledEnrichmentTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledEnrichmentList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledEnrichmentItem = styled.li`
  padding: ${({ theme }) => theme.spacing(0.5)} 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  
  &::before {
    content: '•';
    color: ${({ theme }) => theme.color.blue};
    font-weight: bold;
  }
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-top: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
`;

const StyledActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.xs};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  
  ${({ variant, theme }) => variant === 'primary' ? `
    background-color: ${theme.color.blue};
    color: white;
  ` : `
    background-color: ${theme.color.green};
    color: white;
  `}
`;

import { SearchPlan } from '../../hooks/useSearchPlanManager';

type SearchPlanDisplayProps = {
  searchPlans: SearchPlan[];
  currentSearchPlan: SearchPlan | null;
  onPlanSelect: (plan: SearchPlan) => void;
  onApplyPlan: (plan: SearchPlan) => void;
  onCreateEnrichments: (plan: SearchPlan) => void;
};

export const SearchPlanDisplay = ({
  searchPlans,
  currentSearchPlan,
  onPlanSelect,
  onApplyPlan,
  onCreateEnrichments,
}: SearchPlanDisplayProps) => {
  return (
    <>
      {/* Search Plan Selector */}
      {searchPlans.length > 1 && (
        <StyledSearchPlanSelector>
          <select
            value={currentSearchPlan?.id || ''}
            onChange={(e) => {
              const selectedPlan = searchPlans.find(plan => plan.id === e.target.value);
              if (selectedPlan) {
                onPlanSelect(selectedPlan);
              }
            }}
          >
            {searchPlans.map(plan => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </StyledSearchPlanSelector>
      )}

      {/* Search Plan Display */}
      {currentSearchPlan && (
        <StyledSearchPlan>
          <StyledSearchPlanTitle>Current Search Plan: {currentSearchPlan.name}</StyledSearchPlanTitle>
          <StyledSearchPlanContent>
            <div><strong>Keywords:</strong> {currentSearchPlan.filters.keywords.join(', ')}</div>
            <div><strong>Job Title:</strong> {currentSearchPlan.filters.jobTitle}</div>
            <div><strong>Location:</strong> {currentSearchPlan.filters.location}</div>
            <div><strong>Industry:</strong> {currentSearchPlan.filters.industry}</div>
            <div><strong>Seniority:</strong> {currentSearchPlan.filters.seniority}</div>
          </StyledSearchPlanContent>
          
          <StyledEnrichmentSection>
            <StyledEnrichmentTitle>Enrichments</StyledEnrichmentTitle>
            <StyledEnrichmentList>
              {currentSearchPlan.enrichments.map((enrichment: string, index: number) => (
                <StyledEnrichmentItem key={index}>{enrichment}</StyledEnrichmentItem>
              ))}
            </StyledEnrichmentList>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              {currentSearchPlan.columnFilters} column filters applied
            </div>
          </StyledEnrichmentSection>
          
          <StyledActionButtons>
            <StyledActionButton
              variant="primary"
              onClick={() => onApplyPlan(currentSearchPlan)}
            >
              Apply Plan
            </StyledActionButton>
            <StyledActionButton
              variant="secondary"
              onClick={() => onCreateEnrichments(currentSearchPlan)}
            >
              Create Enrichments
            </StyledActionButton>
          </StyledActionButtons>
        </StyledSearchPlan>
      )}
    </>
  );
};
