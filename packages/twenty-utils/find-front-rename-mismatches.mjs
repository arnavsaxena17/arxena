#!/usr/bin/env node
/**
 * Detect Vite-prod front crash patterns from incomplete Recoil→Jotai /
 * Job→Project renames and ungated optional-object metadata hooks.
 *
 * Usage:
 *   node packages/twenty-utils/find-front-rename-mismatches.mjs
 *   node packages/twenty-utils/find-front-rename-mismatches.mjs --all
 *
 * Exit 1 when any FAIL is printed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const FRONT_MODULES = path.join(ROOT, 'packages/twenty-front/src/modules');

const DEFAULT_SCOPE_DIRS = [
  'orgchart',
  'arx-ai-filtering',
  'arx-jd-upload',
  'candidate-table',
  'outreach-home',
  'unipile',
  'spreadsheet-import',
  path.join('command-menu-item', 'engine-command', 'record', 'arx'),
  'navigation',
];

const SKIP_DIR_PARTS = new Set([
  'node_modules',
  'dist',
  '__tests__',
  '__mocks__',
  'coverage',
]);

const HIGH_RISK_UNDECLARED = [
  'currentProjectId',
  'currentJobId',
  'isMinimized',
  'activeEnrichment',
  'setJobs',
];

const OPTIONAL_OBJECT_NAMES = ['dashboard', 'orgChart', 'assistantThread'];

const STALE_SETTER_PATTERN =
  /\b(setJobs|setSearchQuery|setSelectedStatus|setFilteredCount|setCommandContext|setContactsByKey|setMainTargeted|setMainPageType)\b/;

const TDZ_PATTERNS = [
  /const\s+(\w+)\s*=\s*useAtomStateValue(?:<[^>]*>)?\(\s*\1\s*\)/,
  /const\s+(\w+)\s*=\s*useSetAtomState\(\s*\1\s*\)/,
  /const\s+\[(\w+)(?:,[^\]]*)?\]\s*=\s*useAtomState\(\s*\1\s*\)/,
];

const args = process.argv.slice(2);
const scanAll = args.includes('--all');
const failStrict = !args.includes('--warn-only');

/** @type {{ kind: string, file: string, line: number, text: string }[]} */
const failures = [];

const walk = (directory) => {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIR_PARTS.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolutePath));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }
    files.push(absolutePath);
  }

  return files;
};

const relativeToRepo = (absolutePath) =>
  path.relative(ROOT, absolutePath).split(path.sep).join('/');

const addFail = (kind, file, line, text) => {
  failures.push({ kind, file: relativeToRepo(file), line, text: text.trim() });
};

const isDeclaredInFile = (source, name) => {
  if (name === 'isMinimized') {
    if (
      /isMinimized\?:/.test(source) ||
      /\$\{\(\{\s*[^}]*\bisMinimized\b/.test(source) ||
      /\bisMinimized\s*=/.test(source) ||
      /\bisMinimized\s*,/.test(source) ||
      /\(\s*\{[^}]*\bisMinimized\b/.test(source)
    ) {
      return true;
    }
  }

  if (name === 'currentProjectId' && /currentProjectIdState/.test(source)) {
    return true;
  }

  if (name === 'activeEnrichment' && /activeEnrichmentState/.test(source)) {
    return true;
  }

  if (name === 'setJobs') {
    // Parameter or declared setter
    if (
      /\b(const|let|var|function)\s+setJobs\b/.test(source) ||
      /\(\s*[^)]*\bsetJobs\s*[,):]/.test(source)
    ) {
      return true;
    }
    return false;
  }

  return (
    new RegExp(
      String.raw`\b(const|let|var|function|type|interface)\s+${name}\b`,
    ).test(source) ||
    new RegExp(String.raw`\b${name}\s*[:=]`).test(source) ||
    new RegExp(String.raw`\([^)]*\b${name}\b[^)]*\)\s*=>`).test(source) ||
    new RegExp(String.raw`\b${name}State\b`).test(source) ||
    new RegExp(String.raw`\b${name}\?:`).test(source)
  );
};

const scanFile = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    for (const pattern of TDZ_PATTERNS) {
      if (pattern.test(line)) {
        addFail('tdz-self-shadow', filePath, lineNumber, line);
      }
    }

    // recordStore declared but body still uses record?.
    if (
      /const\s+recordStore\s*=\s*useAtomFamilyStateValue\(\s*recordStoreFamilyState/.test(
        line,
      )
    ) {
      const window = lines.slice(index, index + 12).join('\n');
      if (/\brecord\?\./.test(window) && !/\brecordStore\?\./.test(window)) {
        addFail(
          'recordStore-rename-leftover',
          filePath,
          lineNumber,
          'recordStore declared but nearby body uses record?.',
        );
      }
    }

    if (STALE_SETTER_PATTERN.test(line)) {
      // HotHooks / states helpers take setTableState as a param — skip those
      if (
        /\bsetTableState\b/.test(line) &&
        (/setTableState\s*:/.test(line) ||
          /\(\s*[^)]*\bsetTableState\b/.test(line) ||
          /setTableState\s*\)/.test(line) ||
          /setTableState\s*,/.test(line))
      ) {
        // allow param/type usages; still fail bare call sites of other setters
      }
      const staleMatch = line.match(STALE_SETTER_PATTERN);
      if (staleMatch) {
        const name = staleMatch[1];
        if (name === 'setSearchQuery') {
          // Local useState setters are fine
          if (/useState/.test(source) && /setSearchQuery/.test(source)) {
            continue;
          }
        }
        if (name.startsWith('setMain')) {
          addFail('stale-setter', filePath, lineNumber, line);
          continue;
        }
        if (name === 'setJobs') {
          addFail('stale-setter', filePath, lineNumber, line);
        }
      }
    }
  }

  for (const name of HIGH_RISK_UNDECLARED) {
    if (!new RegExp(String.raw`\b${name}\b`).test(source)) {
      continue;
    }
    if (isDeclaredInFile(source, name)) {
      continue;
    }
    // Find first usage line for reporting
    const usageIndex = lines.findIndex((line) =>
      new RegExp(String.raw`\b${name}\b`).test(line),
    );
    addFail(
      'undeclared-identifier',
      filePath,
      usageIndex >= 0 ? usageIndex + 1 : 1,
      `uses ${name} without a declaration in this file`,
    );
  }

  // Ungated useOutreachCommandDashboardPath (must also see useCanQueryDashboardRecords
  // or live in the shared OutreachSafeDashboardPath gate helper)
  const isSafeDashboardPathHelper =
    /OutreachSafeDashboardPath\.tsx$/.test(filePath) ||
    /\bOutreachSafeDashboardPath\b/.test(source);

  if (
    /\buseOutreachCommandDashboardPath\s*\(/.test(source) &&
    !/\buseCanQueryDashboardRecords\s*\(/.test(source) &&
    !isSafeDashboardPathHelper
  ) {
    const usageIndex = lines.findIndex((line) =>
      /\buseOutreachCommandDashboardPath\s*\(/.test(line),
    );
    addFail(
      'ungated-dashboard-path',
      filePath,
      usageIndex >= 0 ? usageIndex + 1 : 1,
      'useOutreachCommandDashboardPath without useCanQueryDashboardRecords / OutreachSafeDashboardPath',
    );
  }

  // Mount-time useCreateOneRecord('assistantThread') — prefer call-time helpers
  if (
    /useCreateOneRecord\s*\(\s*\{[^}]*objectNameSingular:\s*['"]assistantThread['"]/s.test(
      source,
    )
  ) {
    const usageIndex = lines.findIndex((line) => /assistantThread/.test(line));
    addFail(
      'optional-object-mount-create',
      filePath,
      usageIndex >= 0 ? usageIndex + 1 : 1,
      "useCreateOneRecord({ objectNameSingular: 'assistantThread' }) on mount",
    );
  }

  for (const objectName of OPTIONAL_OBJECT_NAMES) {
    const objectLiteral = new RegExp(
      String.raw`objectNameSingular:\s*['"]${objectName}['"]`,
    );
    if (!objectLiteral.test(source)) {
      continue;
    }
    const usesThrowingHook =
      /\buseFindManyRecords\s*\(/.test(source) ||
      /\buseCreateOneRecord\s*\(/.test(source) ||
      /\buseObjectMetadataItem\s*\(/.test(source);
    if (!usesThrowingHook) {
      continue;
    }
    const hasGate =
      /\buseCanQuery/.test(source) ||
      /\buseIsAssistantAppInstalled\b/.test(source) ||
      /\bOutreachSafeDashboardPath\b/.test(source) ||
      // call-time create helper
      /useCreateAssistantThreadRecord/.test(source) ||
      // soft metadata find before create
      /objectMetadataItems\.find/.test(source);
    if (!hasGate && objectName !== 'assistantThread') {
      // assistantThread updateOneRecord call-time is OK; create checked above
      const usageIndex = lines.findIndex((line) => objectLiteral.test(line));
      addFail(
        'optional-object-ungated-hook',
        filePath,
        usageIndex >= 0 ? usageIndex + 1 : 1,
        `optional object '${objectName}' via throwing metadata hook without gate`,
      );
    }
  }
};

const collectFiles = () => {
  if (scanAll) {
    return walk(FRONT_MODULES);
  }

  /** @type {string[]} */
  const files = [];
  for (const relativeDirectory of DEFAULT_SCOPE_DIRS) {
    files.push(...walk(path.join(FRONT_MODULES, relativeDirectory)));
  }
  return files;
};

const files = collectFiles();
for (const filePath of files) {
  scanFile(filePath);
}

if (failures.length === 0) {
  console.log(
    `OK: no front rename/mismatch fails (${files.length} files, scope=${scanAll ? 'all' : 'arx-default'})`,
  );
  process.exit(0);
}

console.error(
  `FAIL: ${failures.length} front rename/mismatch hit(s) (${files.length} files scanned):\n`,
);
for (const failure of failures) {
  console.error(
    `[${failure.kind}] ${failure.file}:${failure.line}\n  ${failure.text}\n`,
  );
}

process.exit(failStrict ? 1 : 0);
