import { styled } from '@linaria/react';
import { type ReactNode } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type OutreachMainTab } from '@/outreach-home/types/outreach-home.types';

const StyledTabsRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 40px;
  padding: 0 ${themeCssVariables.spacing[4]};
`;

const StyledTabs = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledTrailing = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  margin-left: auto;
`;

const StyledTab = styled.button<{ isActive: boolean }>`
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 2px solid
    ${({ isActive }) =>
      isActive ? themeCssVariables.color.blue : 'transparent'};
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
`;

const TABS: Array<{ id: OutreachMainTab; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'companies', label: 'Companies' },
  { id: 'people', label: 'People' },
  { id: 'workflow', label: 'Workflow' },
];

type OutreachMainTabsProps = {
  activeTab: OutreachMainTab;
  companyCount: number;
  peopleCount: number;
  onChange: (tab: OutreachMainTab) => void;
  trailing?: ReactNode;
};

export const OutreachMainTabs = ({
  activeTab,
  companyCount,
  peopleCount,
  onChange,
  trailing,
}: OutreachMainTabsProps) => {
  return (
    <StyledTabsRow>
      <StyledTabs>
        {TABS.map((tab) => {
          let label = tab.label;

          if (tab.id === 'companies' && companyCount > 0) {
            label = `Companies (${companyCount})`;
          }

          if (tab.id === 'people' && peopleCount > 0) {
            label = `People (${peopleCount})`;
          }

          return (
            <StyledTab
              key={tab.id}
              type="button"
              isActive={activeTab === tab.id}
              onClick={() => onChange(tab.id)}
            >
              {label}
            </StyledTab>
          );
        })}
      </StyledTabs>
      {trailing !== undefined && trailing !== null && (
        <StyledTrailing>{trailing}</StyledTrailing>
      )}
    </StyledTabsRow>
  );
};
