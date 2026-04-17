import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import {
  getNextAppleIndex,
  signInWithExistingCredentials,
  signUpAndReachIntentChoice,
} from '../lib/utils/authFlowE2eHelpers';
import { runCandidateEngagementScenario } from '../lib/utils/candidateEngagementE2eHelpers';
import {
  assertCandidateQueueWorkerAvailable,
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
  mergedWorkbookPath,
  runAiFilteringAndValidate,
  uploadHiringPayload,
  validateSpreadsheetContacts,
  waitForCandidateCount,
  waitForCandidateJobQueuedInRedis,
  waitForJobPageReady,
} from '../lib/utils/candidateSourcingE2eHelpers';
import { completeJobCreationFromJobsUpload } from '../lib/utils/jobCreationE2eHelpers';
import {
  defaultOrgChartDatasourceRuns,
  runOrgChartDatasourceVerificationSequence,
} from '../lib/utils/orgChartDatasourceE2eHelpers';
import {
  attachOrgChartProgressCollector,
  getAuthToken,
  saveStorageState,
} from '../lib/utils/orgChartE2eHelpers';

const targetEnv = (process.env.ARXENA_E2E_ENV ?? 'local').toLowerCase();
const onboardingBaseUrl =
  process.env.ARXENA_E2E_ONBOARDING_BASE_URL || 'http://app.localhost:3001';
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
const existingUserEmail = process.env.ARXENA_E2E_EMAIL || 'testing@arxena.com';
const existingUserPassword = process.env.ARXENA_E2E_PASSWORD || 'Applecar2025';
const fullJourneyStepsEnv = process.env.FULL_JOURNEY_STEPS ?? 'all';

const logJourneyStep = (step: string, detail?: Record<string, unknown>) => {
  const line = `[recruiting-full-journey] ${step}`;
  if (detail) {
    console.log(line, JSON.stringify(detail, null, 2));
    return;
  }

  console.log(line);
};

const logEnvironmentBanner = () => {
  const banner = '='.repeat(80);
  const environmentLabel = targetEnv === 'prod' ? 'PRODUCTION' : 'LOCAL';

  console.log(banner);
  console.log(`[recruiting-full-journey] RUNNING AGAINST ${environmentLabel}`);
  console.log(`[recruiting-full-journey] onboardingBaseUrl=${onboardingBaseUrl}`);
  console.log(`[recruiting-full-journey] appBaseUrl=${appBaseUrl}`);
  console.log(`[recruiting-full-journey] apiBaseUrl=${apiBaseUrl}`);
  console.log(`[recruiting-full-journey] FULL_JOURNEY_STEPS=${fullJourneyStepsEnv}`);
  console.log(banner);
};

const selectedFullJourneySteps = new Set(
  fullJourneyStepsEnv
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const shouldRunStep = (...stepNames: string[]) =>
  selectedFullJourneySteps.has('all') ||
  stepNames.some((stepName) => selectedFullJourneySteps.has(stepName.toLowerCase()));

const getCandidateNameFromSpreadsheetRow = (row: Record<string, unknown>) => {
  const firstName =
    typeof row.firstName === 'string'
      ? row.firstName
      : typeof row['First Name'] === 'string'
        ? row['First Name']
        : '';
  const lastName =
    typeof row.lastName === 'string'
      ? row.lastName
      : typeof row['Last Name'] === 'string'
        ? row['Last Name']
        : '';
  const fullNameCandidates = [
    row.name,
    row.Name,
    row['Candidate Name'],
    row['Full Name'],
    row.fullName,
    `${firstName} ${lastName}`.trim(),
  ];

  return (
    fullNameCandidates.find(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0,
    ) ?? ''
  ).trim();
};

const getAuthTokenWithRefresh = async (
  page: Page,
  context: BrowserContext,
) => {
  try {
    return await getAuthToken(context, page);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'No tokenPair auth cookie found') {
      throw error;
    }

    logJourneyStep('tokenPair cookie missing after sign-in; retrying login', {
      currentUrl: page.url(),
      email: existingUserEmail,
    });
    await signInWithExistingCredentials(page, {
      baseUrl: appBaseUrl,
      email: existingUserEmail,
      password: existingUserPassword,
      targetPath: '/jobs',
    });
    await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);
    await saveStorageState(context);
    logJourneyStep('refreshed auth storage after retry login', {
      currentUrl: page.url(),
    });

    return getAuthToken(context, page);
  }
};

test('recruiting journey covers onboarding, assistant JD, uploads, AI filtering, and org chart sources', async ({
  browser,
  page,
  context,
}) => {
  test.setTimeout(45 * 60 * 1000);

  logEnvironmentBanner();
  logJourneyStep('spec start', {
    targetEnv,
    onboardingBaseUrl,
    appBaseUrl,
    apiBaseUrl,
    existingUserEmail,
  });

  const onboardingContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const onboardingPage = await onboardingContext.newPage();
  const appleIndex = getNextAppleIndex();
  const onboardingEmail = `apple${appleIndex}@apple.com`;
  const workspaceSuffix = `recruiting-full-journey-${Date.now()}`;

  logJourneyStep('created onboarding browser context', {
    onboardingEmail,
    workspaceSuffix,
  });

  try {
    if (shouldRunStep('all', 'onboarding')) {
      await test.step('Do new onboarding', async () => {
        logJourneyStep('starting onboarding flow', {
          onboardingEmail,
          workspaceSuffix,
        });
        await signUpAndReachIntentChoice(onboardingPage, {
          email: onboardingEmail,
          workspaceSuffix,
          baseUrl: onboardingBaseUrl,
        });
        logJourneyStep('reached onboarding intent choice', {
          currentUrl: onboardingPage.url(),
        });

        await onboardingPage
          .getByRole('button', { name: 'Competitive research' })
          .click();
        logJourneyStep('clicked onboarding intent', {
          intent: 'Competitive research',
        });
        await onboardingPage.waitForURL(/\/create\/competitive-research(?:[/?#]|$)/, {
          timeout: 120_000,
        });
        logJourneyStep('landed on competitive research path', {
          currentUrl: onboardingPage.url(),
        });
        await onboardingPage.getByRole('button', { name: 'Go to jobs' }).click();
        logJourneyStep('clicked Go to jobs from onboarding');
        await onboardingPage.waitForURL(
          /http:\/\/[^/]+\.localhost:3001\/jobs(?:[/?#]|$)/,
          {
            timeout: 120_000,
          },
        );
        logJourneyStep('onboarding reached jobs page', {
          currentUrl: onboardingPage.url(),
        });
      });
    } else {
      logJourneyStep('skipping onboarding step');
    }
  } finally {
    logJourneyStep('closing onboarding context');
    await onboardingContext.close();
  }

  if (
    shouldRunStep(
      'all',
      'signin',
      'jd-upload',
      'upload-jd',
      'candidate-upload',
      'candidate-engagement',
      'ai-filtering',
      'orgchart',
    )
  ) {
    await test.step('Sign in using existing credentials', async () => {
      logJourneyStep('starting existing-user sign in', {
        targetPath: '/jobs',
        email: existingUserEmail,
      });
      await signInWithExistingCredentials(page, {
        baseUrl: appBaseUrl,
        email: existingUserEmail,
        password: existingUserPassword,
        targetPath: '/jobs',
      });
      await expect(page).toHaveURL(/\/jobs(?:[/?#]|$)/);
      logJourneyStep('signed in with existing credentials', {
        currentUrl: page.url(),
      });
    });
  } else {
    logJourneyStep('skipping sign-in step because only onboarding was requested');
  }

  const needsAuthenticatedAppFlow = shouldRunStep(
    'all',
    'signin',
    'jd-upload',
    'upload-jd',
    'candidate-upload',
    'candidate-engagement',
    'ai-filtering',
    'orgchart',
  );

  if (!needsAuthenticatedAppFlow) {
    logJourneyStep('no authenticated app flow requested; finishing after onboarding');
    return;
  }

  const needsJobLookup = shouldRunStep(
    'all',
    'candidate-upload',
    'candidate-engagement',
    'ai-filtering',
    'orgchart',
  );
  const authToken = needsJobLookup
    ? await getAuthTokenWithRefresh(page, context)
    : null;

  if (authToken) {
    logJourneyStep('retrieved auth token', {
      tokenLength: authToken.length,
    });
  } else {
    logJourneyStep('skipping auth token retrieval for jd-upload-only run');
  }

  const collector = shouldRunStep('all', 'orgchart')
    ? attachOrgChartProgressCollector(page)
    : null;

  if (collector) {
    logJourneyStep('attached org chart progress collector');
  } else {
    logJourneyStep('skipping org chart progress collector');
  }

  try {
    let createdJob: { id: string; name?: string } | null = null;

    if (shouldRunStep('all', 'jd-upload', 'upload-jd')) {
      const { jobId, jobName } = await test.step('Upload job description and create a job', async () => {
        logJourneyStep('starting jobs-page JD upload');
        const result = await completeJobCreationFromJobsUpload(page, {
          skipSignIn: true,
        });
        logJourneyStep('jobs-page JD upload finished', {
          jobId: result.jobId,
          jobName: result.jobName,
          currentUrl: page.url(),
        });
        return result;
      });

      if (needsJobLookup && authToken) {
        createdJob = {
          id: jobId,
          name: jobName,
        };
        logJourneyStep('using exact created job id from current URL', createdJob);
      } else {
        logJourneyStep('skipping created job lookup for jd-upload-only run', {
          jobName,
        });
      }
    } else {
      const fallbackJobId = process.env.FULL_JOURNEY_JOB_ID;
      if (!fallbackJobId) {
        throw new Error(
          'FULL_JOURNEY_JOB_ID is required when FULL_JOURNEY_STEPS skips jd-upload but still needs job-dependent steps.',
        );
      }

      createdJob = {
        id: fallbackJobId,
        name: process.env.FULL_JOURNEY_JOB_NAME,
      };
      logJourneyStep('using existing job from environment', createdJob);
    }

    if (needsJobLookup && createdJob) {
      logJourneyStep('opening created job page', {
        jobId: createdJob.id,
        url: `${appBaseUrl}/job/${createdJob.id}`,
      });
      await page.goto(`${appBaseUrl}/job/${createdJob.id}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await page.waitForURL(new RegExp(`/job/${createdJob.id}(?:[/?#]|$)`), {
        timeout: 90_000,
      });
      await waitForJobPageReady(page);
      logJourneyStep('job page ready', {
        currentUrl: page.url(),
        jobId: createdJob.id,
      });
    }

    const issues: string[] = [];
    logJourneyStep('loading candidate upload fixtures');
    const hiringPayload = loadJsonFile<Record<string, unknown>>(hiringPayloadPath);
    const hiringRows = JSON.parse(String(hiringPayload.json_data)) as Record<
      string,
      unknown
    >[];
    const mergedRows = loadWorkbookRows(mergedWorkbookPath);
    const headOfCorporateRows = loadWorkbookRows(headOfCorporateWorkbookPath);
    logJourneyStep('loaded candidate upload fixtures', {
      hiringRows: hiringRows.length,
      mergedRows: mergedRows.length,
      headOfCorporateRows: headOfCorporateRows.length,
      hiringPayloadPath,
      mergedWorkbookPath,
      headOfCorporateWorkbookPath,
    });

    if (shouldRunStep('all', 'candidate-upload')) {
      await test.step('Upload candidates across multiple formats', async () => {
        if (!createdJob || !authToken) {
          throw new Error(
            'Candidate upload requires a created job and auth token. Set FULL_JOURNEY_JOB_ID when skipping jd-upload, or ensure job creation resolves.',
          );
        }
        const jobId = createdJob.id;
        const token = authToken;
        logJourneyStep('starting multi-format candidate upload phase', {
          jobId,
        });
        const beforeHiring = await getCandidatesByJobId(token, {
          apiBaseUrl,
          jobId,
        });
        logJourneyStep('fetched candidates before hiring payload upload', {
          count: beforeHiring.length,
        });
        const expectedHiringRows = computeExpectedNewRows(
          beforeHiring,
          hiringRows,
          'hiring_naukri',
        );
        logJourneyStep('computed expected new hiring candidates', {
          expectedNewRows: expectedHiringRows.length,
        });
        logJourneyStep('checking candidate queue worker availability');
        const workerHealth = await assertCandidateQueueWorkerAvailable(
          apiBaseUrl,
        );
        logJourneyStep('candidate queue worker available', {
          workers: workerHealth.candidateQueue.workers,
          metrics: workerHealth.candidateQueue.metrics,
        });

        logJourneyStep('uploading hiring payload', {
          jobId,
        });
        await uploadHiringPayload(token, {
          apiBaseUrl,
          appBaseUrl,
          jobId,
          sourcePayload: hiringPayload,
        });
        if (targetEnv === 'local') {
          logJourneyStep('checking redis queue after hiring payload upload', {
            jobId,
          });
          const redisQueueSnapshot = await waitForCandidateJobQueuedInRedis({
            jobId,
          });
          logJourneyStep('candidate upload observed in redis queue', {
            matchingKeys: redisQueueSnapshot.matchingKeys.length,
            prioritizedMatches: redisQueueSnapshot.prioritizedMatches.length,
            waitingMatches: redisQueueSnapshot.waitingMatches.length,
            activeMatches: redisQueueSnapshot.activeMatches.length,
            completedMatches: redisQueueSnapshot.completedMatches.length,
            failedMatches: redisQueueSnapshot.failedMatches.length,
          });
        }
        logJourneyStep('hiring payload uploaded, waiting for candidate count', {
          expectedCount: beforeHiring.length + expectedHiringRows.length,
        });
        await waitForCandidateCount(token, {
          apiBaseUrl,
          jobId,
          expectedCount: beforeHiring.length + expectedHiringRows.length,
        });
        logJourneyStep('candidate count reached expected value after hiring payload');

        const afterHiring = await getCandidatesByJobId(token, {
          apiBaseUrl,
          jobId,
        });
        logJourneyStep('fetched candidates after hiring payload upload', {
          beforeCount: beforeHiring.length,
          afterCount: afterHiring.length,
          delta: afterHiring.length - beforeHiring.length,
        });
        const hiringLookup = buildExistingLookup(afterHiring);
        const hiringPeople = await getPeopleForCandidates(
          token,
          apiBaseUrl,
          afterHiring,
        );
        logJourneyStep('fetched linked people for hiring payload candidates', {
          peopleCount: hiringPeople.size,
        });

        for (const [index, row] of expectedHiringRows.entries()) {
          logJourneyStep('validating hiring candidate row', {
            index,
            candidateName: String(row.name || 'unknown'),
          });
          const candidate = findMatchingCandidate(
            hiringLookup,
            row,
            'hiring_naukri',
          );
          if (!candidate) {
            logJourneyStep('missing candidate after hiring upload', {
              index,
              candidateName: String(row.name || 'unknown'),
            });
            issues.push(
              `Hiring upload missing candidate for row "${String(row.name || 'unknown')}".`,
            );
            continue;
          }

          logJourneyStep('matched hiring candidate', {
            index,
            candidateId: candidate.id,
            candidateName: candidate.name,
            peopleId: candidate.peopleId,
          });

          if (!candidate.peopleId || !hiringPeople.get(candidate.peopleId)) {
            logJourneyStep('linked person missing for hiring candidate', {
              candidateId: candidate.id,
              candidateName: candidate.name,
              peopleId: candidate.peopleId,
            });
            issues.push(
              `Hiring upload candidate "${candidate.name || candidate.id}" is missing a linked person.`,
            );
          }
        }

        const runSpreadsheetImport = async (
          filePath: string,
          label: string,
          rows: Record<string, unknown>[],
        ) => {
          logJourneyStep('starting spreadsheet import', {
            label,
            filePath,
            rowCount: rows.length,
          });
          const before = await getCandidatesByJobId(token, {
            apiBaseUrl,
            jobId,
          });
          logJourneyStep('fetched candidates before spreadsheet import', {
            label,
            count: before.length,
          });
          const expectedNewRows = computeExpectedNewRows(
            before,
            rows,
            'spreadsheet_import',
          );
          logJourneyStep('computed expected spreadsheet additions', {
            label,
            expectedNewRows: expectedNewRows.length,
          });

          await importSpreadsheetViaStepper(page, {
            filePath,
            label,
            expectedVisibleCandidateNames: expectedNewRows
              .map(getCandidateNameFromSpreadsheetRow)
              .filter(Boolean)
              .slice(0, 3),
          });
          logJourneyStep('spreadsheet stepper completed, waiting for candidate count', {
            label,
            expectedCount: before.length + expectedNewRows.length,
          });
          await waitForCandidateCount(token, {
            apiBaseUrl,
            jobId,
            expectedCount: before.length + expectedNewRows.length,
          });
          logJourneyStep('candidate count reached expected value after spreadsheet import', {
            label,
          });

          const after = await getCandidatesByJobId(token, {
            apiBaseUrl,
            jobId,
          });
          logJourneyStep('fetched candidates after spreadsheet import', {
            label,
            beforeCount: before.length,
            afterCount: after.length,
            delta: after.length - before.length,
          });
          await validateSpreadsheetContacts(token, {
            apiBaseUrl,
            afterCandidates: after,
            expectedNewRows,
            issues,
            label,
          });
          logJourneyStep('validated spreadsheet contacts', {
            label,
            discrepancyCount: issues.length,
          });
        };

        await runSpreadsheetImport(
          mergedWorkbookPath,
          'downloadable_all_naukri_merged.xlsx',
          mergedRows,
        );
        await runSpreadsheetImport(
          headOfCorporateWorkbookPath,
          'Head-of-Corporate-St workbook',
          headOfCorporateRows,
        );

        logJourneyStep('completed multi-format candidate upload phase', {
          discrepancyCount: issues.length,
        });

        expect(
          issues,
          issues.length === 0
            ? undefined
            : `Candidate upload discrepancies:\n- ${issues.join('\n- ')}`,
        ).toEqual([]);
      });
    } else {
      logJourneyStep('skipping candidate-upload step');
    }

    if (shouldRunStep('all', 'candidate-engagement')) {
      await test.step('Run candidate engagement flow against the fixed WhatsApp test candidate', async () => {
        logJourneyStep('starting candidate engagement verification', {
          jobId:
            process.env.CANDIDATE_ENGAGEMENT_JOB_ID ??
            'd485761d-0c59-4caf-9c35-37a8391234d8',
          candidatePhone:
            process.env.CANDIDATE_ENGAGEMENT_PHONE ?? '918411937769',
        });

        const engagementResult = await runCandidateEngagementScenario(
          page,
          context,
          {
            appBaseUrl,
            apiBaseUrl,
            email: existingUserEmail,
            password: existingUserPassword,
            authToken,
            jobId: process.env.CANDIDATE_ENGAGEMENT_JOB_ID,
            candidatePhoneNumber: process.env.CANDIDATE_ENGAGEMENT_PHONE,
          },
        );

        logJourneyStep('candidate engagement verification completed', {
          candidateId: engagementResult.candidateId,
          recruiterId: engagementResult.recruiterId,
          recruiterWhatsappUnipileId:
            engagementResult.recruiterWhatsappUnipileId,
          newAttachmentFiles: engagementResult.newAttachmentFiles,
        });
      });
    } else {
      logJourneyStep('skipping candidate-engagement step');
    }

    if (shouldRunStep('all', 'ai-filtering')) {
      await test.step('Run AI filtering', async () => {
        if (!createdJob || !authToken) {
          throw new Error(
            'AI filtering requires a created job and auth token. Set FULL_JOURNEY_JOB_ID when skipping jd-upload, or ensure job creation resolves.',
          );
        }
        const jobId = createdJob.id;
        const token = authToken;
        logJourneyStep('starting AI filtering', {
          jobId,
        });
        const aiFilteringResult = await runAiFilteringAndValidate(page, token, {
          apiBaseUrl,
          jobId,
          filterDescription:
            'Which of these candidates are from family run companies',
        });
        logJourneyStep('AI filtering completed', {
          plannedColumnNames: aiFilteringResult.plannedColumnNames,
          candidatesWithPlannedColumns:
            aiFilteringResult.candidatesWithPlannedColumns.length,
          sseUrls: aiFilteringResult.sseSnapshot.urls,
          sseSteps: aiFilteringResult.sseSnapshot.messages
            .map((message) => message.parsed?.step)
            .filter(Boolean),
        });
      });
    } else {
      logJourneyStep('skipping ai-filtering step');
    }

    if (shouldRunStep('all', 'orgchart')) {
      await test.step(
        'Fetch org chart from three sources and verify save + contact propagation to the created job',
        async () => {
          if (!createdJob || !authToken || !collector) {
            throw new Error(
              'Org chart verification requires a created job, auth token, and progress collector. Set FULL_JOURNEY_JOB_ID when skipping jd-upload, or ensure job creation resolves.',
            );
          }
          const jobId = createdJob.id;
          logJourneyStep('starting org chart source verification sequence', {
            jobId,
            sources: defaultOrgChartDatasourceRuns.map((run) => run.label),
          });
          const runSummaries = await runOrgChartDatasourceVerificationSequence(page, {
            appBaseUrl,
            apiBaseUrl,
            authToken,
            collector,
            companyQuery: 'briskpe',
            companyOptionName: 'briskpe',
            jobId,
            sourceRuns: defaultOrgChartDatasourceRuns,
          });

          logJourneyStep('org chart source verification sequence completed', {
            runSummaries,
          });

          expect(runSummaries.length).toBe(defaultOrgChartDatasourceRuns.length);
        },
      );
    } else {
      logJourneyStep('skipping orgchart step');
    }
  } finally {
    if (collector) {
      logJourneyStep('disposing org chart progress collector');
      collector.dispose();
    }
    logJourneyStep('spec finished');
  }
});
