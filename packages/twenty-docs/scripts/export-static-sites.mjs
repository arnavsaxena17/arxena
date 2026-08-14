import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(docsRoot, '../..');
const docsJsonPath = path.join(docsRoot, 'docs.json');
const generatedDocsNavPath = path.join(
  docsRoot,
  'src',
  '_props',
  'generatedDocsNav.json',
);
const exportRoot = path.join(docsRoot, '.mintlify', 'exports');

const exportConfigs = [
  {
    outputName: 'arxena',
    canonicalUrl: 'https://docs.arxena.com',
    primaryHref: 'https://app.arxena.com/welcome',
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

const writeGeneratedDocsNav = (docsConfig) => {
  fs.mkdirSync(path.dirname(generatedDocsNavPath), { recursive: true });
  fs.writeFileSync(
    generatedDocsNavPath,
    `${JSON.stringify(docsConfig.navigation ?? {}, null, 2)}\n`,
  );
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
  const tempRoot = path.join(exportRoot, '.tmp', outputName);

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
  fs.mkdirSync(tempRoot, { recursive: true });
  fs.rmSync(exportZipPath, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  fs.writeFileSync(docsJsonPath, `${JSON.stringify(docsConfig, null, 2)}\n`);
  writeGeneratedDocsNav(docsConfig);

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
      TMPDIR: tempRoot,
      TMP: tempRoot,
      TEMP: tempRoot,
    },
  });

  if (!fs.existsSync(exportZipPath) || fs.statSync(exportZipPath).size === 0) {
    throw new Error(
      `Mintlify export did not produce a bundle at ${exportZipPath}. ` +
        'Check the mintlify export logs above for React/OOM errors.',
    );
  }

  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync('unzip', ['-oq', exportZipPath, '-d', extractDir], {
    cwd: docsRoot,
    stdio: 'inherit',
  });

  if (!isPopulatedDirectory(extractDir)) {
    throw new Error(
      `Mintlify export did not produce a populated directory at ${extractDir}. ` +
        'Check the mintlify export logs above for React/OOM errors.',
    );
  }
};

const regenerateDocsJson = () => {
  execFileSync(
    'npx',
    ['tsx', path.join(docsRoot, 'scripts/generate-docs-json.ts')],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );
};

regenerateDocsJson();

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
  writeGeneratedDocsNav(originalDocsConfig);
}
