

import { IconMessages, IconSearch, IconRocket } from 'twenty-ui/icons';
import { IconAddressBook, IconComponent } from 'twenty-ui';
import { IconApps, IconAt, IconCalendarEvent, IconCurrencyDollar, IconMail, IconSettings, IconUserCircle, IconUsers } from 'twenty-ui/icons';
import { SettingsPath } from '@/types/SettingsPath';
import { SettingsFeatures } from 'twenty-shared';

import { currentUserState } from '@/auth/states/currentUserState';
import { billingState } from '@/client-config/states/billingState';
import { labPublicFeatureFlagsState } from '@/client-config/states/labPublicFeatureFlagsState';
import { useSettingsPermissionMap } from '@/settings/roles/hooks/useSettingsPermissionMap';
import { NavigationDrawerItemIndentationLevel } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { t } from '@lingui/core/macro';
import { IconBrandFacebook, IconBrandLinkedin, IconBrandWhatsapp, IconCode, IconColorSwatch, IconFlask, IconFunction, IconHierarchy2, IconKey, IconLock, IconServer, IconTopologyFull } from 'twenty-ui/icons';
import { useRecoilValue } from 'recoil';
import { FeatureFlagKey } from '~/generated/graphql';

export type SettingsNavigationSection = {
  label: string;
  items: SettingsNavigationItem[];
  isAdvanced?: boolean;
};

export type SettingsNavigationItem = {
  label: string;
  path: SettingsPath;
  Icon: IconComponent;
  indentationLevel?: NavigationDrawerItemIndentationLevel;
  matchSubPages?: boolean;
  isHidden?: boolean;
  subItems?: SettingsNavigationItem[];
  isAdvanced?: boolean;
  soon?: boolean;
};

export const useSettingsNavigationItems = (): SettingsNavigationSection[] => {
  const billing = useRecoilValue(billingState);

  const isFunctionSettingsEnabled = true;
  const isBillingEnabled = billing?.isBillingEnabled ?? false;
  const currentUser = useRecoilValue(currentUserState);
  const isAdminEnabled = currentUser?.canImpersonate ?? false;
  const labPublicFeatureFlags = useRecoilValue(labPublicFeatureFlagsState);

  const permissionMap = useSettingsPermissionMap();
  const isWorkflowEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IsWorkflowEnabled,
  );

  return [
    {
      label: t`User`,
      items: [
        {
          label: t`Profile`,
          path: SettingsPath.ProfilePage,
          Icon: IconUserCircle,
        },
        {
          label: t`Experience`,
          path: SettingsPath.Experience,
          Icon: IconColorSwatch,
        },
        {
          label: t`Accounts`,
          path: SettingsPath.Accounts,
          Icon: IconAt,
          matchSubPages: false,
          subItems: [
            {
              label: t`Emails`,
              path: SettingsPath.AccountsEmails,
              Icon: IconMail,
              indentationLevel: 2,
            },
            {
              label: t`Calendars`,
              path: SettingsPath.AccountsCalendars,
              Icon: IconCalendarEvent,
              indentationLevel: 2,
            },
            {
              label: t`Google Contacts`,
              path: SettingsPath.AccountsContacts,
              Icon: IconAddressBook,
              indentationLevel: 2,
            },
            // {
            //   label: t`Whatsapp Chats`,
            //   path: SettingsPath.Chats,
            //   Icon: IconMessages,
            //   indentationLevel: 2,
            // },
            {
              label: t`Whatsapp Unipile`,
              path: SettingsPath.WhatsappUnipile,
              Icon: IconBrandWhatsapp,
              indentationLevel: 2,
            },
            {
              label: t`Whatsapp Business`,
              path: SettingsPath.FacebookSignUp,
              Icon: IconBrandFacebook,
              indentationLevel: 2,
            },
            {
              label: t`Linkedin Business`,
              path: SettingsPath.LinkedinSignUp,
              Icon: IconBrandLinkedin,
              indentationLevel: 2,
            },
            // {
            //   label: t`Linkedin Connection`,
            //   path: SettingsPath.LinkedinSignUp,
            //   Icon: IconBrandLinkedin,
            //   indentationLevel: 2,
            // },
            // {
            //   label: t`Search Plan`,
            //   path: SettingsPath.SearchPlans,
            //   Icon: IconSearch,
            //   indentationLevel: 2,
            // },
          ],
        },
      ],
    },
    {
      label: t`Workspace`,
      items: [
        {
          label: t`General`,
          path: SettingsPath.Workspace,
          Icon: IconSettings,
          isHidden: !permissionMap[SettingsFeatures.WORKSPACE],
        },
        {
          label: t`Members`,
          path: SettingsPath.WorkspaceMembersPage,
          Icon: IconUsers,
          isHidden: !permissionMap[SettingsFeatures.WORKSPACE_USERS],
        },
        {
          label: t`Billing`,
          path: SettingsPath.Billing,
          Icon: IconCurrencyDollar,
          isHidden:
            !isBillingEnabled || !permissionMap[SettingsFeatures.WORKSPACE],
        },
        {
          label: t`Roles`,
          path: SettingsPath.Roles,
          Icon: IconLock,
          isHidden: false
            // !featureFlags[FeatureFlagKey.IsPermissionsEnabled]
            // !permissionMap[SettingsFeatures.ROLES],
        },
        {
          label: t`Data model`,
          path: SettingsPath.Objects,
          Icon: IconHierarchy2,
          isHidden: !permissionMap[SettingsFeatures.DATA_MODEL],
        },
        {
          label: t`Integrations`,
          path: SettingsPath.Integrations,
          Icon: IconApps,
          isHidden: !permissionMap[SettingsFeatures.API_KEYS_AND_WEBHOOKS],
        },
        {
          label: t`Security`,
          path: SettingsPath.Security,
          Icon: IconKey,
          isAdvanced: true,
          isHidden: !permissionMap[SettingsFeatures.SECURITY],
        },
      ],
    },
    {
      label: t`Developers`,
      isAdvanced: true,
      items: [
        {
          label: t`API & Webhooks`,
          path: SettingsPath.Developers,
          Icon: IconCode,
          isAdvanced: true,
          isHidden: false,
        },
        {
          label: t`Functions`,
          path: SettingsPath.ServerlessFunctions,
          Icon: IconFunction,
          isHidden: false,
          isAdvanced: true,
        },
        {
          label: t`Workflows`,
          path: SettingsPath.Workflows,
          Icon: IconTopologyFull,
          isHidden: !isWorkflowEnabled,
          isAdvanced: true,
        },
      ],
    },
    {
      label: t`Other`,
      items: [
          {
            label: t`Server Admin`,
            path: SettingsPath.AdminPanel,
            Icon: IconServer,
            isHidden: !isAdminEnabled,
          },
          {
            label: t`Lab`,
            path: SettingsPath.Lab,
            Icon: IconFlask,
            isHidden:
              !labPublicFeatureFlags.length ||
              !permissionMap[SettingsFeatures.WORKSPACE],
          },
          // {
          //   label: t`Releases`,
          //   path: SettingsPath.Releases,
          //   Icon: IconRocket,
          // },
      ],
    },
  ];
};
