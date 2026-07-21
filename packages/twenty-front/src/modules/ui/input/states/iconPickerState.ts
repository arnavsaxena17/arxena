import { type IconComponent } from 'twenty-ui';
import { createState } from 'twenty-ui';

import { IconApps } from 'twenty-ui/icons';

type IconPickerState = {
  Icon: IconComponent;
  iconKey: string;
};

export const iconPickerState = createState<IconPickerState>({
  key: 'iconPickerState',
  defaultValue: { Icon: IconApps, iconKey: 'IconApps' },
});
