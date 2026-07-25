import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadEnvConfig } from '@next/env';

import {
  buildOrgChartPath,
  CANONICAL_SITE_URL,
  formatSitemapId,
  getExposedBatchCount,
  SITEMAP_CHILD_PREFIX,
  SITEMAP_INDEX_FILENAME,
  sitemapEntryToXml,
  sitemapIndexEntryToXml,
  STATIC_ROUTES,
} from '../src/lib/sitemap';

type BatchParams = {
  country?: string;
  type?: string;
  offset?: number;
  limit?: number;
};

type SitemapUrlsResponse = {
  urls?: Array<{ companyId: string; country: string; type: string }>;
};

const packageRoot = path.resolve(__dirname, '..');
const publicDir = path.join(packageRoot, 'public');

loadEnvConfig(packageRoot);

function isProductionSitemapBuild(): boolean {
  if (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.VERCEL_ENV === 'development'
  ) {
    return false;
  }
  if (process.env.VERCEL_ENV === 'production') {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

function normalizeSiteUrl(envUrl: string): string {
  return (envUrl.startsWith('http') ? envUrl : `https://${envUrl}`).replace(
    /\/$/,
    '',
  );
}

function getRequiredBaseUrl(): string {
  const explicit = process.env.SITEMAP_SITE_URL?.trim();
  if (explicit) {
    return normalizeSiteUrl(explicit);
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (!envUrl) {
    if (isProductionSitemapBuild()) {
      return CANONICAL_SITE_URL;
    }
    throw new Error(
      'NEXT_PUBLIC_APP_URL (or VERCEL_URL) is required to generate static sitemaps.',
    );
  }

  const normalized = normalizeSiteUrl(envUrl);
  if (isProductionSitemapBuild() && /localhost|127\.0\.0\.1/.test(normalized)) {
    return CANONICAL_SITE_URL;
  }
  return normalized;
}

function getRequiredServerBaseUrl(): string {
  const serverUrl =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');

  if (!serverUrl) {
    throw new Error(
      'SERVER_BASE_URL (or NEXT_PUBLIC_SERVER_BASE_URL) is required to generate static sitemaps.',
    );
  }

  return serverUrl.replace(/\/$/, '');
}

async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  const response = await fetch(url, { signal: controller.signal }).finally(
    () => {
      clearTimeout(timeout);
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function removeExistingSitemaps() {
  await mkdir(publicDir, { recursive: true });
  const entries = await readdir(publicDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          (entry.name === 'sitemap-index.xml' ||
            entry.name === SITEMAP_INDEX_FILENAME ||
            /^sitemap-\d{3}\.xml$/.test(entry.name) ||
            new RegExp(`^${SITEMAP_CHILD_PREFIX}\\d{3}\\.xml$`).test(entry.name)),
      )
      .map((entry) => rm(path.join(publicDir, entry.name))),
  );
}

async function generateChildSitemap(
  batchIndex: number,
  baseUrl: string,
  serverBaseUrl: string,
  generatedAt: Date,
) {
  const entries: string[] = [];

  if (batchIndex === 0) {
    for (const routePath of STATIC_ROUTES) {
      entries.push(
        sitemapEntryToXml(
          `${baseUrl}${routePath}`,
          generatedAt,
          routePath === '/' ? 'weekly' : 'monthly',
          routePath === '/' ? 1 : 0.8,
        ),
      );
    }
  }

  const batchParams = await fetchJsonOrThrow<BatchParams>(
    `${serverBaseUrl}/org-chart/companies/sitemap-batch-params?batchIndex=${batchIndex}`,
  );

  if (
    batchParams.country != null &&
    batchParams.limit != null &&
    batchParams.limit > 0
  ) {
    const urlsEndpoint = new URL(
      `${serverBaseUrl}/org-chart/companies/sitemap-urls`,
    );
    urlsEndpoint.searchParams.set('offset', String(batchParams.offset ?? 0));
    urlsEndpoint.searchParams.set('limit', String(batchParams.limit));
    if (batchParams.country) {
      urlsEndpoint.searchParams.set('country', batchParams.country);
    }
    if (batchParams.type) {
      urlsEndpoint.searchParams.set('type', batchParams.type);
    }

    const data = await fetchJsonOrThrow<SitemapUrlsResponse>(
      urlsEndpoint.toString(),
    );

    for (const { companyId, country, type } of data.urls ?? []) {
      if (!companyId?.trim()) continue;
      entries.push(
        sitemapEntryToXml(
          `${baseUrl}${buildOrgChartPath(companyId, country, type)}`,
          generatedAt,
          'monthly',
          0.8,
        ),
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  const fileName = formatSitemapId(batchIndex);
  await writeFile(path.join(publicDir, fileName), xml, 'utf8');
}

async function generateSitemapIndex(
  baseUrl: string,
  count: number,
  generatedAt: Date,
) {
  const sitemapEntries =
    count === 0
      ? []
      : Array.from({ length: count }, (_, i) =>
          sitemapIndexEntryToXml(
            `${baseUrl}/${formatSitemapId(i)}`,
            generatedAt,
          ),
        );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</sitemapindex>`;

  await writeFile(path.join(publicDir, SITEMAP_INDEX_FILENAME), xml, 'utf8');
}

async function main() {
  const baseUrl = getRequiredBaseUrl();
  const serverBaseUrl = getRequiredServerBaseUrl();
  const count = getExposedBatchCount();
  const generatedAt = new Date();

  console.log(`Generating ${count} sitemap batch(es) from ${serverBaseUrl}`);
  await removeExistingSitemaps();

  for (let batchIndex = 0; batchIndex < count; batchIndex += 1) {
    await generateChildSitemap(batchIndex, baseUrl, serverBaseUrl, generatedAt);
  }

  await generateSitemapIndex(baseUrl, count, generatedAt);

  console.log(
    `Generated ${count} sitemap file(s) plus ${SITEMAP_INDEX_FILENAME} in ${publicDir}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
