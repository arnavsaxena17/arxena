/**
 * Backfill global avatars/ from org-chart S3/local candidate + orgchart JSON.
 *
 * Usage:
 *   node packages/twenty-server/scripts/backfill-candidate-avatars.mjs \
 *     --storage-root /path/to/.local-storage \
 *     [--company litify] \
 *     [--concurrency 8] \
 *     [--dry-run]
 *
 * With AWS (profile arxanalytics):
 *   aws s3 sync s3://BUCKET/org-charts ./org-charts --profile arxanalytics
 *   node packages/twenty-server/scripts/backfill-candidate-avatars.mjs \
 *     --storage-root ./org-charts --company litify
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const AVATAR_EDGE_PX = 256;
const IMAGE_FIELD_NAMES = new Set([
  'profile_picture_url',
  'profile_picture_url_large',
  'profileImageUrl',
  'displayPicture',
  'display_picture',
  'photo',
  'pictureUrl',
  'picture_url',
  'picture',
  'image',
  'avatar',
]);

const LINKEDIN_URL_KEYS = [
  'linkedinUrl',
  'profileUrl',
  'linkedin_url',
  'std_linkedin_url',
  'public_profile_url',
  'profile_url',
];

const ALLOWED_HOSTS = new Set([
  'media.licdn.com',
  'media-exp1.licdn.com',
  'static.licdn.com',
  'st2.depositphotos.com',
  'images.contactout.com',
  'p.naukri.com',
]);

const isAllowedUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      ALLOWED_HOSTS.has(host) ||
      host.endsWith('.theorg.com') ||
      host.endsWith('.licdn.com')
    );
  } catch {
    return false;
  }
};

const normalizeLinkedinKey = (url) =>
  url.trim().toLowerCase().replace(/\/+$/, '');

const resolveStableKey = ({ imageUrl, linkedinUrl }) => {
  if (linkedinUrl?.trim()) {
    return createHash('sha256')
      .update(normalizeLinkedinKey(linkedinUrl))
      .digest('hex');
  }
  if (!imageUrl?.trim() || imageUrl.startsWith('/avatars/')) {
    return null;
  }
  try {
    return createHash('sha256').update(new URL(imageUrl).href).digest('hex');
  } catch {
    return createHash('sha256').update(imageUrl).digest('hex');
  }
};

const extractLinkedin = (row) => {
  for (const key of LINKEDIN_URL_KEYS) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
};

const extractImage = (row) => {
  for (const key of IMAGE_FIELD_NAMES) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() && !v.startsWith('/avatars/')) {
      return v.trim();
    }
  }
  return '';
};

const avatarPaths = (storageRoot, key) => ({
  dir: path.join(storageRoot, 'avatars', key),
  file: path.join(storageRoot, 'avatars', key, 'avatar.webp'),
  meta: path.join(storageRoot, 'avatars', 'meta', key, 'meta.json'),
  publicPath: `/avatars/${key}`,
});

const ingestOne = async ({ storageRoot, imageUrl, linkedinUrl, dryRun }) => {
  const stableKey = resolveStableKey({ imageUrl, linkedinUrl });
  if (!stableKey || !isAllowedUrl(imageUrl)) {
    return imageUrl;
  }

  const paths = avatarPaths(storageRoot, stableKey);
  try {
    await readFile(paths.file);
    return paths.publicPath;
  } catch {
    /* miss */
  }

  if (dryRun) {
    console.log(`[dry-run] would ingest ${stableKey} from ${imageUrl.slice(0, 80)}`);
    return paths.publicPath;
  }

  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ArxenaAvatarBackfill/1.0)',
      Accept: 'image/*',
      Referer: 'https://www.linkedin.com/',
    },
  });

  if (!response.ok) {
    console.warn(`Skip ${stableKey}: upstream ${response.status}`);
    return imageUrl;
  }

  const raw = Buffer.from(await response.arrayBuffer());
  const webp = await sharp(raw)
    .rotate()
    .resize(AVATAR_EDGE_PX, AVATAR_EDGE_PX, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await mkdir(paths.dir, { recursive: true });
  await mkdir(path.dirname(paths.meta), { recursive: true });
  await writeFile(paths.file, webp);
  await writeFile(
    paths.meta,
    JSON.stringify({
      sourceUrl: imageUrl,
      linkedinUrl: linkedinUrl || undefined,
      ingestedAt: new Date().toISOString(),
    }),
  );

  console.log(`Ingested avatar ${stableKey}`);
  return paths.publicPath;
};

const rewriteValue = async (value, ctx) => {
  if (Array.isArray(value)) {
    return Promise.all(value.map((entry) => rewriteValue(entry, ctx)));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value;
  const linkedinUrl = extractLinkedin(record);
  const out = { ...record };

  for (const [key, current] of Object.entries(record)) {
    if (typeof current === 'string' && IMAGE_FIELD_NAMES.has(key)) {
      out[key] = await ingestOne({
        ...ctx,
        imageUrl: current,
        linkedinUrl,
      });
      continue;
    }
    if (Array.isArray(current)) {
      out[key] = await Promise.all(
        current.map((entry) => rewriteValue(entry, ctx)),
      );
      continue;
    }
    if (current && typeof current === 'object') {
      out[key] = await rewriteValue(current, ctx);
    }
  }

  return out;
};

const processJsonFile = async (filePath, ctx) => {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const rewritten = await rewriteValue(parsed, ctx);
  if (!ctx.dryRun) {
    await writeFile(filePath, `${JSON.stringify(rewritten)}\n`);
  }
  console.log(`Updated ${filePath}`);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const storageFlag = args.indexOf('--storage-root');
  const companyFlag = args.indexOf('--company');
  const concurrencyFlag = args.indexOf('--concurrency');
  return {
    storageRoot:
      storageFlag >= 0 ? path.resolve(args[storageFlag + 1]) : undefined,
    company: companyFlag >= 0 ? args[companyFlag + 1] : undefined,
    concurrency:
      concurrencyFlag >= 0 ? Number(args[concurrencyFlag + 1]) : 8,
    dryRun: args.includes('--dry-run'),
  };
};

const main = async () => {
  const { storageRoot, company, dryRun } = parseArgs();
  if (!storageRoot) {
    console.error('Required: --storage-root (file-storage root, e.g. .local-storage)');
    process.exit(1);
  }

  const orgChartsRoot = path.join(storageRoot, 'org-charts');
  const entries = await readdir(orgChartsRoot, { withFileTypes: true });
  const companies = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !company || name.includes(company));

  const ctx = { storageRoot, dryRun };

  for (const companyId of companies) {
    const base = path.join(orgChartsRoot, companyId);
    const subdirs = await readdir(base, { withFileTypes: true });
    const folders = [
      base,
      ...subdirs.filter((e) => e.isDirectory()).map((e) => path.join(base, e.name)),
    ];

    for (const folder of folders) {
      for (const name of ['candidates.json', 'orgchart.json']) {
        const filePath = path.join(folder, name);
        try {
          await stat(filePath);
          await processJsonFile(filePath, ctx);
        } catch {
          /* missing file */
        }
      }
    }
  }

  console.log('Backfill complete.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
