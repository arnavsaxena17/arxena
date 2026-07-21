import { createState } from 'twenty-ui';
import { IconComponent } from 'twenty-ui';

export const commandMenuPageInfoState = createState<{
  title: string | undefined;
  Icon: IconComponent | undefined;
}>({
  key: 'command-menu/commandMenuPageInfoState',
  defaultValue: { title: undefined, Icon: undefined },
});
