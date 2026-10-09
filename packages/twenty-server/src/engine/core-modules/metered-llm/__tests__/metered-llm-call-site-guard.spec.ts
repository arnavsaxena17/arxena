import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';

import { UNMETERED_LLM_CALL_SITES } from 'src/engine/core-modules/metered-llm/constants/unmetered-llm-call-sites.const';

const SOURCE_ROOT = join(__dirname, '..', '..', '..', '..');

const RAW_PROVIDER_CALL_PATTERN =
  /\.chat\.completions\.(create|parse|stream)\(|\.responses\.(create|parse|stream)\(|\.audio\.transcriptions\.create\(|[aA]nthropic\w*\.messages\.(create|stream)\(/;

const IGNORED_PATH_PATTERN =
  /\.spec\.ts$|\.live\.spec\.ts$|__tests__|\/test\/|fixtures|metered-llm\//;

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === 'node_modules'
        ? []
        : collectTypeScriptFiles(entryPath);
    }

    return entry.name.endsWith('.ts') ? [entryPath] : [];
  });

const findFilesWithRawProviderCalls = (): string[] =>
  collectTypeScriptFiles(SOURCE_ROOT)
    .map((filePath) => relative(SOURCE_ROOT, filePath).split(sep).join('/'))
    .filter((filePath) => !IGNORED_PATH_PATTERN.test(`/${filePath}`))
    .filter((filePath) => {
      const code = readFileSync(join(SOURCE_ROOT, filePath), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');

      return RAW_PROVIDER_CALL_PATTERN.test(code);
    })
    .sort();

describe('LLM call site guard', () => {
  const filesWithRawCalls = findFilesWithRawProviderCalls();

  it('should not allow new files to call an LLM provider without metering', () => {
    const unexpected = filesWithRawCalls.filter(
      (filePath) => !UNMETERED_LLM_CALL_SITES.includes(filePath),
    );

    expect(unexpected).toEqual([]);
  });

  it('should drop files from the allowlist once they are migrated', () => {
    const stale = UNMETERED_LLM_CALL_SITES.filter(
      (filePath) => !filesWithRawCalls.includes(filePath),
    );

    expect(stale).toEqual([]);
  });
});
