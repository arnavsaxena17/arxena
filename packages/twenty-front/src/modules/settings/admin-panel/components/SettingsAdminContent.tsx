import { IconCurrencyDollar, IconHeart, IconSettings2, IconUsers, IconVariable } from 'twenty-ui/icons';
import { SettingsAdminTabContent } from '@/settings/admin-panel/components/SettingsAdminTabContent';
import { SETTINGS_ADMIN_TABS } from '@/settings/admin-panel/constants/SettingsAdminTabs';
import { SETTINGS_ADMIN_TABS_ID } from '@/settings/admin-panel/constants/SettingsAdminTabsId';
import { TabList } from '@/ui/layout/tab/components/TabList';
import styled from '@emotion/styled';
import {
  IconBrandLinkedin,
  IconBrandWhatsapp,
  IconHierarchy,
  IconNetwork,
} from 'twenty-ui/icons';

const StyledAdminContentWrapper = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(8)};
  grid-template-columns: minmax(0, 1fr);
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

const StyledTabListContainer = styled.div`
  align-items: center;
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  box-sizing: border-box;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
`;

export const SettingsAdminContent = () => {
  const tabs = [
    {
      id: SETTINGS_ADMIN_TABS.GENERAL,
      title: 'General',
      Icon: IconSettings2,
    },
    {
      id: SETTINGS_ADMIN_TABS.ENV_VARIABLES,
      title: 'Env Variables',
      Icon: IconVariable,
    },
    {
      id: SETTINGS_ADMIN_TABS.HEALTH_STATUS,
      title: 'Health Status',
      Icon: IconHeart,
    },
    {
      id: SETTINGS_ADMIN_TABS.WHATSAPP_MONITORING,
      title: 'WhatsApp',
      Icon: IconBrandWhatsapp,
    },
    {
      id: SETTINGS_ADMIN_TABS.WORKSPACE_CREDITS,
      title: 'Workspace Credits',
      Icon: IconCurrencyDollar,
    },
    {
      id: SETTINGS_ADMIN_TABS.ORG_CHART_CLIENT_IPS,
      title: 'Org chart IPs',
      Icon: IconNetwork,
    },
    {
      id: SETTINGS_ADMIN_TABS.PUBLISHED_ORG_CHARTS,
      title: 'Org Charts',
      Icon: IconHierarchy,
    },
    {
      id: SETTINGS_ADMIN_TABS.LINKEDIN_PARAMETER_CACHE,
      title: 'LinkedIn Cache',
      Icon: IconBrandLinkedin,
    },
    {
      id: SETTINGS_ADMIN_TABS.USERS,
      title: 'Users',
      Icon: IconUsers,
    },
  ];

  return (
    <StyledAdminContentWrapper>
      <StyledTabListContainer>
        <TabList
          tabs={tabs}
          tabListInstanceId={SETTINGS_ADMIN_TABS_ID}
          behaveAsLinks={true}
        />
      </StyledTabListContainer>
      <SettingsAdminTabContent />
    </StyledAdminContentWrapper>
  );
};
