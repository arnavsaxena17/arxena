/**
 * Seed Redis org-chart cache + optional S3 from local org-charts/{companyId}/ files.
 *
 * Usage (on a host with REDIS_URL and optional AWS creds):
 *   node packages/twenty-server/scripts/seed-company-orgchart-cache.mjs litify \
 *     --data-dir /path/to/.local-storage/org-charts/litify \
 *     --upload-s3
 */
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createClient } from 'redis';

const execFileAsync = promisify(execFile);

const ENGINE_ORG_CHART_NAMESPACE = 'engine:org-chart';
const ORG_CHART_COMPANY_CACHE_KEY_PREFIX = 'company-orgchart';
const ORG_CHART_COMPANY_CANDIDATE_LIST_CACHE_KEY_PREFIX =
  'company-orgchart-candidates';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 90;

const normalizeCompanyId = (companyId, fallbackName) => {
  const normalizedCompanyId = (companyId ?? '').trim().toLowerCase();
  if (normalizedCompanyId) {
    return normalizedCompanyId;
  }
  const normalizedFallbackName = (fallbackName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalizedFallbackName || 'unknown_company';
};

const buildCompanyOrgChartLogicalCacheKey = (
  companyName,
  companyId,
  mode,
  searchType,
) => {
  const normalizedCompanyId = normalizeCompanyId(companyId, companyName);
  return [
    ORG_CHART_COMPANY_CACHE_KEY_PREFIX,
    normalizedCompanyId,
    mode,
    searchType,
    'default',
  ].join(':');
};

const buildCompanyOrgChartCandidateListLogicalCacheKey = (
  companyName,
  companyId,
  mode,
  searchType,
) => {
  const normalizedCompanyId = normalizeCompanyId(companyId, companyName);
  return [
    ORG_CHART_COMPANY_CANDIDATE_LIST_CACHE_KEY_PREFIX,
    normalizedCompanyId,
    mode,
    searchType,
    'default',
  ].join(':');
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const companyId = args.find((a) => !a.startsWith('--'));
  const dataDirFlag = args.indexOf('--data-dir');
  const dataDir =
    dataDirFlag >= 0 ? args[dataDirFlag + 1] : undefined;
  const uploadS3 = args.includes('--upload-s3');
  const companyNameFlag = args.indexOf('--company-name');
  const companyName =
    companyNameFlag >= 0 ? args[companyNameFlag + 1] : companyId;

  if (!companyId || !dataDir) {
    console.error(
      'Usage: node seed-company-orgchart-cache.mjs <companyId> --data-dir <folder> [--company-name name] [--upload-s3]',
    );
    process.exit(1);
  }

  return { companyId, companyName, dataDir, uploadS3 };
};

const main = async () => {
  const { companyId, companyName, dataDir, uploadS3 } = parseArgs();
  const orgChartPath = path.join(dataDir, 'orgchart.json');
  const candidatesPath = path.join(dataDir, 'candidates.json');

  await stat(orgChartPath);
  await stat(candidatesPath);

  const orgChart = JSON.parse(await readFile(orgChartPath, 'utf8'));
  const items = JSON.parse(await readFile(candidatesPath, 'utf8'));

  if (!Array.isArray(items)) {
    throw new Error('candidates.json must be a JSON array');
  }

  const normalizedCompanyId = normalizeCompanyId(companyId, companyName);
  const cachedAt = new Date().toISOString();
  const itemCount = items.length;

  const orgChartCacheKey = buildCompanyOrgChartLogicalCacheKey(
    companyName,
    companyId,
    'entire_company',
    'classic',
  );
  const candidateListCacheKey =
    buildCompanyOrgChartCandidateListLogicalCacheKey(
      companyName,
      companyId,
      'entire_company',
      'classic',
    );

  const orgChartPayload = {
    companyId: normalizedCompanyId,
    companyName: (companyName ?? '').trim(),
    mode: 'entire_company',
    searchType: 'classic',
    orgChart,
    items,
    itemCount,
    cachedAt,
    creditsDebited: true,
  };

  const candidateListPayload = {
    companyId: normalizedCompanyId,
    companyName: (companyName ?? '').trim(),
    mode: 'entire_company',
    searchType: 'classic',
    items,
    itemCount,
    cachedAt,
  };

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = createClient({ url: redisUrl });
  await redis.connect();

  const ttlSeconds = Number(process.env.ORG_CHART_COMPANY_CACHE_TTL_SECONDS);
  const effectiveTtl =
    Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Math.floor(ttlSeconds)
      : DEFAULT_TTL_SECONDS;

  const orgChartRedisKey = `${ENGINE_ORG_CHART_NAMESPACE}:${orgChartCacheKey}`;
  const candidateRedisKey = `${ENGINE_ORG_CHART_NAMESPACE}:${candidateListCacheKey}`;

  await redis.set(orgChartRedisKey, JSON.stringify(orgChartPayload), {
    EX: effectiveTtl,
  });
  await redis.set(candidateRedisKey, JSON.stringify(candidateListPayload), {
    EX: effectiveTtl,
  });

  console.log(
    `Redis SET ${orgChartRedisKey} (${itemCount} people, ttl=${effectiveTtl}s)`,
  );
  console.log(`Redis SET ${candidateRedisKey}`);

  await redis.disconnect();

  if (uploadS3) {
    const bucket = process.env.STORAGE_S3_NAME;
    const region =
      process.env.STORAGE_S3_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
    if (!bucket?.trim()) {
      throw new Error('STORAGE_S3_NAME is required for --upload-s3');
    }

    const prefix = `org-charts/${normalizedCompanyId}`;
    const s3Base = `s3://${bucket}/${prefix}`;
    await execFileAsync('aws', [
      's3',
      'cp',
      orgChartPath,
      `${s3Base}/orgchart.json`,
      '--region',
      region,
    ]);
    await execFileAsync('aws', [
      's3',
      'cp',
      candidatesPath,
      `${s3Base}/candidates.json`,
      '--region',
      region,
    ]);
    console.log(`S3 uploaded ${s3Base}/`);
  }

  console.log('Done.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
