import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import type { LinkedInSearchType } from 'twenty-shared/types';

/** Which LinkedIn product Unipile uses for org-chart / candidate fetch (classic, Sales Navigator, Recruiter). */
export const orgChartLinkedInSearchTypeState = createAtomState<LinkedInSearchType>({
  key: 'orgChartLinkedInSearchTypeState',
  defaultValue: 'classic',
});
