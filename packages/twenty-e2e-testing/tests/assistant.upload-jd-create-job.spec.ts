import { test } from '@playwright/test';

import { completeJobCreationFromJobsUpload } from '../lib/utils/jobCreationE2eHelpers';

test('Jobs: add new job -> upload JD -> create job', async ({
  page,
}) => {
  test.setTimeout(300_000);

  await completeJobCreationFromJobsUpload(page);
});
