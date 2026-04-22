import { SettingsAdminEnvVariables } from '@/settings/admin-panel/components/SettingsAdminEnvVariables';
import { SettingsAdminGeneral } from '@/settings/admin-panel/components/SettingsAdminGeneral';
import { SettingsAdminHealthStatus } from '@/settings/admin-panel/components/SettingsAdminHealthStatus';
import { SettingsAdminOrgChartClientIps } from '@/settings/admin-panel/components/SettingsAdminOrgChartClientIps';
import { SettingsAdminUsers } from '@/settings/admin-panel/components/SettingsAdminUsers';
import { SettingsAdminWhatsAppMonitoring } from '@/settings/admin-panel/components/SettingsAdminWhatsAppMonitoring';
import { SettingsAdminWorkspaceCredits } from '@/settings/admin-panel/components/SettingsAdminWorkspaceCredits';
import { SETTINGS_ADMIN_TABS } from '@/settings/admin-panel/constants/SettingsAdminTabs';
import { SETTINGS_ADMIN_TABS_ID } from '@/settings/admin-panel/constants/SettingsAdminTabsId';
import { useTabList } from '@/ui/layout/tab/hooks/useTabList';
import styled from '@emotion/styled';
import { ReactNode } from 'react';

const StyledTabContentWrapper = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(8)};
  grid-template-columns: minmax(0, 1fr);
  max-width: 100%;
  min-width: 0;
  width: 100%;
`;

const renderContent = (content: ReactNode) => (
  <StyledTabContentWrapper>{content}</StyledTabContentWrapper>
);

export const SettingsAdminTabContent = () => {
  const { activeTabId } = useTabList(SETTINGS_ADMIN_TABS_ID);

  switch (activeTabId) {
    case SETTINGS_ADMIN_TABS.GENERAL:
      return renderContent(<SettingsAdminGeneral />);
    case SETTINGS_ADMIN_TABS.ENV_VARIABLES:
      return renderContent(<SettingsAdminEnvVariables />);
    case SETTINGS_ADMIN_TABS.HEALTH_STATUS:
      return renderContent(<SettingsAdminHealthStatus />);
    case SETTINGS_ADMIN_TABS.WHATSAPP_MONITORING:
      return renderContent(<SettingsAdminWhatsAppMonitoring />);
    case SETTINGS_ADMIN_TABS.WORKSPACE_CREDITS:
      return renderContent(<SettingsAdminWorkspaceCredits />);
    case SETTINGS_ADMIN_TABS.ORG_CHART_CLIENT_IPS:
      return renderContent(<SettingsAdminOrgChartClientIps />);
    case SETTINGS_ADMIN_TABS.USERS:
      return renderContent(<SettingsAdminUsers />);
    default:
      return null;
  }
};
