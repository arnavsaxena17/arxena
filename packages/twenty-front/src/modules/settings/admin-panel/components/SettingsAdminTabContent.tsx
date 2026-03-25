import { SettingsAdminEnvVariables } from '@/settings/admin-panel/components/SettingsAdminEnvVariables';
import { SettingsAdminGeneral } from '@/settings/admin-panel/components/SettingsAdminGeneral';
import { SettingsAdminHealthStatus } from '@/settings/admin-panel/components/SettingsAdminHealthStatus';
import { SettingsAdminWhatsAppMonitoring } from '@/settings/admin-panel/components/SettingsAdminWhatsAppMonitoring';
import { SettingsAdminOrgChartClientIps } from '@/settings/admin-panel/components/SettingsAdminOrgChartClientIps';
import { SettingsAdminWorkspaceCredits } from '@/settings/admin-panel/components/SettingsAdminWorkspaceCredits';
import { SETTINGS_ADMIN_TABS } from '@/settings/admin-panel/constants/SettingsAdminTabs';
import { SETTINGS_ADMIN_TABS_ID } from '@/settings/admin-panel/constants/SettingsAdminTabsId';
import { useTabList } from '@/ui/layout/tab/hooks/useTabList';

export const SettingsAdminTabContent = () => {
  const { activeTabId } = useTabList(SETTINGS_ADMIN_TABS_ID);

  switch (activeTabId) {
    case SETTINGS_ADMIN_TABS.GENERAL:
      return <SettingsAdminGeneral />;
    case SETTINGS_ADMIN_TABS.ENV_VARIABLES:
      return <SettingsAdminEnvVariables />;
    case SETTINGS_ADMIN_TABS.HEALTH_STATUS:
      return <SettingsAdminHealthStatus />;
    case SETTINGS_ADMIN_TABS.WHATSAPP_MONITORING:
      return <SettingsAdminWhatsAppMonitoring />;
    case SETTINGS_ADMIN_TABS.WORKSPACE_CREDITS:
      return <SettingsAdminWorkspaceCredits />;
    case SETTINGS_ADMIN_TABS.ORG_CHART_CLIENT_IPS:
      return <SettingsAdminOrgChartClientIps />;
    default:
      return null;
  }
};
