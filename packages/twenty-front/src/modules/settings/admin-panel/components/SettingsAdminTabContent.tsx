import { SettingsAdminAI } from '@/settings/admin-panel/ai/components/SettingsAdminAI';
import { SettingsAdminApps } from '@/settings/admin-panel/apps/components/SettingsAdminApps';
import { SettingsAdminGeneral } from '@/settings/admin-panel/components/SettingsAdminGeneral';
import { SettingsAdminLinkedinParameterCache } from '@/settings/admin-panel/components/SettingsAdminLinkedinParameterCache';
import { SettingsAdminOrgChartClientIps } from '@/settings/admin-panel/components/SettingsAdminOrgChartClientIps';
import { SettingsAdminPublishedOrgCharts } from '@/settings/admin-panel/components/SettingsAdminPublishedOrgCharts';
import { SettingsAdminUsers } from '@/settings/admin-panel/components/SettingsAdminUsers';
import { SettingsAdminWhatsAppMonitoring } from '@/settings/admin-panel/components/SettingsAdminWhatsAppMonitoring';
import { SettingsAdminWorkspaceCredits } from '@/settings/admin-panel/components/SettingsAdminWorkspaceCredits';
import { SettingsAdminConfigVariables } from '@/settings/admin-panel/config-variables/components/SettingsAdminConfigVariables';
import { SETTINGS_ADMIN_TABS } from '@/settings/admin-panel/constants/SettingsAdminTabs';
import { SETTINGS_ADMIN_TABS_ID } from '@/settings/admin-panel/constants/SettingsAdminTabsId';
import { SettingsAdminHealthStatus } from '@/settings/admin-panel/health-status/components/SettingsAdminHealthStatus';
import { SettingsSectionSkeletonLoader } from '@/settings/components/SettingsSectionSkeletonLoader';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { lazy, Suspense } from 'react';

const SettingsEnterprise = lazy(() =>
  import('~/pages/settings/enterprise/SettingsEnterprise').then((module) => ({
    default: module.SettingsEnterprise,
  })),
);
export const SettingsAdminTabContent = () => {
  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    SETTINGS_ADMIN_TABS_ID,
  );

  switch (activeTabId) {
    case SETTINGS_ADMIN_TABS.GENERAL:
      return <SettingsAdminGeneral />;
    case SETTINGS_ADMIN_TABS.APPS:
      return <SettingsAdminApps />;
    case SETTINGS_ADMIN_TABS.AI:
      return <SettingsAdminAI />;
    case SETTINGS_ADMIN_TABS.CONFIG_VARIABLES:
      return <SettingsAdminConfigVariables />;
    case SETTINGS_ADMIN_TABS.HEALTH_STATUS:
      return <SettingsAdminHealthStatus />;
    case SETTINGS_ADMIN_TABS.WHATSAPP_MONITORING:
      return <SettingsAdminWhatsAppMonitoring />;
    case SETTINGS_ADMIN_TABS.WORKSPACE_CREDITS:
      return <SettingsAdminWorkspaceCredits />;
    case SETTINGS_ADMIN_TABS.ORG_CHART_CLIENT_IPS:
      return <SettingsAdminOrgChartClientIps />;
    case SETTINGS_ADMIN_TABS.PUBLISHED_ORG_CHARTS:
      return <SettingsAdminPublishedOrgCharts />;
    case SETTINGS_ADMIN_TABS.LINKEDIN_PARAMETER_CACHE:
      return <SettingsAdminLinkedinParameterCache />;
    case SETTINGS_ADMIN_TABS.USERS:
      return <SettingsAdminUsers />;
    case SETTINGS_ADMIN_TABS.ENTERPRISE:
      return (
        <Suspense fallback={<SettingsSectionSkeletonLoader />}>
          <SettingsEnterprise isAdminPanelTab />
        </Suspense>
      );
    default:
      return null;
  }
};
