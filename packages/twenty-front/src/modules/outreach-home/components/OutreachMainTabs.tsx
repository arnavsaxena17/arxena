import { styled } from '@linaria/react';
import {
  IconBuildingSkyscraper,
  type IconComponent,
  IconSettings,
  IconUser,
} from 'twenty-ui/icon';
import { TabButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type OutreachMainTab } from '@/outreach-home/types/outreach-home.types';
import { TAB_LIST_GAP } from '@/ui/layout/tab-list/constants/TabListGap';
import { TAB_LIST_HEIGHT } from '@/ui/layout/tab-list/constants/TabListHeight';

// Same chrome as the Twenty TabList, but controlled by the working-set hook
// (activeTab lives there, not in a tab-list component state).
const StyledTabsRow = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  gap: ${TAB_LIST_GAP}px;
  height: ${TAB_LIST_HEIGHT};
  padding: 0 ${themeCssVariables.spacing[2]};
  position: relative;
  user-select: none;

  &::after {
    background-color: ${themeCssVariables.border.color.light};
    bottom: 0;
    content: '';
    height: 1px;
    left: 0;
    position: absolute;
    right: 0;
  }
`;

const TABS: Array<{ id: OutreachMainTab; label: string; Icon: IconComponent }> =
  [
    { id: 'companies', label: 'Companies', Icon: IconBuildingSkyscraper },
    { id: 'people', label: 'People', Icon: IconUser },
    { id: 'setup', label: 'Setup', Icon: IconSettings },
  ];

type OutreachMainTabsProps = {
  activeTab: OutreachMainTab;
  companyCount: number;
  peopleCount: number;
  onChange: (tab: OutreachMainTab) => void;
};

export const OutreachMainTabs = ({
  activeTab,
  companyCount,
  peopleCount,
  onChange,
}: OutreachMainTabsProps) => {
  const getPill = (tabId: OutreachMainTab) => {
    const count =
      tabId === 'companies'
        ? companyCount
        : tabId === 'people'
          ? peopleCount
          : 0;

    return count > 0 ? String(count) : undefined;
  };

  return (
    <StyledTabsRow>
      {TABS.map((tab) => (
        <TabButton
          key={tab.id}
          id={`outreach-${tab.id}`}
          title={tab.label}
          LeftIcon={tab.Icon}
          active={activeTab === tab.id}
          pill={getPill(tab.id)}
          onClick={() => onChange(tab.id)}
        />
      ))}
    </StyledTabsRow>
  );
};
