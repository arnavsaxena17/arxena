import { parse } from 'yaml';

import {
  type SkillFrontMatter,
  type SkillRoute,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-front-matter.type';

const FRONT_MATTER_PATTERN = /^---\n([\s\S]*?)\n---\n/;
const TOP_LEVEL_KEYS = new Set([
  'label',
  'icon',
  'description',
  'priority',
  'routes',
  'parts',
  'requires',
  'defaultSections',
]);
const ROUTE_KEYS = new Set(['when', 'sections', 'hint']);

export const splitSkillFrontMatter = (
  raw: string,
): { frontMatterText: string | null; body: string } => {
  const match = FRONT_MATTER_PATTERN.exec(raw);

  return match === null
    ? { frontMatterText: null, body: raw }
    : { frontMatterText: match[1], body: raw.slice(match[0].length) };
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

// Normal YAML, checked strictly: an unknown key or a missing field fails with the
// file name. The skill tests parse every skill, so a mistake fails the build and
// never reaches the prompt.
export const parseSkillFrontMatter = (
  fileName: string,
  text: string,
): SkillFrontMatter => {
  const fail = (message: string): never => {
    throw new Error(`Skill ${fileName}: front matter ${message}`);
  };
  let parsed: unknown;

  try {
    parsed = parse(text);
  } catch (error) {
    return fail(
      `is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail('must be a mapping of keys to values');
  }

  const record = parsed as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      fail(`has an unknown key "${key}"`);
    }
  }

  if (!isNonEmptyString(record.description)) {
    fail('has no description');
  }

  if (typeof record.priority !== 'number') {
    fail('has no numeric priority');
  }

  for (const key of ['label', 'icon'] as const) {
    if (record[key] !== undefined && !isNonEmptyString(record[key])) {
      fail(`has a "${key}" that is not text`);
    }
  }

  if (!Array.isArray(record.routes) || record.routes.length === 0) {
    return fail('has no routes');
  }

  const isNameList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(isNonEmptyString);

  for (const key of ['parts', 'defaultSections'] as const) {
    if (record[key] !== undefined && !isNameList(record[key])) {
      fail(`has "${key}" that is not a list of names`);
    }
  }

  if (record.requires !== undefined) {
    const requires = record.requires;

    if (
      typeof requires !== 'object' ||
      requires === null ||
      Array.isArray(requires) ||
      !Object.values(requires).every(isNameList)
    ) {
      fail('has "requires" that is not a mapping of section to a list of names');
    }
  }

  if (record.parts !== undefined) {
    const parts = new Set(record.parts as string[]);
    const named = [
      ...((record.defaultSections as string[] | undefined) ?? []),
      ...Object.entries((record.requires ?? {}) as Record<string, string[]>).flat(
        2,
      ),
    ];

    for (const name of named) {
      if (!parts.has(name)) {
        fail(`names the section "${name}", which is not in "parts"`);
      }
    }
  }

  for (const route of record.routes as Array<Record<string, unknown>>) {
    if (typeof route !== 'object' || route === null) {
      fail('has a route that is not a mapping');
    }

    for (const key of Object.keys(route)) {
      if (!ROUTE_KEYS.has(key)) {
        fail(`has an unknown route key "${key}"`);
      }
    }

    if (!isNonEmptyString(route.when)) {
      fail('has a route without "when"');
    }

    if (
      route.sections !== undefined &&
      (!Array.isArray(route.sections) ||
        !route.sections.every(isNonEmptyString))
    ) {
      fail('has "sections" that is not a list of names');
    }

    if (route.hint !== undefined && !isNonEmptyString(route.hint)) {
      fail('has a "hint" that is not text');
    }
  }

  return record as unknown as SkillFrontMatter;
};

export type { SkillRoute };
