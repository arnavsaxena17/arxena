import { test } from '@playwright/test';

import {
  attachOrgChartProgressCollector,
  createJobViaGraphql,
  ensureAuthenticatedJobsPage,
  getAuthToken,
  testingArxenaStorageStatePath,
} from '../lib/utils/orgChartE2eHelpers';
import {
  defaultOrgChartDatasourceRuns,
  runOrgChartDatasourceVerificationSequence,
} from '../lib/utils/orgChartDatasourceE2eHelpers';

const logStep = (step: string, detail?: Record<string, unknown>) => {
  const line = `[briskpe orgchart datasource] ${step}`;
  if (detail) {
    console.log(line, JSON.stringify(detail));
    return;
  }

  console.log(line);
};

test.describe('Briskpe org chart data source progress', () => {
  test.use({
    storageState: testingArxenaStorageStatePath,
  });

  const targetEnv = (process.env.ARXENA_E2E_ENV ?? 'local').toLowerCase();
  const appBaseUrl =
    process.env.ARXENA_E2E_BASE_URL ||
    (targetEnv === 'prod'
      ? 'https://testing-arxena.arxena.com'
      : 'http://testing-arxena.localhost:3001');
  const apiBaseUrl =
    process.env.ARXENA_E2E_API_BASE_URL ||
    process.env.BACKEND_BASE_URL ||
    (targetEnv === 'prod'
      ? appBaseUrl
      : appBaseUrl.replace(/:3001(?:\/)?$/, ':3000'));
  const email = process.env.ARXENA_E2E_EMAIL || 'testing@arxena.com';
  const password = process.env.ARXENA_E2E_PASSWORD || 'Applecar2025';

  test('shows preview template and surfaces backend progress or frontend errors for each data source', async ({
    page,
    context,
  }) => {
    test.setTimeout(35 * 60 * 1000);

    logStep('ensure authenticated jobs page');
    await ensureAuthenticatedJobsPage(page, context, {
      baseUrl: appBaseUrl,
      email,
      password,
    });

    const collector = attachOrgChartProgressCollector(page);
    const authToken = await getAuthToken(context);
    const createdJob = await createJobViaGraphql({
      page,
      apiBaseUrl,
      authToken,
      jobName: `Briskpe Orgchart E2E ${Date.now()}`,
    });

    try {
      const runSummaries = await runOrgChartDatasourceVerificationSequence(page, {
        appBaseUrl,
        apiBaseUrl,
        authToken,
        collector,
        companyQuery: 'briskpe',
        companyOptionName: 'briskpe',
        jobId: createdJob.jobId,
        sourceRuns: defaultOrgChartDatasourceRuns,
      });

      logStep('final run summaries', {
        runSummaries,
      });
      console.log(
        JSON.stringify(
          {
            briskpeOrgChartDatasourceRuns: runSummaries,
          },
          null,
          2,
        ),
      );
    } finally {
      collector.dispose();
    }
  });
});
