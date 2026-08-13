import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

import { type NaukriQueueSnapshot } from '@/chrome-extension/utils/naukriQueueExtensionBridge';

export const naukriQueueStatusState = createAtomState<NaukriQueueSnapshot | null>(
  {
    key: 'naukriQueueStatusState',
    defaultValue: null,
  },
);
