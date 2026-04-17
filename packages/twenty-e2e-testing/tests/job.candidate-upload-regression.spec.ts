import { expect, test } from '@playwright/test';

import {
  buildExistingLookup,
  computeExpectedNewRows,
  findMatchingCandidate,
  getCandidatesByJobId,
  getPeopleForCandidates,
  headOfCorporateWorkbookPath,
  hiringPayloadPath,
  importSpreadsheetViaStepper,
  loadJsonFile,
  loadWorkbookRows,
  logCandidateSourcingStep,
  mergedWorkbookPath,
  uploadHiringPayload,
  validateSpreadsheetContacts,
  waitForCandidateCount,
  waitForJobPageReady,
} from '../lib/utils/candidateSourcingE2eHelpers';
import {
  ensureAuthenticatedJobsPage,
  getAuthToken,
  testingArxenaStorageStatePath,
} from '../lib/utils/orgChartE2eHelpers';

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

const jobId = '171d1d50-1c55-4ed3-a7c3-97d14eb0da3c';

test.describe('Job candidate upload regression', () => {
  test.use({
    storageState: testingArxenaStorageStatePath,
  });

  test('signs in, uploads candidates across formats, and reports discrepancies', async ({
    page,
    context,
  }) => {
    test.setTimeout(20 * 60 * 1000);

    const issues: string[] = [];
    const hiringPayload = loadJsonFile<Record<string, any>>(hiringPayloadPath);
    const hiringRows = JSON.parse(hiringPayload.json_data) as Record<
      string,
      unknown
    >[];
    const mergedRows = loadWorkbookRows(mergedWorkbookPath);
    const headOfCorporateRows = loadWorkbookRows(headOfCorporateWorkbookPath);

    await ensureAuthenticatedJobsPage(page, context, {
      baseUrl: appBaseUrl,
      email,
      password,
    });

    await page.goto(`${appBaseUrl}/job/${jobId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForURL(new RegExp(`/job/${jobId}(?:[/?#]|$)`), {
      timeout: 90_000,
    });
    await waitForJobPageReady(page);

    const authToken = await getAuthToken(context);

    await test.step('Run hiring upload once and validate created candidates + people', async () => {
      const before = await getCandidatesByJobId(authToken, { apiBaseUrl, jobId });
      const expectedNewRows = computeExpectedNewRows(
        before,
        hiringRows,
        'hiring_naukri',
      );

      await uploadHiringPayload(authToken, {
        apiBaseUrl,
        appBaseUrl,
        jobId,
        sourcePayload: hiringPayload,
      });

      await waitForCandidateCount(authToken, {
        apiBaseUrl,
        jobId,
        expectedCount: before.length + expectedNewRows.length,
      });

      const after = await getCandidatesByJobId(authToken, { apiBaseUrl, jobId });
      const actualAdded = after.length - before.length;
      if (actualAdded !== expectedNewRows.length) {
        issues.push(
          `Hiring upload delta mismatch: expected ${expectedNewRows.length} new candidates, got ${actualAdded}.`,
        );
      }

      const people = await getPeopleForCandidates(authToken, apiBaseUrl, after);
      const afterLookup = buildExistingLookup(after);
      for (const row of expectedNewRows) {
        const matchedCandidate = findMatchingCandidate(
          afterLookup,
          row,
          'hiring_naukri',
        );

        if (!matchedCandidate) {
          issues.push(
            `Hiring upload missing candidate for row "${String(row.name || 'unknown')}".`,
          );
          continue;
        }

        if (matchedCandidate.jobsId !== jobId) {
          issues.push(
            `Hiring upload candidate "${matchedCandidate.name || matchedCandidate.id}" is linked to job "${matchedCandidate.jobsId}" instead of "${jobId}".`,
          );
        }

        if (!matchedCandidate.uniqueStringKey) {
          issues.push(
            `Hiring upload candidate "${matchedCandidate.name || matchedCandidate.id}" has no uniqueStringKey.`,
          );
        }

        if (!matchedCandidate.peopleId) {
          issues.push(
            `Hiring upload candidate "${matchedCandidate.name || matchedCandidate.id}" has no peopleId.`,
          );
          continue;
        }

        const person = people.get(matchedCandidate.peopleId);
        if (!person) {
          issues.push(
            `Hiring upload candidate "${matchedCandidate.name || matchedCandidate.id}" has missing person record "${matchedCandidate.peopleId}".`,
          );
          continue;
        }

        const personName =
          `${person.name?.firstName || ''} ${person.name?.lastName || ''}`.trim();
        if (!personName) {
          issues.push(`Hiring upload person "${person.id}" has an empty name.`);
        }
      }
    });

    await test.step('Run hiring upload again and verify duplicate suppression', async () => {
      const before = await getCandidatesByJobId(authToken, { apiBaseUrl, jobId });
      const expectedNewRows = computeExpectedNewRows(
        before,
        hiringRows,
        'hiring_naukri',
      );

      await uploadHiringPayload(authToken, {
        apiBaseUrl,
        appBaseUrl,
        jobId,
        sourcePayload: hiringPayload,
      });

      await waitForCandidateCount(authToken, {
        apiBaseUrl,
        jobId,
        expectedCount: before.length + expectedNewRows.length,
      });

      const after = await getCandidatesByJobId(authToken, { apiBaseUrl, jobId });
      const actualAdded = after.length - before.length;

      if (expectedNewRows.length !== 0) {
        issues.push(
          `Second hiring upload expected 0 new rows, but dedup pre-check still predicted ${expectedNewRows.length}.`,
        );
      }

      if (actualAdded !== 0) {
        issues.push(`Second hiring upload added ${actualAdded} candidates; expected 0.`);
      }
    });

    const runSpreadsheetImportValidation = async (
      filePath: string,
      label: string,
      rows: Record<string, unknown>[],
    ) => {
      const before = await getCandidatesByJobId(authToken, { apiBaseUrl, jobId });
      const expectedNewRows = computeExpectedNewRows(
        before,
        rows,
        'spreadsheet_import',
      );

      await importSpreadsheetViaStepper(page, {
        filePath,
        label,
      });

      await waitForCandidateCount(authToken, {
        apiBaseUrl,
        jobId,
        expectedCount: before.length + expectedNewRows.length,
      });

      const after = await getCandidatesByJobId(authToken, { apiBaseUrl, jobId });
      const actualAdded = after.length - before.length;
      if (actualAdded !== expectedNewRows.length) {
        issues.push(
          `${label} delta mismatch: expected ${expectedNewRows.length} new candidates, got ${actualAdded}.`,
        );
      }

      await validateSpreadsheetContacts(authToken, {
        apiBaseUrl,
        afterCandidates: after,
        expectedNewRows,
        issues,
        label,
      });
    };

    await test.step('Import downloadable_all_naukri_merged.xlsx through the stepper and validate counts + contacts', async () => {
      await runSpreadsheetImportValidation(
        mergedWorkbookPath,
        'downloadable_all_naukri_merged.xlsx',
        mergedRows,
      );
    });

    await test.step('Import Head-of-Corporate-St workbook through the stepper and validate counts + contacts', async () => {
      await runSpreadsheetImportValidation(
        headOfCorporateWorkbookPath,
        'Head-of-Corporate-St workbook',
        headOfCorporateRows,
      );
    });

    logCandidateSourcingStep('Candidate upload verification finished', {
      discrepancyCount: issues.length,
    });

    expect(
      issues,
      issues.length === 0
        ? undefined
        : `Discrepancies found:\n- ${issues.join('\n- ')}`,
    ).toEqual([]);
  });
});
