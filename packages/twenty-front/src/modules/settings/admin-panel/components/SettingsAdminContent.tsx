import { currentUserState } from '@/auth/states/currentUserState';
import { billingState } from '@/client-config/states/billingState';
import { SettingsAdminTabContent } from '@/settings/admin-panel/components/SettingsAdminTabContent';
import { SETTINGS_ADMIN_TABS } from '@/settings/admin-panel/constants/SettingsAdminTabs';
import { SETTINGS_ADMIN_TABS_ID } from '@/settings/admin-panel/constants/SettingsAdminTabsId';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { t } from '@lingui/core/macro';
import {
  IconApps,
  IconBrandLinkedin,
  IconBrandWhatsapp,
  IconCurrencyDollar,
  IconHeart,
  IconHierarchy,
  IconKey,
  IconSettings2,
  IconSparkles,
  IconUsers,
  IconVariable,
  IconWorld,
} from 'twenty-ui/icon';

export const SettingsAdminContent = () => {
  const currentUser = useAtomStateValue(currentUserState);
  const billing = useAtomStateValue(billingState);

  const canAccessFullAdminPanel = currentUser?.canAccessFullAdminPanel;
  const canImpersonate = currentUser?.canImpersonate;
  const isBillingEnabled = billing?.isBillingEnabled;
  const tabs = [
    {
      id: SETTINGS_ADMIN_TABS.GENERAL,
      title: t`General`,
      Icon: IconSettings2,
      disabled: !canAccessFullAdminPanel && !canImpersonate,
    },
    {
      id: SETTINGS_ADMIN_TABS.APPS,
      title: t`Apps`,
      Icon: IconApps,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.AI,
      title: t`AI`,
      Icon: IconSparkles,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.CONFIG_VARIABLES,
      title: t`Config`,
      Icon: IconVariable,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.HEALTH_STATUS,
      title: t`Health`,
      Icon: IconHeart,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.WHATSAPP_MONITORING,
      title: t`Unipile`,
      Icon: IconBrandWhatsapp,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.WORKSPACE_CREDITS,
      title: t`Credits`,
      Icon: IconCurrencyDollar,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.ORG_CHART_CLIENT_IPS,
      title: t`Org chart IPs`,
      Icon: IconWorld,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.PUBLISHED_ORG_CHARTS,
      title: t`Published charts`,
      Icon: IconHierarchy,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.LINKEDIN_PARAMETER_CACHE,
      title: t`LI cache`,
      Icon: IconBrandLinkedin,
      disabled: !canAccessFullAdminPanel,
    },
    {
      id: SETTINGS_ADMIN_TABS.USERS,
      title: t`Users`,
      Icon: IconUsers,
      disabled: !canAccessFullAdminPanel,
    },
    ...(!isBillingEnabled
      ? [
          {
            id: SETTINGS_ADMIN_TABS.ENTERPRISE,
            title: t`Enterprise`,
            Icon: IconKey,
            disabled: !canAccessFullAdminPanel && !canImpersonate,
          },
        ]
      : []),
  ];

  return (
    <>
      <TabList
        tabs={tabs}
        behaveAsLinks={true}
        componentInstanceId={SETTINGS_ADMIN_TABS_ID}
      />
      <SettingsAdminTabContent />
    </>
  );
};
