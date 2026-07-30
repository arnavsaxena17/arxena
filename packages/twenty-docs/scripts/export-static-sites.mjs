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

const resolveHoistedDependency = (packageName) => {
  const candidates = [
    path.join(docsRoot, 'node_modules', packageName),
    path.join(repoRoot, 'node_modules', packageName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to find hoisted dependency "${packageName}" for Mintlify export.`,
  );
};

// Nested react under @mintlify/* makes hooks resolve against a different React
// copy than react-reconciler (useState dispatcher is null) and can OOM export.
const dedupeMintlifyReact = () => {
  const hoistedDependencies = {
    react: resolveHoistedDependency('react'),
    'react-dom': resolveHoistedDependency('react-dom'),
  };
  const nestedReactRoots = [
    path.join(repoRoot, 'node_modules/@mintlify/previewing/node_modules'),
    path.join(repoRoot, 'node_modules/@mintlify/cli/node_modules'),
    path.join(docsRoot, 'node_modules/@mintlify/previewing/node_modules'),
    path.join(docsRoot, 'node_modules/@mintlify/cli/node_modules'),
  ];

  for (const nestedReactRoot of nestedReactRoots) {
    if (!fs.existsSync(nestedReactRoot)) {
      continue;
    }

    for (const [packageName, hoistedPackagePath] of Object.entries(
      hoistedDependencies,
    )) {
      const nestedPackagePath = path.join(nestedReactRoot, packageName);

      fs.rmSync(nestedPackagePath, { recursive: true, force: true });
      fs.symlinkSync(hoistedPackagePath, nestedPackagePath, 'dir');
      console.log(
        `Linked Mintlify ${packageName} at ${nestedPackagePath} -> ${hoistedPackagePath}`,
      );
    }
  }

  for (const [packageName, hoistedPackagePath] of Object.entries(
    hoistedDependencies,
  )) {
    const packageJsonPath = path.join(hoistedPackagePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(
        `Mintlify export dependency link target is invalid: ${packageJsonPath}`,
      );
    }
  }
};

const isPopulatedDirectory = (targetPath) => {
  return (
    fs.existsSync(targetPath) &&
    fs.statSync(targetPath).isDirectory() &&
    fs.readdirSync(targetPath).length > 0
  );
};

const isZipFile = (targetPath) => {
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    return false;
  }

  const fileDescriptor = fs.openSync(targetPath, 'r');
  const signatureBuffer = Buffer.alloc(4);

  try {
    fs.readSync(fileDescriptor, signatureBuffer, 0, 4, 0);
  } finally {
    fs.closeSync(fileDescriptor);
  }

  return signatureBuffer.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
};

const resolveMintlifyExportDirectory = ({
  exportArtifactPath,
  extractDir,
  outputName,
}) => {
  if (isPopulatedDirectory(extractDir)) {
    return;
  }

  const siblingDir = path.join(exportRoot, outputName);

  if (isPopulatedDirectory(siblingDir)) {
    return;
  }

  if (
    fs.existsSync(exportArtifactPath) &&
    fs.statSync(exportArtifactPath).isDirectory()
  ) {
    fs.renameSync(exportArtifactPath, extractDir);
    return;
  }

  if (isZipFile(exportArtifactPath)) {
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync('unzip', ['-oq', exportArtifactPath, '-d', extractDir], {
      cwd: docsRoot,
      stdio: 'inherit',
    });
    return;
  }

  const artifactPreview = fs.existsSync(exportArtifactPath)
    ? fs.readFileSync(exportArtifactPath, 'utf8').slice(0, 200)
    : 'Artifact path was not created.';

  throw new Error(
    `Mintlify export for "${outputName}" did not produce a usable directory or zip artifact at ${exportArtifactPath}. ` +
      `Artifact preview: ${JSON.stringify(artifactPreview)}`,
  );
};

const runMintlifyExport = ({
  outputName,
  canonicalUrl,
  primaryHref,
  originalDocsConfig,
  mintlifyBin,
}) => {
  const exportArtifactPath = path.join(exportRoot, `${outputName}.zip`);
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
  fs.rmSync(exportArtifactPath, { recursive: true, force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  fs.writeFileSync(docsJsonPath, `${JSON.stringify(docsConfig, null, 2)}\n`);

  const mintlifyCommand = mintlifyBin ?? 'npx';
  const mintlifyArgs = mintlifyBin
    ? ['export', '--output', exportArtifactPath]
    : ['mintlify', 'export', '--output', exportArtifactPath];

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

  if (!fs.existsSync(exportArtifactPath) && !isPopulatedDirectory(extractDir)) {
    throw new Error(
      `Mintlify export did not produce ${exportArtifactPath}. ` +
        'Check the mintlify export logs above for React/OOM errors.',
    );
  }

  resolveMintlifyExportDirectory({
    exportArtifactPath,
    extractDir,
    outputName,
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
