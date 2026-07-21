import { type IconComponent } from 'twenty-ui';
import { IconGoogle, IconMicrosoftOutlook } from 'twenty-ui';
import { IconKey } from 'twenty-ui/icons';

/* @license Enterprise */

export const guessSSOIdentityProviderIconByUrl = (
  url: string,
): IconComponent => {
  if (url.includes('google')) {
    return IconGoogle;
  }

  if (url.includes('microsoft')) {
    return IconMicrosoftOutlook;
  }

  return IconKey;
};
