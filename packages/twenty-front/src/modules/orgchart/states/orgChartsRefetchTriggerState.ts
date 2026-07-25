import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

// Increment when an orgChart CRM row is created/updated so the nav list refetches
export const orgChartsRefetchTriggerState = createAtomState<number>({
  key: 'orgchart/orgChartsRefetchTriggerState',
  defaultValue: 0,
});
