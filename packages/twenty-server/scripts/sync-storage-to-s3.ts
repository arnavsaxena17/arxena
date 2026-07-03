import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const cwd = process.cwd();
const bucketName = process.env.STORAGE_S3_NAME || process.env.S3_BUCKET_NAME;
const region = process.env.STORAGE_S3_REGION || process.env.AWS_REGION;
const endpoint = process.env.STORAGE_S3_ENDPOINT;
const storageLocalPath =
  process.env.STORAGE_LOCAL_PATH?.replace(/^\.\//, '') || '.local-storage';
const accessKeyId =
  process.env.STORAGE_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.STORAGE_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const sourceDirectories = process.argv.slice(2);
const defaultDirectories = [storageLocalPath];

if (!bucketName || !region) {
  throw new Error(
    'Missing S3 configuration. Set STORAGE_S3_NAME and STORAGE_S3_REGION in .env (or export them).',
  );
}

const s3 = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle: true,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
});

const directories =
  sourceDirectories.length > 0 ? sourceDirectories : defaultDirectories;

const localPathPrefix = `${storageLocalPath}/`;

const unipileAttachmentsWorkspaceId =
  process.env.UNIPILE_ATTACHMENTS_WORKSPACE_ID || 'unknown';

const UNIPILE_ATTACHMENTS_DIR = 'unipile-attachments';
const UNIPILE_ATTACHMENTS_S3_PREFIX = `workspace-${unipileAttachmentsWorkspaceId}/unipile_attachments`;

const toS3Key = (absoluteFilePath: string, sourceDirectory?: string): string => {
  const relativePath = path
    .relative(cwd, absoluteFilePath)
    .split(path.sep)
    .join('/');

  if (
    sourceDirectory === UNIPILE_ATTACHMENTS_DIR ||
    sourceDirectory?.endsWith(`/${UNIPILE_ATTACHMENTS_DIR}`)
  ) {
    const unipileRelative = relativePath.startsWith(`${UNIPILE_ATTACHMENTS_DIR}/`)
      ? relativePath.slice(`${UNIPILE_ATTACHMENTS_DIR}/`.length)
      : relativePath;

    if (
      unipileRelative === 'deleted-messages.json' ||
      unipileRelative === 'deleted-message-content-cache.json'
    ) {
      return '';
    }

    return `${UNIPILE_ATTACHMENTS_S3_PREFIX}/${unipileRelative}`;
  }

  if (relativePath.startsWith(localPathPrefix)) {
    return relativePath.slice(localPathPrefix.length);
  }

  if (relativePath === storageLocalPath) {
    return '';
  }

  return relativePath;
};

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      if (entry.isFile()) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
};

const uploadFile = async (
  absoluteFilePath: string,
  sourceDirectory?: string,
) => {
  const s3Key = toS3Key(absoluteFilePath, sourceDirectory);

  if (!s3Key) {
    return;
  }

  const body = await readFile(absoluteFilePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: body,
    }),
  );

  console.log(`Uploaded s3://${bucketName}/${s3Key}`);
};

const run = async () => {
  console.log(
    `Syncing to s3://${bucketName} (region=${region}), stripping local prefix "${storageLocalPath}/"`,
  );

  let uploadedCount = 0;

  for (const directory of directories) {
    const absoluteDirectoryPath = path.resolve(cwd, directory);

    try {
      const directoryStat = await stat(absoluteDirectoryPath);

      if (!directoryStat.isDirectory()) {
        continue;
      }
    } catch {
      console.log(`Skipping missing directory ${directory}`);
      continue;
    }

    if (
      directory === '.attachments' ||
      directory.endsWith('/.attachments')
    ) {
      console.warn(
        `Skipping ${directory}: legacy WhatsApp temp folder does not match FileStorageService S3 keys. Re-save media after deploy or migrate manually.`,
      );
      continue;
    }

    if (
      directory === UNIPILE_ATTACHMENTS_DIR ||
      directory.endsWith(`/${UNIPILE_ATTACHMENTS_DIR}`)
    ) {
      console.log(
        `Migrating ${directory} to s3://${bucketName}/${UNIPILE_ATTACHMENTS_S3_PREFIX}/ (set UNIPILE_ATTACHMENTS_WORKSPACE_ID to target a specific workspace)`,
      );
    }

    const files = await walk(absoluteDirectoryPath);

    for (const file of files) {
      await uploadFile(file, directory);
      uploadedCount++;
    }
  }

  console.log(`Done. Uploaded ${uploadedCount} file(s).`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
