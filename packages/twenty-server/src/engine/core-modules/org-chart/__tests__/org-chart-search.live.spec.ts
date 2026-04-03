/**
 * Live end-to-end checks against a running twenty-server, real Unipile, Python org-chart agent,
 * Redis, and optional S3. Skipped unless ORGCHART_LIVE_E2E=1.
 *
 * Prerequisites (typical):
 *   - Server running with same .env as this process (REDIS_URL, STORAGE_*, UNIPILE_*, ARXENA_SITE_URL, …)
 *   - ORGCHART_LIVE_BASE_URL=http://localhost:3000
 *   - ORGCHART_LIVE_API_TOKEN=<Bearer JWT used by the app>
 *   - Optional: ORGCHART_LIVE_UNIPILE_ACCOUNT_ID, ORGCHART_LIVE_COMPANY_NAME, ORGCHART_LIVE_LINKEDIN_COMPANY_URL
 *   - Optional: ORGCHART_LIVE_BUSINESS_DIVISION_QUERY (defaults to a short textile-machinery example)
 *
 * Run:
 *   ORGCHART_LIVE_E2E=1 ORGCHART_LIVE_BASE_URL=http://localhost:3000 ORGCHART_LIVE_API_TOKEN=... \
 *     yarn nx run twenty-server:test --testPathPattern=org-chart-search.live --skip-nx-cache
 *
 * Apify smoke (queued job only, no completion wait):
 *   ORGCHART_LIVE_EXERCISE_APIFY=1 (requires APIFY_API_TOKEN on server)
 */

import { Test } from '@nestjs/testing';

import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { FileStorageModule } from 'src/engine/core-modules/file-storage/file-storage.module';
import { fileStorageModuleFactory } from 'src/engine/core-modules/file-storage/file-storage.module-factory';
import { OrgChartCacheService } from 'src/engine/core-modules/org-chart/services/orgchart-cache.service';
import { OrgChartS3Service } from 'src/engine/core-modules/org-chart/services/orgchart-s3.service';
import { PythonOrgChartService } from 'src/engine/core-modules/org-chart/services/python-org-chart.service';

const LIVE = process.env.ORGCHART_LIVE_E2E === '1';

const describeLive = LIVE ? describe : describe.skip;

describeLive('org-chart search live E2E (Unipile + cache + S3)', () => {
  jest.setTimeout(600_000);

  const baseUrl = (process.env.ORGCHART_LIVE_BASE_URL ?? '').replace(/\/+$/, '');
  const apiToken = process.env.ORGCHART_LIVE_API_TOKEN ?? '';
  const companyName = process.env.ORGCHART_LIVE_COMPANY_NAME ?? 'BRISKPE';
  const linkedinCompanyUrl =
    process.env.ORGCHART_LIVE_LINKEDIN_COMPANY_URL ??
    'https://www.linkedin.com/company/briskpe/';
  const accountQuery = process.env.ORGCHART_LIVE_UNIPILE_ACCOUNT_ID?.trim()
    ? `?account_id=${encodeURIComponent(process.env.ORGCHART_LIVE_UNIPILE_ACCOUNT_ID.trim())}`
    : '';

  let orgChartCache: OrgChartCacheService;
  let orgChartS3: OrgChartS3Service;

  beforeAll(async () => {
    if (!baseUrl || !apiToken) {
      throw new Error(
        'ORGCHART_LIVE_BASE_URL and ORGCHART_LIVE_API_TOKEN are required when ORGCHART_LIVE_E2E=1',
      );
    }

    const python = new PythonOrgChartService();
    if (python.usesHttpOrgChartBuild()) {
      const ok = await python.isOrgChartAgentReachable();
      if (!ok) {
        throw new Error(
          `Python not connected: failed. ${PythonOrgChartService.ORG_CHART_AGENT_UNAVAILABLE_MESSAGE}`,
        );
      }
    }

    const cacheModule = await Test.createTestingModule({
      imports: [EnvironmentModule, CacheStorageModule],
      providers: [OrgChartCacheService],
    }).compile();
    orgChartCache = cacheModule.get(OrgChartCacheService);

    const s3Module = await Test.createTestingModule({
      imports: [
        EnvironmentModule,
        FileStorageModule.forRootAsync({
          imports: [EnvironmentModule],
          useFactory: fileStorageModuleFactory,
          inject: [EnvironmentService],
        }),
      ],
      providers: [OrgChartS3Service],
    }).compile();
    orgChartS3 = s3Module.get(OrgChartS3Service);
  });

  const searchUrl = () => `${baseUrl}/org-chart/search${accountQuery}`;

  const searchBody = () => ({
    rawQuery: `people at ${companyName}`,
    cleanedQuery: `people at ${companyName}`,
    companyName,
    mode: 'entire_company' as const,
    searchType: 'classic' as const,
    linkedinCompanyUrl,
  });

  const authHeaders = (): Record<string, string> => ({
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  });

  it('clears Redis + S3, cold fetch then Redis orgchart cache hit (second request skips Unipile)', async () => {
    await orgChartCache.invalidateEntireCompanyClassicCaches({
      companyName,
      companyId: undefined,
    });
    const s3Key = orgChartS3.persistedCompanyFolderKey(undefined, companyName);
    await orgChartS3.deletePersistedCompanyFolder(s3Key);

    const cold = await fetch(searchUrl(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(searchBody()),
    });
    const coldJson = (await cold.json()) as Record<string, unknown>;
    expect(cold.ok).toBe(true);
    expect(coldJson.success).toBe(true);
    expect(coldJson.isCached).not.toBe(true);
    expect(coldJson.orgChart).toBeDefined();

    const fromS3 = await orgChartS3.getOrgChart(s3Key);
    expect(fromS3).not.toBeNull();

    const warm = await fetch(searchUrl(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(searchBody()),
    });
    const warmJson = (await warm.json()) as Record<string, unknown>;
    expect(warm.ok).toBe(true);
    expect(warmJson.success).toBe(true);
    expect(warmJson.isCached).toBe(true);
    expect(warmJson.cacheSource).toBe('orgchart');
  });

  it('business_division_map returns success with org chart (Unipile + LLM + Python)', async () => {
    const divisionQuery =
      process.env.ORGCHART_LIVE_BUSINESS_DIVISION_QUERY?.trim() ||
      'Map the textile machinery division at this company.';

    const res = await fetch(searchUrl(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        rawQuery: `Map business division at ${companyName}. User request: ${divisionQuery}`,
        cleanedQuery: `Map business division at ${companyName}. User request: ${divisionQuery}`,
        companyName,
        mode: 'business_division_map' as const,
        searchType: 'classic' as const,
        linkedinCompanyUrl,
        businessDivisionRawQuery: divisionQuery,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    expect(res.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.orgChart).toBeDefined();
    expect(Array.isArray(json.items)).toBe(true);
  });
});

const describeApify = LIVE && process.env.ORGCHART_LIVE_EXERCISE_APIFY === '1'
  ? describe
  : describe.skip;

describeApify('org-chart Apify live smoke (queued)', () => {
  jest.setTimeout(60_000);

  const baseUrl = (process.env.ORGCHART_LIVE_BASE_URL ?? '').replace(/\/+$/, '');
  const apiToken = process.env.ORGCHART_LIVE_API_TOKEN ?? '';
  const companyName = process.env.ORGCHART_LIVE_COMPANY_NAME ?? 'BRISKPE';
  const linkedinCompanyUrl =
    process.env.ORGCHART_LIVE_LINKEDIN_COMPANY_URL ??
    'https://www.linkedin.com/company/briskpe/';

  it('returns queued=true when candidateSource is apify', async () => {
    if (!baseUrl || !apiToken) {
      throw new Error(
        'ORGCHART_LIVE_BASE_URL and ORGCHART_LIVE_API_TOKEN are required',
      );
    }
    const res = await fetch(`${baseUrl}/org-chart/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rawQuery: `people at ${companyName}`,
        cleanedQuery: `people at ${companyName}`,
        companyName,
        mode: 'entire_company',
        searchType: 'classic',
        linkedinCompanyUrl,
        candidateSource: 'apify',
        apifyMaxItems: 50,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    expect(res.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.queued).toBe(true);
    expect(json.candidateSource).toBe('apify');
  });
});
