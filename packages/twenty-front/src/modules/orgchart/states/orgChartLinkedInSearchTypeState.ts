import { createState } from 'twenty-ui';

import { LinkedInSearchType } from 'twenty-shared';

/** Which LinkedIn product Unipile uses for org-chart / candidate fetch (classic, Sales Navigator, Recruiter). */
export const orgChartLinkedInSearchTypeState = createState<LinkedInSearchType>({
  key: 'orgChartLinkedInSearchTypeState',
  defaultValue: 'classic',
});
