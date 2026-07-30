import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(docsRoot, '../..');
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

const resolveMintlifyBin = () => {
  const candidates = [
    path.join(docsRoot, 'node_modules', '.bin', 'mintlify'),
    path.join(repoRoot, 'node_modules', '.bin', 'mintlify'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

// Nested react under @mintlify/* makes hooks resolve against a different React
// copy than react-reconciler (useState dispatcher is null) and can OOM export.
const dedupeMintlifyReact = () => {
  const nestedReactRoots = [
    path.join(repoRoot, 'node_modules/@mintlify/previewing/node_modules/react'),
    path.join(
      repoRoot,
      'node_modules/@mintlify/previewing/node_modules/react-dom',
    ),
    path.join(repoRoot, 'node_modules/@mintlify/cli/node_modules/react'),
    path.join(repoRoot, 'node_modules/@mintlify/cli/node_modules/react-dom'),
    path.join(docsRoot, 'node_modules/@mintlify/previewing/node_modules/react'),
    path.join(
      docsRoot,
      'node_modules/@mintlify/previewing/node_modules/react-dom',
    ),
    path.join(docsRoot, 'node_modules/@mintlify/cli/node_modules/react'),
    path.join(docsRoot, 'node_modules/@mintlify/cli/node_modules/react-dom'),
  ];

  for (const nestedReactRoot of nestedReactRoots) {
    if (fs.existsSync(nestedReactRoot)) {
      fs.rmSync(nestedReactRoot, { recursive: true, force: true });
      console.log(`Removed nested Mintlify React at ${nestedReactRoot}`);
    }
  }
};

const runMintlifyExport = ({
  outputName,
  canonicalUrl,
  primaryHref,
  originalDocsConfig,
  mintlifyBin,
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

  // Interactive playground + every codegen language balloons export memory.
  if (docsConfig.api?.playground) {
    docsConfig.api.playground.display = 'simple';
  }
  if (docsConfig.api?.examples?.languages) {
    docsConfig.api.examples.languages = ['curl', 'javascript', 'python'];
  }

  fs.mkdirSync(exportRoot, { recursive: true });
  fs.rmSync(exportZipPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  fs.writeFileSync(docsJsonPath, `${JSON.stringify(docsConfig, null, 2)}\n`);

  const mintlifyCommand = mintlifyBin ?? 'npx';
  const mintlifyArgs = mintlifyBin
    ? ['export', '--output', exportZipPath]
    : ['mintlify', 'export', '--output', exportZipPath];

  execFileSync(mintlifyCommand, mintlifyArgs, {
    cwd: docsRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        '--max-old-space-size=8192',
      ]
        .filter(Boolean)
        .join(' '),
    },
  });

  if (!fs.existsSync(exportZipPath)) {
    throw new Error(
      `Mintlify export did not produce ${exportZipPath}. ` +
        'Check the mintlify export logs above for React/OOM errors.',
    );
  }

  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync('unzip', ['-oq', exportZipPath, '-d', extractDir], {
    cwd: docsRoot,
    stdio: 'inherit',
  });
};

const originalDocsConfig = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));
const mintlifyBin = resolveMintlifyBin();

if (!mintlifyBin) {
  console.warn(
    'Local mintlify binary not found; falling back to npx mintlify',
  );
}

dedupeMintlifyReact();

try {
  for (const exportConfig of exportConfigs) {
    runMintlifyExport({
      ...exportConfig,
      originalDocsConfig,
      mintlifyBin,
    });
  }
} finally {
  fs.writeFileSync(
    docsJsonPath,
    `${JSON.stringify(originalDocsConfig, null, 2)}\n`,
  );
}
