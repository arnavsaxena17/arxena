import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import {
  collectDeepStrings,
  ensureAuthenticatedJobsPage,
  getAuthToken,
  saveStorageState,
  testingArxenaStorageStatePath,
} from '../lib/utils/orgChartE2eHelpers';

test.describe('Batliboi org chart session flow', () => {
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
  const companyQuery = process.env.ARXENA_E2E_COMPANY_QUERY || 'batliboi';
  const companyOptionName =
    process.env.ARXENA_E2E_COMPANY_OPTION || 'batliboi ltd';

  const searchAndOpenCompany = async (page: Page) => {
    const companySearchInput = page
      .getByPlaceholder("Search any company's org chart...")
      .first();
    await expect(companySearchInput).toBeVisible({ timeout: 60_000 });

    const autocompleteResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/org-chart/companies/autocomplete')
      );
    });

    await companySearchInput.click();
    await companySearchInput.fill('');
    await companySearchInput.fill(companyQuery);

    const autocompleteResponse = await autocompleteResponsePromise;
    expect(autocompleteResponse.ok()).toBeTruthy();

    const autocompletePayload = (await autocompleteResponse.json()) as {
      result?: Array<{ name?: string; meta?: { id?: string } }>;
    };
    const matchedCompany =
      autocompletePayload.result?.find((result) =>
        new RegExp(companyOptionName, 'i').test(result.name ?? ''),
      ) ?? null;

    const companyOption = page
      .getByRole('option', { name: new RegExp(companyOptionName, 'i') })
      .first();
    await companyOption.waitFor({ state: 'visible', timeout: 60_000 });
    await companyOption.click();

    return {
      companyId: matchedCompany?.meta?.id ?? null,
      companyName: matchedCompany?.name ?? companyOptionName,
    };
  };

  const waitForOrgChartLoaded = async (page: Page) => {
    const diagram = page.locator('.orgchart-diagram').first();
    const canvas = page.locator('.orgchart-diagram canvas').first();

    await diagram.waitFor({ state: 'visible', timeout: 90_000 });
    await canvas.waitFor({ state: 'visible', timeout: 90_000 });

    await page.getByText(/loading org chart/i).first().waitFor({
      state: 'hidden',
      timeout: 90_000,
    }).catch(() => {});

    return { diagram, canvas };
  };

  const clearCompanyCache = async (
    page: Page,
    context: BrowserContext,
    company: { companyId: string | null; companyName: string | null },
  ) => {
    const canvas = page.locator('.orgchart-diagram canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 60_000 });

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const snackbar = page.getByText(/cleared org chart cache for /i).first();
    const attempts = [
      { xRatio: 0.78, yRatio: 0.22, menuX: 110, menuY: 78 },
      { xRatio: 0.68, yRatio: 0.3, menuX: 115, menuY: 82 },
      { xRatio: 0.55, yRatio: 0.18, menuX: 110, menuY: 80 },
    ];

    for (const attempt of attempts) {
      await page.mouse.click(
        Math.floor(box.x + box.width * attempt.xRatio),
        Math.floor(box.y + box.height * attempt.yRatio),
        { button: 'right' },
      );
      await page.waitForTimeout(500);
      await page.mouse.click(
        Math.floor(box.x + box.width * attempt.xRatio) + attempt.menuX,
        Math.floor(box.y + box.height * attempt.yRatio) + attempt.menuY,
      );
      await snackbar.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
      if (await snackbar.isVisible().catch(() => false)) {
        return;
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }

    expect(company.companyId).toBeTruthy();

    const authToken = await getAuthToken(context);
    const fallbackResult = await page.evaluate(
      async ({ resolvedApiBaseUrl, token, companyId, companyName }) => {
        const response = await fetch(
          `${resolvedApiBaseUrl.replace(/\/$/, '')}/org-chart/company-cache/clear`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ companyId, companyName }),
          },
        );

        return {
          ok: response.ok,
          status: response.status,
        };
      },
      {
        resolvedApiBaseUrl: apiBaseUrl,
        token: authToken,
        companyId: company.companyId,
        companyName: company.companyName,
      },
    );

    expect(fallbackResult.ok).toBeTruthy();
  };

  const loadLeadershipOrgChart = async (page: Page) => {
    const leadershipButton = page
      .getByRole('button', { name: /leadership org chart/i })
      .first();
    await leadershipButton.waitFor({ state: 'visible', timeout: 60_000 });

    const enrichedResponsePromise = page
      .waitForResponse((response) => {
        return (
          response.request().method() === 'GET' &&
          response.url().includes('/org-chart/') &&
          response.url().includes('/enriched')
        );
      }, { timeout: 120_000 })
      .catch(() => null);

    await leadershipButton.click();

    const enrichedResponse = await enrichedResponsePromise;
    expect(enrichedResponse).toBeTruthy();
    expect(enrichedResponse?.ok()).toBeTruthy();

    await page.getByRole('button', { name: /loading leadership org chart/i }).first()
      .waitFor({ state: 'hidden', timeout: 120_000 })
      .catch(() => {});

    return enrichedResponse?.json().catch(() => null);
  };

  test('reuses saved session and validates batliboi leadership flow', async ({
    page,
    context,
  }) => {
    test.setTimeout(10 * 60 * 1000);

    await ensureAuthenticatedJobsPage(page, context, {
      baseUrl: appBaseUrl,
      email,
      password,
    });

    const selectedCompany = await searchAndOpenCompany(page);
    await waitForOrgChartLoaded(page);

    await clearCompanyCache(page, context, selectedCompany);
    await searchAndOpenCompany(page);
    await waitForOrgChartLoaded(page);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    await waitForOrgChartLoaded(page);

    const leadershipPayload = await loadLeadershipOrgChart(page);
    const payloadText = collectDeepStrings(leadershipPayload).join(' ').toLowerCase();
    expect(payloadText).toContain('ceo leadership');
    expect(payloadText).toContain('nirmal bhogilal');
    expect(payloadText).toContain('kabir bhogilal');

    const previewBadgeCount = await page.getByText(/^Preview$/i).count();
    expect(previewBadgeCount).toBe(0);

    const canvas = page.locator('.orgchart-diagram canvas').first();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const modal = page.locator('[role="dialog"], .modal').first();
    const ceoNodeHitPoints = [
      { xRatio: 0.5, yRatio: 0.16 },
      { xRatio: 0.52, yRatio: 0.18 },
      { xRatio: 0.54, yRatio: 0.2 },
      { xRatio: 0.5, yRatio: 0.22 },
      { xRatio: 0.48, yRatio: 0.2 },
    ];

    for (const hitPoint of ceoNodeHitPoints) {
      await page.mouse.dblclick(
        Math.floor(box.x + box.width * hitPoint.xRatio),
        Math.floor(box.y + box.height * hitPoint.yRatio),
      );

      await modal.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
      if (await modal.isVisible().catch(() => false)) {
        break;
      }
    }

    await modal.waitFor({ state: 'visible', timeout: 60_000 });
    await modal.getByText(/Kabir Bhogilal/i).first().waitFor({
      state: 'visible',
      timeout: 60_000,
    });

    await modal.getByRole('button', { name: /^close$/i }).first().click();
    await modal.waitFor({ state: 'hidden', timeout: 30_000 });

    await saveStorageState(context);
  });
});
