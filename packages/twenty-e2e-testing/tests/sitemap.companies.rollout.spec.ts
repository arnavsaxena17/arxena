import { expect, test } from '@playwright/test';

const COUNTS_TO_TEST = [1, 5, 51];
const websiteBaseUrl = process.env.WEBSITE_BASE_URL || 'http://localhost:3002';
const expectedCount = parseInt(
  process.env.SITEMAP_EXPOSED_BATCH_COUNT || '1',
  10,
);

function getMaxExposedCount(count: number): number {
  if (count <= 0) return 0;
  const BATCH_SIZES = [500, 2500, 5000, 25000, 50000];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const limit =
      i < BATCH_SIZES.length
        ? BATCH_SIZES[i]
        : BATCH_SIZES[BATCH_SIZES.length - 1];
    total += limit;
  }
  return Math.min(total, 10000);
}

test.describe('Sitemap and companies rollout', () => {
  test('sitemap index has expected count', async ({ request }) => {
    const res = await request.get(`${websiteBaseUrl}/sitemap-main.xml`);
    expect(res.ok()).toBeTruthy();
    const xml = await res.text();
    const sitemapCount = (xml.match(/<sitemap>/g) || []).length;
    expect(sitemapCount).toBe(expectedCount);
  });

  test('sitemap-pages-001 has static routes and org chart URLs', async ({
    request,
  }) => {
    const res = await request.get(`${websiteBaseUrl}/sitemap-pages-001.xml`);
    expect(res.ok()).toBeTruthy();
    const xml = await res.text();
    const urlCount = (xml.match(/<url>/g) || []).length;
    const orgChartCount = (xml.match(/\/org-chart\//g) || []).length;
    expect(urlCount).toBeGreaterThanOrEqual(7);
    if (expectedCount >= 1) {
      expect(orgChartCount).toBe(500);
    }
  });

  test('sitemap out-of-range returns 404', async ({ request }) => {
    const outOfRange = expectedCount + 1;
    const id = String(outOfRange).padStart(3, '0');
    const res = await request.get(
      `${websiteBaseUrl}/sitemap-pages-${id}.xml`,
      { failOnStatusCode: false },
    );
    expect(res.status()).toBe(404);
  });

  test('sitemap-006 exists and has ~50k URLs when count>=6', async ({
    request,
  }) => {
    const res = await request.get(`${websiteBaseUrl}/sitemap-pages-006.xml`, {
      failOnStatusCode: false,
    });
    if (expectedCount >= 6) {
      expect(res.ok()).toBeTruthy();
      const xml = await res.text();
      const urlCount = (xml.match(/<url>/g) || []).length;
      expect(urlCount).toBeGreaterThan(1000);
    } else {
      expect(res.status()).toBe(404);
    }
  });

  test('sitemap-051 exists when count>=51', async ({ request }) => {
    const res = await request.get(`${websiteBaseUrl}/sitemap-pages-051.xml`, {
      failOnStatusCode: false,
    });
    if (expectedCount >= 51) {
      expect(res.ok()).toBeTruthy();
    } else {
      expect(res.status()).toBe(404);
    }
  });

  test('/companies index loads with letter links', async ({ page }) => {
    const res = await page.goto(`${websiteBaseUrl}/companies`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: /browse companies/i })).toBeVisible();
    const letterLinks = page.getByRole('link', { name: /^[a-z]$/i });
    await expect(letterLinks.first()).toBeVisible();
  });

  test('/companies/a-1 letter browse loads', async ({ page }) => {
    const res = await page.goto(`${websiteBaseUrl}/companies/a-1`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(res?.status()).toBe(200);
    const hasCompanies = await page
      .getByText(/no companies found/i)
      .isVisible()
      .catch(() => false);
    const hasList = await page.locator('a[href*="/org-chart/"]').first().isVisible().catch(() => false);
    expect(hasCompanies || hasList).toBeTruthy();
  });

  test('/companies/united-states geo browse loads', async ({ page }) => {
    const res = await page.goto(`${websiteBaseUrl}/companies/united-states`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    expect(res?.status()).toBe(200);
    const hasCompanies = await page
      .getByText(/no companies found/i)
      .isVisible()
      .catch(() => false);
    const hasList = await page.locator('a[href*="/org-chart/"]').first().isVisible().catch(() => false);
    expect(hasCompanies || hasList).toBeTruthy();
  });

  test('/companies/united-states/sales function browse loads', async ({
    page,
  }) => {
    const res = await page.goto(
      `${websiteBaseUrl}/companies/united-states/sales`,
      { waitUntil: 'domcontentloaded', timeout: 30_000 },
    );
    expect(res?.status()).toBe(200);
    const hasCompanies = await page
      .getByText(/no companies found/i)
      .isVisible()
      .catch(() => false);
    const hasList = await page.locator('a[href*="/org-chart/"]').first().isVisible().catch(() => false);
    expect(hasCompanies || hasList).toBeTruthy();
  });

  test('A-Z page counts per letter', async ({ request }) => {
    test.setTimeout(90_000);
    const maxExposed = getMaxExposedCount(expectedCount);
    if (maxExposed < 1) return;

    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    let totalPages = 0;
    let lettersWithMultiplePages = 0;

    for (const letter of letters) {
      let page = 1;
      let hasMore = true;
      let pagesForLetter = 0;

      while (hasMore) {
        const res = await request.get(
          `${websiteBaseUrl}/api/org-chart/companies/list?letter=${letter}&page=${page}&maxExposedCount=${maxExposed}`,
        );
        const data = (await res.json()) as {
          companyIds?: string[];
          hasMore?: boolean;
        };
        const companyIds = data.companyIds ?? [];
        hasMore = data.hasMore ?? false;
        pagesForLetter++;
        if (!hasMore) break;
        page++;
      }
      totalPages += pagesForLetter;
      if (pagesForLetter > 1) lettersWithMultiplePages++;
    }

    expect(totalPages).toBeGreaterThanOrEqual(26);
    if (expectedCount >= 5) {
      expect(lettersWithMultiplePages).toBeGreaterThan(0);
    }
  });

  test('sorting consistency: sitemap companies appear in letter browse', async ({
    request,
  }) => {
    if (expectedCount < 1) return;

    const sitemapRes = await request.get(
      `${websiteBaseUrl}/sitemap-pages-001.xml`,
    );
    const xml = await sitemapRes.text();
    const locMatches =
      xml.match(/<loc>[^<]*\/org-chart\/([^/<]+)/g) || [];
    const allSitemapIds = locMatches
      .map((m) => {
        const match = m.match(/\/org-chart\/([^/<]+)/);
        return match ? decodeURIComponent(match[1]).toLowerCase() : null;
      })
      .filter((id): id is string => !!id);
    const companyIdsFromSitemapStartingWithA = allSitemapIds.filter((id) =>
      id.startsWith('a'),
    );

    const maxExposed = getMaxExposedCount(expectedCount);
    const listRes = await request.get(
      `${websiteBaseUrl}/api/org-chart/companies/list?letter=a&page=1&maxExposedCount=${maxExposed}`,
    );
    const listData = (await listRes.json()) as { companyIds?: string[] };
    const letterBrowseIds = new Set(
      (listData.companyIds ?? []).map((id) => id.toLowerCase()),
    );

    const overlap = companyIdsFromSitemapStartingWithA.filter((id) =>
      letterBrowseIds.has(id),
    );
    expect(
      overlap.length,
      `Expected some sitemap companies (a*) in letter browse. Sitemap a*: ${companyIdsFromSitemapStartingWithA.slice(0, 5).join(', ')}; letter browse sample: ${Array.from(letterBrowseIds).slice(0, 5).join(', ')}`,
    ).toBeGreaterThan(0);
  });
});
