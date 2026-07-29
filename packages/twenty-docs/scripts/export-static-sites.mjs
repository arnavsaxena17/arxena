import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '..');
const docsJsonPath = path.join(docsRoot, 'docs.json');
const exportRoot = path.join(docsRoot, '.mintlify', 'exports');

const exportConfigs = [
  {
    outputName: 'arxena',
    canonicalUrl: 'https://docs.arxena.com',
    primaryHref: 'https://app.arxena.com/welcome',
  },
  {
    outputName: 'arxanalytics',
    canonicalUrl: 'https://docs.arxanalytics.com',
    primaryHref: 'https://app.arxanalytics.com/welcome',
  },
];

const runMintlifyExport = ({
  outputName,
  canonicalUrl,
  primaryHref,
  originalDocsConfig,
}) => {
  const exportZipPath = path.join(exportRoot, `${outputName}.zip`);
  const extractDir = path.join(exportRoot, outputName);

  const docsConfig = structuredClone(originalDocsConfig);

  docsConfig.seo ??= {};
  docsConfig.seo.metatags ??= {};
  docsConfig.seo.metatags.canonical = canonicalUrl;
  docsConfig.navbar ??= {};
  docsConfig.navbar.primary ??= {};
  docsConfig.navbar.primary.href = primaryHref;

  fs.mkdirSync(exportRoot, { recursive: true });
  fs.rmSync(exportZipPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  fs.writeFileSync(docsJsonPath, `${JSON.stringify(docsConfig, null, 2)}\n`);

  execFileSync(
    'npx',
    ['mintlify', 'export', '--output', exportZipPath],
    {
      cwd: docsRoot,
      stdio: 'inherit',
    },
  );

  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync('unzip', ['-oq', exportZipPath, '-d', extractDir], {
    cwd: docsRoot,
    stdio: 'inherit',
  });
};

const originalDocsConfig = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));

try {
  for (const exportConfig of exportConfigs) {
    runMintlifyExport({
      ...exportConfig,
      originalDocsConfig,
    });
  }
} finally {
  fs.writeFileSync(
    docsJsonPath,
    `${JSON.stringify(originalDocsConfig, null, 2)}\n`,
  );
}
