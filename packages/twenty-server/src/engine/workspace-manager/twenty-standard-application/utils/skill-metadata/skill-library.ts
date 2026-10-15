import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { STANDARD_SKILL } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import {
  parseSkillFrontMatter,
  splitSkillFrontMatter,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/parse-skill-front-matter.util';
import { buildSkillSectionMarker } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/select-skill-sections.util';
import { type SkillFrontMatter } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-front-matter.type';

// Every skill is a markdown file in ./contents. The build copies that folder, so
// the same code reads it from src in tests and from dist at runtime.
const CONTENTS_DIRECTORY = join(__dirname, 'contents');
const FRAGMENTS_DIRECTORY = join(CONTENTS_DIRECTORY, 'fragments');
const NON_SKILL_FILES = new Set(['README']);
const INCLUDE_PATTERN = /^\{\{include: ([a-z0-9-]+)\}\}$/gm;

// The `search` skill is one text assembled from these files, in order. Only the
// first carries front matter; the rest become sections named after the file.
export const SEARCH_SKILL_PARTS = [
  'search-preamble',
  'search-companies',
  'search-people',
  'search-people-by-company',
] as const;

type Library = {
  bodies: Map<string, string>;
  frontMatter: Map<string, SkillFrontMatter>;
};

let library: Library | undefined;

const readFragments = (): Map<string, string> => {
  const fragments = new Map<string, string>();

  for (const fileName of readdirSync(FRAGMENTS_DIRECTORY)) {
    if (!fileName.endsWith('.md')) {
      continue;
    }

    const content = readFileSync(
      join(FRAGMENTS_DIRECTORY, fileName),
      'utf-8',
    ).trimEnd();

    if (new RegExp(INCLUDE_PATTERN.source, 'm').test(content)) {
      throw new Error(`Fragment ${fileName} includes another fragment`);
    }

    fragments.set(fileName.replace(/\.md$/, ''), content);
  }

  return fragments;
};

const loadLibrary = (): Library => {
  const fragments = readFragments();
  const bodies = new Map<string, string>();
  const frontMatter = new Map<string, SkillFrontMatter>();

  for (const fileName of readdirSync(CONTENTS_DIRECTORY)) {
    const name = fileName.replace(/\.md$/, '');

    if (!fileName.endsWith('.md') || NON_SKILL_FILES.has(name)) {
      continue;
    }

    const split = splitSkillFrontMatter(
      readFileSync(join(CONTENTS_DIRECTORY, fileName), 'utf-8'),
    );

    if (split.frontMatterText !== null) {
      frontMatter.set(
        name,
        parseSkillFrontMatter(fileName, split.frontMatterText),
      );
    }

    bodies.set(
      name,
      split.body.replace(INCLUDE_PATTERN, (_line, fragmentName: string) => {
        const fragment = fragments.get(fragmentName);

        if (fragment === undefined) {
          throw new Error(`Skill ${fileName}: unknown fragment "${fragmentName}"`);
        }

        return fragment;
      }),
    );
  }

  return { bodies, frontMatter };
};

const getLibrary = (): Library => (library ??= loadLibrary());

const frontMatterFileName = (name: string): string =>
  name === 'search' ? SEARCH_SKILL_PARTS[0] : name;

export const listSkillNames = (): string[] => {
  const searchParts = new Set<string>(SEARCH_SKILL_PARTS);

  return [
    ...[...getLibrary().bodies.keys()].filter((name) => !searchParts.has(name)),
    'search',
  ].sort((first, second) => first.localeCompare(second));
};

export const getSkillContent = (name: string): string => {
  const { bodies } = getLibrary();
  const read = (fileName: string): string => {
    const body = bodies.get(fileName);

    if (body === undefined) {
      throw new Error(`Missing skill markdown: ${fileName}`);
    }

    return body;
  };

  if (name !== 'search') {
    return read(name);
  }

  const [preamble, ...sections] = SEARCH_SKILL_PARTS;

  return [
    read(preamble),
    ...sections.map(
      (fileName) =>
        `${buildSkillSectionMarker(fileName.replace(/^search-/, ''))}\n${read(fileName)}`,
    ),
  ].join('\n');
};

// Undefined for a skill that has no front matter
export const getSkillFrontMatter = (
  name: string,
): SkillFrontMatter | undefined =>
  getLibrary().frontMatter.get(frontMatterFileName(name));

const requireFrontMatter = (name: string): SkillFrontMatter => {
  const frontMatter = getSkillFrontMatter(name);

  if (frontMatter === undefined) {
    throw new Error(`Skill ${name} has no front matter`);
  }

  return frontMatter;
};

// Skills with front matter, which are the ones the routing lines come from
export const listRoutedSkillNames = (): string[] =>
  listSkillNames().filter((name) => getSkillFrontMatter(name) !== undefined);

// A playbook is a skill file with front matter and no entry in STANDARD_SKILL:
// writing the file is all it takes to add one.
export const listPlaybookNames = (): string[] =>
  listRoutedSkillNames().filter(
    (name) => !Object.prototype.hasOwnProperty.call(STANDARD_SKILL, name),
  );

export const getSkillDescription = (name: string): string =>
  requireFrontMatter(name).description;

const titleCase = (name: string): string =>
  name
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');

export const getSkillLabel = (name: string): string =>
  requireFrontMatter(name).label ?? titleCase(name);

export const getSkillIcon = (name: string): string =>
  requireFrontMatter(name).icon ?? 'IconBook';
