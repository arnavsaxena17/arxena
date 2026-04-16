import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const cwd = process.cwd();
const bucketName = process.env.STORAGE_S3_NAME || process.env.S3_BUCKET_NAME;
const region = process.env.STORAGE_S3_REGION || process.env.AWS_REGION;
const endpoint = process.env.STORAGE_S3_ENDPOINT;

const sourceDirectories = process.argv.slice(2);
const defaultDirectories = [
  '.local-storage',
  'client_uploads',
  'all_resumes',
  'all_resumes_pdfs',
  '.attachments',
];

if (!bucketName || !region) {
  throw new Error(
    'Missing S3 configuration. Set STORAGE_S3_NAME/S3_BUCKET_NAME and STORAGE_S3_REGION/AWS_REGION.',
  );
}

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
});

const directories =
  sourceDirectories.length > 0 ? sourceDirectories : defaultDirectories;

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

const uploadFile = async (absoluteFilePath: string) => {
  const relativePath = path
    .relative(cwd, absoluteFilePath)
    .split(path.sep)
    .join('/');
  const body = await readFile(absoluteFilePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: relativePath,
      Body: body,
    }),
  );

  console.log(`Uploaded ${relativePath}`);
};

const run = async () => {
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

    const files = await walk(absoluteDirectoryPath);

    for (const file of files) {
      await uploadFile(file);
    }
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
