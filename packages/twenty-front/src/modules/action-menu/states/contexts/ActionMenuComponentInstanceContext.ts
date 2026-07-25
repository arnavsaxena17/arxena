import { createContext } from 'react';

export const ActionMenuComponentInstanceContext = createContext<{
  instanceId: string;
}>({
  instanceId: 'default',
});
