import { createState } from 'twenty-ui';
import { Keys } from 'react-hotkeys-hook/dist/types';

export const pendingHotkeyState = createState<Keys | null>({
  key: 'pendingHotkeyState',
  defaultValue: null,
});
