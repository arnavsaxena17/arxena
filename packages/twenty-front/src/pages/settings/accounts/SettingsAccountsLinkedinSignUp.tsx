import { useLingui } from '@lingui/react/macro';
import { LinkedinAccounts } from '~/pages/settings/linkedin/LinkedinAccounts';

export const SettingsAccountsLinkedinSignUp = () => {
  const { t } = useLingui();

  return <LinkedinAccounts />;
};