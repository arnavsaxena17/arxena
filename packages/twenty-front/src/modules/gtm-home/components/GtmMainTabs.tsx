import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type GtmMainTab } from '@/gtm-home/types/gtm-home.types';

const StyledTabs = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: 0 ${themeCssVariables.spacing[4]};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
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

const TABS: Array<{ id: GtmMainTab; label: string }> = [
  { id: 'companies', label: 'Companies' },
  { id: 'people', label: 'People' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'market_map', label: 'Market map' },
];

type GtmMainTabsProps = {
  activeTab: GtmMainTab;
  companyCount: number;
  peopleCount: number;
  onChange: (tab: GtmMainTab) => void;
};

export const GtmMainTabs = ({
  activeTab,
  companyCount,
  peopleCount,
  onChange,
}: GtmMainTabsProps) => {
  return (
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
  );
};
