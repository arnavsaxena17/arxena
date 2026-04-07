import { expect, type Page } from '@playwright/test';

import {
  clickGenerateFullOrgChartFromPreview,
  clearCompanyOrgChartCache,
  expectPreviewTemplateVisible,
  fetchSavedCandidateByLinkedinUrl,
  normalizeLinkedinUrlForLookup,
  openJobsPageMenu,
  searchAndOpenOrgChartCompany,
  selectOrgChartDataSource,
  type OrgChartLinkedinCandidateSource,
  type OrgChartStreamEvent,
  waitForOrgChartLoaded,
} from './orgChartE2eHelpers';

export type OrgChartDatasourceRun = {
  label: string;
  source: OrgChartLinkedinCandidateSource;
  expectedLinkedinCompanyUrl?: string;
  expectQueuedSearch: boolean;
};

const logDatasourceStep = (
  step: string,
  detail?: Record<string, unknown>,
) => {
  const line = `[orgchart datasource e2e] ${step}`;
  if (detail) {
    console.log(line, JSON.stringify(detail));
    return;
  }

  console.log(line);
};

export const createLinkedinUnipileDatasourceRun = (): OrgChartDatasourceRun => ({
  label: 'LinkedIn (Unipile)',
  source: 'unipile',
  expectQueuedSearch: false,
});

export const createApifyDatasourceRun = (): OrgChartDatasourceRun => ({
  label: 'Apify',
  source: 'apify',
  expectQueuedSearch: true,
});

export const createXrayDatasourceRun = (): OrgChartDatasourceRun => ({
  label: 'X-Ray',
  source: 'linkedin_xray',
  expectedLinkedinCompanyUrl: 'https://www.linkedin.com/company/briskpe',
  expectQueuedSearch: true,
});

export const defaultOrgChartDatasourceRuns = [
  createLinkedinUnipileDatasourceRun(),
  createApifyDatasourceRun(),
  createXrayDatasourceRun(),
] as const;

const FRONTEND_ERROR_PATTERNS = [
  /LinkedIn \(Unipile\) is not connected/i,
  /Apify is not configured/i,
  /apify actor not present/i,
  /LinkedIn x-ray is not configured/i,
  /Org chart agent service is not available/i,
  /progress updates were not received/i,
  /failed to fetch candidates/i,
  /request failed/i,
  /org chart request failed/i,
];

const getRelevantProgressEvents = (
  events: OrgChartStreamEvent[],
  requestId: string,
) =>
  events.filter((event) => {
    const payloadRequestId = event.payload.requestId;
    return typeof payloadRequestId === 'string' && payloadRequestId === requestId;
  });

export const triggerOrgChartDatasourceRunFromJobsMenu = async (
  page: Page,
  run: OrgChartDatasourceRun,
) => {
  logDatasourceStep('open jobs page menu', { source: run.label });
  await openJobsPageMenu(page);

  logDatasourceStep('select data source', {
    source: run.label,
    candidateSource: run.source,
  });
  await selectOrgChartDataSource(page, run.source);

  logDatasourceStep('wait for org chart search request', { source: run.label });
  const responsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === 'POST' &&
      response.url().includes('/org-chart/search')
    );
  });

  logDatasourceStep('click generate full org chart', { source: run.label });
  await clickGenerateFullOrgChartFromPreview(page);

  const response = await responsePromise;
  const requestBody = response.request().postDataJSON() as Record<string, unknown>;
  const responseBody = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  expect(requestBody.candidateSource).toBe(run.source);

  if (run.expectedLinkedinCompanyUrl) {
    expect(
      String(requestBody.linkedinCompanyUrl ?? '').replace(/\/+$/, ''),
    ).toBe(run.expectedLinkedinCompanyUrl.replace(/\/+$/, ''));
  }

  logDatasourceStep('received org chart search response', {
    source: run.label,
    ok: response.ok(),
    status: response.status(),
    requestId:
      typeof requestBody.requestId === 'string' ? requestBody.requestId : null,
    queued:
      responseBody && typeof responseBody.queued === 'boolean'
        ? responseBody.queued
        : null,
    candidateSource:
      typeof requestBody.candidateSource === 'string'
        ? requestBody.candidateSource
        : null,
  });

  return {
    response,
    requestBody,
    responseBody,
  };
};

export const waitForDatasourceFrontendOutcome = async (
  page: Page,
  input: {
    run: OrgChartDatasourceRun;
    collector: { getEvents: () => OrgChartStreamEvent[] };
    requestId: string;
    responseBody?: Record<string, unknown> | null;
    timeoutMs?: number;
  },
) => {
  const timeoutMs = input.timeoutMs ?? 8 * 60 * 1000;
  const startedAt = Date.now();
  let sawApifyLogOnFrontend = false;
  logDatasourceStep('wait for frontend outcome', {
    source: input.run.label,
    requestId: input.requestId,
    timeoutMs,
  });

  while (Date.now() - startedAt < timeoutMs) {
    const relevantEvents = getRelevantProgressEvents(
      input.collector.getEvents(),
      input.requestId,
    );

    const eventNames = relevantEvents.map((event) => {
      const payloadEvent = event.payload.event;
      return typeof payloadEvent === 'string' ? payloadEvent : '';
    });
    const statusMessages = relevantEvents
      .filter((event) => event.payload.event === 'status')
      .map((event) => event.payload.data)
      .map((data) =>
        data && typeof data === 'object' && typeof data.message === 'string'
          ? data.message
          : '',
      )
      .filter(Boolean);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (
      input.run.source === 'apify' &&
      /Apify actor Vb6LZkh4EqRlR0Ka9|Apify run |Apify log:/i.test(bodyText)
    ) {
      sawApifyLogOnFrontend = true;
    }

    const lastErrorEvent = relevantEvents.find((event) => {
      const payloadEvent = event.payload.event;
      return payloadEvent === 'error';
    });

    if (lastErrorEvent) {
      logDatasourceStep('backend error event received', {
        source: input.run.label,
        requestId: input.requestId,
        eventCount: relevantEvents.length,
      });
      return {
        status: 'backend-error' as const,
        events: relevantEvents,
        sawApifyLogOnFrontend,
      };
    }

    if (eventNames.includes('complete')) {
      const completeEvent = relevantEvents.find(
        (event) => event.payload.event === 'complete',
      );
      const pageResultsEvents = relevantEvents.filter(
        (event) => event.payload.event === 'pageResults',
      );
      const completeData =
        completeEvent &&
        completeEvent.payload.data &&
        typeof completeEvent.payload.data === 'object'
          ? completeEvent.payload.data
          : null;
      const completeItems = Array.isArray(completeData?.items)
        ? completeData.items
        : [];
      const hasTerminalPayload =
        completeItems.length > 0 ||
        (completeData &&
          typeof completeData === 'object' &&
          'orgChart' in completeData &&
          completeData.orgChart &&
          typeof completeData.orgChart === 'object');

      expect(
        pageResultsEvents.length > 0 || hasTerminalPayload,
        `${input.run.label}: expected backend page-by-page updates or terminal payload`,
      ).toBeTruthy();

      logDatasourceStep('backend complete event received', {
        source: input.run.label,
        requestId: input.requestId,
        eventCount: relevantEvents.length,
        pageResultsEvents: pageResultsEvents.length,
        completeItems: completeItems.length,
        hasTerminalPayload,
      });

      return {
        status: 'success' as const,
        events: relevantEvents,
        sawApifyLogOnFrontend,
        statusMessages,
      };
    }

    const previewTemplate = page
      .getByText(
        /This is a preview template\. Generate the full org chart to see all employees\./i,
      )
      .first();
    const synchronousItems = Array.isArray(input.responseBody?.items)
      ? input.responseBody.items
      : [];

    if (
      synchronousItems.length > 0 &&
      !(await previewTemplate.isVisible().catch(() => false))
    ) {
      logDatasourceStep('synchronous org chart response visible in UI', {
        source: input.run.label,
        requestId: input.requestId,
        itemCount: synchronousItems.length,
      });
      return {
        status: 'success' as const,
        events: relevantEvents,
        sawApifyLogOnFrontend,
        statusMessages,
      };
    }

    for (const pattern of FRONTEND_ERROR_PATTERNS) {
      const message = page.getByText(pattern).first();
      if (await message.isVisible().catch(() => false)) {
        const text = (await message.textContent())?.trim() ?? '';
        logDatasourceStep('frontend error visible', {
          source: input.run.label,
          requestId: input.requestId,
          message: text,
          eventCount: relevantEvents.length,
        });
        return {
          status: 'frontend-error' as const,
          events: relevantEvents,
          message: text,
          sawApifyLogOnFrontend,
        };
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    `${input.run.label}: timed out waiting for frontend success/error outcome for request ${input.requestId}`,
  );
};

export const waitForCandidateSavedToJob = async (
  page: Page,
  input: {
    apiBaseUrl: string;
    authToken: string;
    linkedinUrl: string;
    jobId: string;
    timeoutMs?: number;
  },
) => {
  const timeoutMs = input.timeoutMs ?? 120_000;
  const startedAt = Date.now();
  const normalizedLinkedinUrl = normalizeLinkedinUrlForLookup(input.linkedinUrl);

  while (Date.now() - startedAt < timeoutMs) {
    const savedCandidate = await fetchSavedCandidateByLinkedinUrl({
      page,
      apiBaseUrl: input.apiBaseUrl,
      authToken: input.authToken,
      linkedinUrl: normalizedLinkedinUrl,
      jobId: input.jobId,
    });

    if (savedCandidate.ok && savedCandidate.candidate) {
      const candidateRecord = savedCandidate.candidate as { id?: string };

      return {
        saved: true,
        candidateIds: candidateRecord.id ? [candidateRecord.id] : [],
        jobIds: [input.jobId],
      };
    }

    await page.waitForTimeout(2_000);
  }

  throw new Error(
    `Timed out waiting for candidate ${normalizedLinkedinUrl} to be saved to job ${input.jobId}`,
  );
};

export const fetchContactsForCandidate = async (
  page: Page,
  input: {
    apiBaseUrl: string;
    authToken: string;
    linkedinUrl: string;
  },
) => {
  const normalizedLinkedinUrl = normalizeLinkedinUrlForLookup(input.linkedinUrl);

  return page.evaluate(
    async ({
      resolvedApiBaseUrl,
      token,
      linkedinUrl,
    }: {
      resolvedApiBaseUrl: string;
      token: string;
      linkedinUrl: string;
    }) => {
      const response = await fetch(
        `${resolvedApiBaseUrl.replace(/\/$/, '')}/contact-enrichment/fetch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            linkedinUrl,
            wantEmail: true,
            wantPhone: true,
          }),
        },
      );

      const text = await response.text().catch(() => '');
      let payload: unknown = null;

      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }

      const resultEntry =
        payload &&
        typeof payload === 'object' &&
        'results' in payload &&
        payload.results &&
        typeof payload.results === 'object'
          ? (payload.results as Record<string, { emails?: string[]; phones?: string[] }>)[
              linkedinUrl
            ]
          : null;
      const emails =
        resultEntry?.emails ??
        (payload &&
        typeof payload === 'object' &&
        'emails' in payload &&
        Array.isArray(payload.emails)
          ? payload.emails
          : []);
      const phones =
        resultEntry?.phones ??
        (payload &&
        typeof payload === 'object' &&
        'phones' in payload &&
        Array.isArray(payload.phones)
          ? payload.phones
          : []);

      return {
        ok: response.ok,
        status: response.status,
        text,
        emails,
        phones,
      };
    },
    {
      resolvedApiBaseUrl: input.apiBaseUrl,
      token: input.authToken,
      linkedinUrl: normalizedLinkedinUrl,
    },
  );
};

export const openFirstNodeDetailModal = async (page: Page) => {
  const modal = page.getByTestId('orgchart-result-modal').first();
  const directNode = page.locator('.orgchart-diagram [data-key]').first();

  if (await directNode.isVisible().catch(() => false)) {
    await directNode.dblclick();
    await modal.waitFor({ state: 'visible', timeout: 60_000 });
    return modal;
  }

  const canvas = page.locator('.orgchart-diagram canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 60_000 });
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (!box) {
    throw new Error('Org chart canvas bounding box not available');
  }

  const hitPoints = [
    { xRatio: 0.5, yRatio: 0.16 },
    { xRatio: 0.52, yRatio: 0.18 },
    { xRatio: 0.48, yRatio: 0.2 },
    { xRatio: 0.5, yRatio: 0.22 },
  ];

  for (const hitPoint of hitPoints) {
    await page.mouse.dblclick(
      Math.floor(box.x + box.width * hitPoint.xRatio),
      Math.floor(box.y + box.height * hitPoint.yRatio),
    );
    await modal.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    if (await modal.isVisible().catch(() => false)) {
      return modal;
    }
  }

  throw new Error('Unable to open an org chart node detail modal');
};

export const loadLeadershipOrgChartForVerification = async (page: Page) => {
  const leadershipButton = page
    .getByRole('button', { name: /leadership org chart/i })
    .first();
  await leadershipButton.waitFor({ state: 'visible', timeout: 60_000 });

  const enrichedResponsePromise = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/org-chart/') &&
        response.url().includes('/enriched'),
      { timeout: 120_000 },
    )
    .catch(() => null);

  await leadershipButton.click();

  const enrichedResponse = await enrichedResponsePromise;
  expect(enrichedResponse).toBeTruthy();
  expect(enrichedResponse?.ok()).toBeTruthy();

  await page
    .getByRole('button', { name: /loading leadership org chart/i })
    .first()
    .waitFor({ state: 'hidden', timeout: 120_000 })
    .catch(() => {});
};

export const extractFirstCandidateFromNodeModal = async (
  modal: ReturnType<Page['getByTestId']>,
) => {
  const firstRow = modal.locator('[data-testid^="orgchart-result-item-"]').first();
  await firstRow.waitFor({ state: 'visible', timeout: 60_000 });

  const fullName =
    (await firstRow.textContent().catch(() => null))?.trim()?.split('\n')[0] ?? '';
  const linkedinUrl =
    (await firstRow
      .locator('a[href*="linkedin.com/in/"], a[href*="linkedin.com/pub/"]')
      .first()
      .getAttribute('href')
      .catch(() => null)) ?? '';

  expect(linkedinUrl).toBeTruthy();

  return {
    row: firstRow,
    fullName,
    linkedinUrl,
  };
};

export const fetchFirstAvailableContactFromModal = async (
  page: Page,
  modal: ReturnType<Page['getByTestId']>,
) => {
  const rows = modal.locator('[data-testid^="orgchart-result-item-"]');
  const count = await rows.count();

  for (let index = 0; index < Math.min(count, 5); index += 1) {
    const row = rows.nth(index);
    const linkedinUrl =
      (await row
        .locator('a[href*="linkedin.com/in/"], a[href*="linkedin.com/pub/"]')
        .first()
        .getAttribute('href')
        .catch(() => null)) ?? '';

    if (!linkedinUrl) {
      continue;
    }

    const fetchButton = row.getByRole('button', { name: /fetch contacts/i }).first();
    if (!(await fetchButton.isVisible().catch(() => false))) {
      continue;
    }

    await fetchButton.click();

    const startedAt = Date.now();
    while (Date.now() - startedAt < 90_000) {
      const text = (await row.textContent().catch(() => '')) ?? '';

      if (/Email:|Phone:/i.test(text)) {
        const emailMatch = text.match(/Email:\s*([^·\n]+)/i);
        const phoneMatch = text.match(/Phone:\s*([^\n]+)/i);

        return {
          linkedinUrl,
          email: emailMatch?.[1]?.trim() ?? '',
          phone: phoneMatch?.[1]?.trim() ?? '',
        };
      }

      if (/No contacts have been fetched/i.test(text)) {
        break;
      }

      await page.waitForTimeout(1_000);
    }
  }

  throw new Error('No org chart candidate returned contact details from waterfall');
};

export const runOrgChartDatasourceVerificationSequence = async (
  page: Page,
  input: {
    appBaseUrl?: string;
    apiBaseUrl: string;
    authToken: string;
    collector: { getEvents: () => OrgChartStreamEvent[] };
    companyQuery: string;
    companyOptionName: string;
    jobId: string;
    sourceRuns: readonly OrgChartDatasourceRun[];
  },
) => {
  const runSummaries: Array<Record<string, unknown>> = [];
  let selectedCompany:
    | {
        companyId: string | null;
        companyName: string | null;
      }
    | undefined;

  for (const run of input.sourceRuns) {
    try {
      const jobsUrl =
        input.appBaseUrl ??
        `${new URL(page.url() || 'http://testing-arxena.localhost:3001').origin}/jobs`;
      await page.goto(jobsUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });

      selectedCompany = await searchAndOpenOrgChartCompany(page, {
        companyQuery: input.companyQuery,
        companyOptionName: input.companyOptionName,
      });

      await waitForOrgChartLoaded(page);
      await expectPreviewTemplateVisible(page);

      const triggerResult = await triggerOrgChartDatasourceRunFromJobsMenu(page, run);
      const requestId = String(triggerResult.requestBody.requestId ?? '');
      expect(requestId, `${run.label}: org chart search should include a requestId`).toBeTruthy();

      if (!triggerResult.response.ok()) {
      const outcome = await waitForDatasourceFrontendOutcome(page, {
        run,
        collector: input.collector,
        requestId,
        timeoutMs: 60_000,
        responseBody: triggerResult.responseBody,
      });

        expect(
          outcome.status === 'frontend-error' || outcome.status === 'backend-error',
          `${run.label}: failed requests should be surfaced to the frontend`,
        ).toBe(true);

        runSummaries.push({
          source: run.label,
          status: outcome.status,
          message: 'message' in outcome ? outcome.message : undefined,
        });
        continue;
      }

      if (run.expectQueuedSearch) {
        expect(
          triggerResult.responseBody?.queued,
          `${run.label}: expected queued async org chart search`,
        ).toBe(true);
      }

      const outcome = await waitForDatasourceFrontendOutcome(page, {
        run,
        collector: input.collector,
        requestId,
        responseBody: triggerResult.responseBody,
      });

      if (outcome.status !== 'success') {
        expect(
          outcome.status === 'frontend-error' || outcome.status === 'backend-error',
          `${run.label}: failures should be surfaced to the frontend`,
        ).toBe(true);

        runSummaries.push({
          source: run.label,
          status: outcome.status,
          message: 'message' in outcome ? outcome.message : undefined,
        });
        continue;
      }

      const pageResultsEvents = outcome.events.filter(
        (event) => event.payload.event === 'pageResults',
      );
      const paginationEvents = outcome.events.filter(
        (event) =>
          event.payload.event === 'paginationInfo' ||
          (event.payload.event === 'pageResults' &&
            typeof event.payload.data === 'object' &&
            event.payload.data !== null &&
          'totalPages' in event.payload.data),
      );
      const synchronousItems = Array.isArray(triggerResult.responseBody?.items)
        ? triggerResult.responseBody.items
        : [];
      const usedSynchronousResponse = synchronousItems.length > 0;
      const statusMessages = 'statusMessages' in outcome ? outcome.statusMessages : [];

      expect(
        pageResultsEvents.length > 0 || usedSynchronousResponse,
        `${run.label}: expected backend progress events or a synchronous org chart response`,
      ).toBe(true);
      expect(
        paginationEvents.length > 0 || usedSynchronousResponse,
        `${run.label}: expected pagination details or a synchronous org chart response`,
      ).toBe(true);

      await expect(
        page
          .getByText(
            /This is a preview template\. Generate the full org chart to see all employees\./i,
          )
          .first(),
      ).toBeHidden({ timeout: 120_000 });

      if (run.source !== 'unipile') {
        if (run.source === 'apify') {
          expect(
            statusMessages.some((message) =>
              /Apify actor Vb6LZkh4EqRlR0Ka9|Apify run |Apify log:/i.test(message),
            ),
            'Apify: expected backend progress events to include actor/run/log messages',
          ).toBe(true);
          expect(
            'sawApifyLogOnFrontend' in outcome && outcome.sawApifyLogOnFrontend,
            'Apify: expected frontend to surface relayed Apify log messages',
          ).toBe(true);
        }

        runSummaries.push({
          source: run.label,
          status: 'success',
          pageResultsEvents: pageResultsEvents.length,
          paginationEvents: paginationEvents.length,
          synchronousItems: usedSynchronousResponse ? synchronousItems.length : 0,
          apifyStatusMessages: run.source === 'apify' ? statusMessages : undefined,
        });
        continue;
      }

      await loadLeadershipOrgChartForVerification(page);
      const nodeModal = await openFirstNodeDetailModal(page);
      const firstCandidate = await extractFirstCandidateFromNodeModal(nodeModal);

      await expect(
        nodeModal.getByTestId('orgchart-results-add-to-job').first(),
      ).toBeVisible({ timeout: 30_000 });
      await nodeModal.getByTestId('orgchart-results-add-to-job').first().click();

      await page
        .getByTestId('orgchart-add-results-job-mode-existing')
        .first()
        .check();
      await page
        .getByTestId('orgchart-add-results-existing-job-select')
        .first()
        .selectOption(input.jobId);
      await page.getByTestId('orgchart-add-results-submit').first().click();

      const savedEntry = await waitForCandidateSavedToJob(page, {
        apiBaseUrl: input.apiBaseUrl,
        authToken: input.authToken,
        linkedinUrl: firstCandidate.linkedinUrl,
        jobId: input.jobId,
      });

      const contactFetch = await fetchContactsForCandidate(page, {
        apiBaseUrl: input.apiBaseUrl,
        authToken: input.authToken,
        linkedinUrl: firstCandidate.linkedinUrl,
      });
      const insufficientContactCredits =
        contactFetch.status === 403 &&
        /insufficient contact credits/i.test(contactFetch.text);

      const fetchedContact = insufficientContactCredits
        ? {
            linkedinUrl: normalizeLinkedinUrlForLookup(firstCandidate.linkedinUrl),
            email: '',
            phone: '',
          }
        : {
            linkedinUrl: normalizeLinkedinUrlForLookup(firstCandidate.linkedinUrl),
            email:
              Array.isArray(contactFetch.emails) && contactFetch.emails.length > 0
                ? String(contactFetch.emails[0] ?? '')
                : '',
            phone:
              Array.isArray(contactFetch.phones) && contactFetch.phones.length > 0
                ? String(contactFetch.phones[0] ?? '')
                : '',
          };
      const savedCandidate = await fetchSavedCandidateByLinkedinUrl({
        page,
        apiBaseUrl: input.apiBaseUrl,
        authToken: input.authToken,
        linkedinUrl: fetchedContact.linkedinUrl,
        jobId: input.jobId,
      });

      expect(savedCandidate.ok).toBeTruthy();
      expect(savedCandidate.candidate).toBeTruthy();

      const candidateRecord = savedCandidate.candidate as {
        email?: { primaryEmail?: string };
        phoneNumber?: { primaryPhoneNumber?: string };
        jobs?:
          | Array<{ id?: string; name?: string }>
          | { id?: string; name?: string }
          | null;
      };
      const savedJobs = Array.isArray(candidateRecord.jobs)
        ? candidateRecord.jobs
        : candidateRecord.jobs
          ? [candidateRecord.jobs]
          : [];

      expect(
        savedJobs.some((job) => job.id === input.jobId),
      ).toBe(true);

      if (fetchedContact.email) {
        expect(candidateRecord.email?.primaryEmail ?? '').toBe(fetchedContact.email);
      }

      if (fetchedContact.phone) {
        const savedPhoneDigits = (
          candidateRecord.phoneNumber?.primaryPhoneNumber ?? ''
        ).replace(/\D+/g, '');
        const fetchedPhoneDigits = fetchedContact.phone.replace(/\D+/g, '');
        expect(savedPhoneDigits).toContain(fetchedPhoneDigits);
      }

      runSummaries.push({
        source: run.label,
        status: 'success',
        pageResultsEvents: pageResultsEvents.length,
        paginationEvents: paginationEvents.length,
        synchronousItems: usedSynchronousResponse ? synchronousItems.length : 0,
        savedCandidateIds: savedEntry.candidateIds ?? [],
        linkedinUrl: fetchedContact.linkedinUrl,
        contactVerificationStatus: insufficientContactCredits
          ? 'skipped-insufficient-credits'
          : fetchedContact.email || fetchedContact.phone
            ? 'verified'
            : 'no-contacts-returned',
        savedEmail: candidateRecord.email?.primaryEmail ?? null,
        savedPhone: candidateRecord.phoneNumber?.primaryPhoneNumber ?? null,
      });

      await page.keyboard.press('Escape').catch(() => {});
    } finally {
      if (selectedCompany) {
        await clearCompanyOrgChartCache({
          page,
          apiBaseUrl: input.apiBaseUrl,
          authToken: input.authToken,
          companyId: selectedCompany.companyId,
          companyName: selectedCompany.companyName,
        }).catch(() => undefined);
      }
    }
  }

  return runSummaries;
};
