import { atom } from 'recoil';

import { NaukriQueueSnapshot } from '@/chrome-extension/utils/naukriQueueExtensionBridge';

export const naukriQueueStatusState = atom<NaukriQueueSnapshot | null>({
  key: 'naukriQueueStatusState',
  default: null,
});
