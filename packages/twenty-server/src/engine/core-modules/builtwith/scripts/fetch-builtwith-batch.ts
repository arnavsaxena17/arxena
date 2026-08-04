/**
 * Fetch BuiltWith detailed profiles via Bright Data residential proxy.
 *
 * Usage (from packages/twenty-server):
 *   export BRIGHT_DATA_API_KEY=...
 *   npx tsx src/engine/core-modules/builtwith/scripts/fetch-builtwith-batch.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

import axios from 'axios';
import https from 'https';
import { config } from 'dotenv';

import type { BuiltWithDomainResult } from '../types/builtwith.types';
import { normalizeBuiltWithDomain } from '../utils/normalize-builtwith-domain.util';
import {
  isBuiltWithChallengeOrEmptyPage,
  isBuiltWithNotFoundPage,
  parseBuiltWithDetailedTechnologies,
  parseBuiltWithProfileMeta,
} from '../utils/parse-builtwith-html.util';

config({ path: join(process.cwd(), '.env') });

const DOMAINS = [
  'adani.com',
  'google.com',
  'zoominfo.com',
  'lusha.com',
  'arxena.com',
  'microsoft.com',
  'hubspot.com',
  'linkedin.com',
  'apollo.io',
  'twenty.com',
  'stripe.com',
  'notion.so',
];

const CONCURRENCY = 3;
const PROXY_HOST = process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_HOST || 'brd.superproxy.io';
const PROXY_PORT = Number(process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_PORT ?? 33335);

const resolveResidentialAuth = async (): Promise<{
  username: string;
  password: string;
}> => {
  if (
    process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_USERNAME &&
    process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_PASSWORD
  ) {
    return {
      username: process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_USERNAME,
      password: process.env.BRIGHT_DATA_RESIDENTIAL_PROXY_PASSWORD,
    };
  }

  const apiKey = process.env.BRIGHT_DATA_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      'Set BRIGHT_DATA_API_KEY or BRIGHT_DATA_RESIDENTIAL_PROXY_USERNAME/PASSWORD',
    );
  }

  const zone =
    process.env.BRIGHT_DATA_RESIDENTIAL_ZONE?.trim() || 'residential_proxy1';
  const status = await axios.get('https://api.brightdata.com/status', {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 30_000,
  });
  // Prefer account id from Sophie/docs; fall back to customer slug.
  const accountId =
    process.env.BRIGHT_DATA_ACCOUNT_ID?.trim() || 'hl_c5a2ddf1';
  const zoneInfo = (
    await axios.get(`https://api.brightdata.com/zone?zone=${zone}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 30_000,
    })
  ).data as { password?: string | string[] };

  const password = Array.isArray(zoneInfo.password)
    ? zoneInfo.password[0]
    : zoneInfo.password;

  if (!password) {
    throw new Error(`No password returned for zone ${zone}`);
  }

  console.log(
    `Resolved residential auth for customer=${status.data?.customer} zone=${zone}`,
  );

  return {
    username: `brd-customer-${accountId}-zone-${zone}`,
    password,
  };
};

const fetchHtml = async (
  auth: { username: string; password: string },
  url: string,
): Promise<{ status: number; body: string }> => {
  const response = await axios.get<string>(url, {
    proxy: {
      protocol: 'http',
      host: PROXY_HOST,
      port: PROXY_PORT,
      auth,
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    responseType: 'text',
    transformResponse: [(data) => String(data)],
    timeout: 120_000,
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
    validateStatus: () => true,
  });

  return { status: response.status, body: String(response.data) };
};

const fetchDomain = async (
  auth: { username: string; password: string },
  domainInput: string,
): Promise<BuiltWithDomainResult> => {
  const domain = normalizeBuiltWithDomain(domainInput);
  const profileUrl = `https://builtwith.com/${domain}`;
  const detailedUrl = `https://builtwith.com/detailed/${domain}`;
  const errors: string[] = [];
  const fetchedAt = new Date().toISOString();

  console.log(`Fetching detailed ${detailedUrl}`);
  const detailed = await fetchHtml(auth, detailedUrl);

  if (
    detailed.status >= 400 ||
    isBuiltWithNotFoundPage(detailed.body) ||
    isBuiltWithChallengeOrEmptyPage(detailed.body)
  ) {
    throw new Error(
      `Detailed page failed status=${detailed.status} challenge=${isBuiltWithChallengeOrEmptyPage(detailed.body)} notFound=${isBuiltWithNotFoundPage(detailed.body)} len=${detailed.body.length}`,
    );
  }

  const detailedTechnologies = parseBuiltWithDetailedTechnologies(
    detailed.body,
  );
  const meta = parseBuiltWithProfileMeta(detailed.body, detailed.body);
  const title =
    detailed.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ||
    null;

  // Profile page is often captcha-gated; try but don't fail the lookup.
  try {
    console.log(`Fetching profile ${profileUrl}`);
    const profile = await fetchHtml(auth, profileUrl);

    if (
      profile.status < 400 &&
      !isBuiltWithChallengeOrEmptyPage(profile.body) &&
      !isBuiltWithNotFoundPage(profile.body)
    ) {
      const profileMeta = parseBuiltWithProfileMeta(
        profile.body,
        detailed.body,
      );

      return {
        domain,
        profileUrl,
        detailedUrl,
        title:
          profile.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ||
          title,
        meta: profileMeta,
        categories: [],
        detailedTechnologies,
        fetchedAt,
        errors,
      };
    }

    errors.push(
      `Profile skipped status=${profile.status} challenge=${isBuiltWithChallengeOrEmptyPage(profile.body)}`,
    );
  } catch (error) {
    errors.push(
      `Profile fetch failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  return {
    domain,
    profileUrl,
    detailedUrl,
    title,
    meta,
    categories: [],
    detailedTechnologies,
    fetchedAt,
    errors,
  };
};

const runPool = async <TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> => {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;

        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }),
  );

  return results;
};

const main = async () => {
  const auth = await resolveResidentialAuth();
  const results = await runPool(DOMAINS, CONCURRENCY, async (domain) => {
    try {
      const result = await fetchDomain(auth, domain);

      console.log(
        `OK ${domain}: detailed=${result.detailedTechnologies.length} live=${result.detailedTechnologies.filter((technology) => !technology.isHistorical).length} spend=${result.meta.technologySpend ?? 'n/a'}`,
      );

      return result;
    } catch (error) {
      console.error(
        `FAIL ${domain}: ${error instanceof Error ? error.message : error}`,
      );

      return {
        domain: normalizeBuiltWithDomain(domain),
        profileUrl: `https://builtwith.com/${normalizeBuiltWithDomain(domain)}`,
        detailedUrl: `https://builtwith.com/detailed/${normalizeBuiltWithDomain(domain)}`,
        title: null,
        meta: {
          liveTechnologiesCount: null,
          lastTechnologyDetected: null,
          siteAgeLabel: null,
          topSiteRank: null,
          aiIndex: { score: null, label: null },
          technologySpend: null,
        },
        categories: [],
        detailedTechnologies: [],
        fetchedAt: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies BuiltWithDomainResult;
    }
  });

  const output = {
    fetchedAt: new Date().toISOString(),
    transport: 'bright-data-residential-proxy',
    domains: DOMAINS,
    results,
  };

  const outputPath = join(
    process.cwd(),
    'tmp',
    'builtwith',
    `builtwith-batch-${Date.now()}.json`,
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outputPath}`);

  const summary = results.map((result) => ({
    domain: result.domain,
    detailedTechCount: result.detailedTechnologies.length,
    liveTechCount: result.detailedTechnologies.filter(
      (technology) => !technology.isHistorical,
    ).length,
    historicalTechCount: result.detailedTechnologies.filter(
      (technology) => technology.isHistorical,
    ).length,
    technologySpend: result.meta.technologySpend,
    sampleTechnologies: result.detailedTechnologies
      .filter((technology) => !technology.isHistorical)
      .slice(0, 8)
      .map((technology) => technology.name),
    errors: result.errors,
  }));

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
