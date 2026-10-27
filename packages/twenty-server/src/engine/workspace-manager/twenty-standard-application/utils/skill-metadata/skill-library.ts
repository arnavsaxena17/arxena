import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { STANDARD_SKILL } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import {
  parseSkillFrontMatter,
  splitSkillFrontMatter,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/parse-skill-front-matter.util';
import {
  renderSourcingFacts,
  renderSourcingSources,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/render-sourcing-sources.util';
import { buildSkillSectionMarker } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/select-skill-sections.util';
import { type SkillFrontMatter } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-front-matter.type';

// Every skill is a markdown file in ./contents. The build copies that folder, so
// the same code reads it from src in tests and from dist at runtime.
const CONTENTS_DIRECTORY = join(__dirname, 'contents');
const FRAGMENTS_DIRECTORY = join(CONTENTS_DIRECTORY, 'fragments');
const NON_SKILL_FILES = new Set(['README']);
const INCLUDE_PATTERN = /^\{\{include: ([a-z0-9-]+)\}\}$/gm;

// A skill renamed after workspaces stored it. Old names still load, so a chat
// or an MCP client that remembers `search` keeps working.
export const SKILL_NAME_ALIASES: Readonly<Record<string, string>> = {
  search: 'sourcing',
};

export const canonicalSkillName = (name: string): string =>
  SKILL_NAME_ALIASES[name] ?? name;

type Library = {
  bodies: Map<string, string>;
  frontMatter: Map<string, SkillFrontMatter>;
  // Files that are parts of a longer skill, not skills of their own
  partFileNames: Set<string>;
};

const partFileName = (skillName: string, part: string): string =>
  `${skillName}-${part}`;

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

    // Includes first, so a fragment can quote the source registry too
    bodies.set(
      name,
      renderSourcingSources(
        split.body.replace(INCLUDE_PATTERN, (_line, fragmentName: string) => {
          const fragment = fragments.get(fragmentName);

          if (fragment === undefined) {
            throw new Error(
              `Skill ${fileName}: unknown fragment "${fragmentName}"`,
            );
          }

          return fragment;
        }),
      ),
    );
  }

  const partFileNames = new Set<string>();

  for (const [skillName, skillFrontMatter] of frontMatter) {
    for (const part of skillFrontMatter.parts ?? []) {
      const fileName = partFileName(skillName, part);

      if (!bodies.has(fileName)) {
        throw new Error(
          `Skill ${skillName}: part "${part}" has no file ${fileName}.md`,
        );
      }

      partFileNames.add(fileName);
    }
  }

  return { bodies, frontMatter, partFileNames };
};

const getLibrary = (): Library => (library ??= loadLibrary());

// Shared text (fragments/*.md), for server-side prompts that must say the same
// thing a skill says, such as the scorer and the title expanders
export const getSkillFragment = (name: string): string => {
  const fragment = readFragments().get(name);

  if (fragment === undefined) {
    throw new Error(`Unknown skill fragment: ${name}`);
  }

  return renderSourcingFacts(fragment);
};

export const listSkillNames = (): string[] => {
  const { bodies, partFileNames } = getLibrary();

  return [...bodies.keys()]
    .filter((name) => !partFileNames.has(name))
    .sort((first, second) => first.localeCompare(second));
};

export const getSkillContent = (requestedName: string): string => {
  const name = canonicalSkillName(requestedName);
  const { bodies, frontMatter } = getLibrary();
  const read = (fileName: string): string => {
    const body = bodies.get(fileName);

    if (body === undefined) {
      throw new Error(`Missing skill markdown: ${fileName}`);
    }

    return body;
  };
  const parts = frontMatter.get(name)?.parts;

  if (parts === undefined) {
    return read(name);
  }

  return [
    read(name),
    ...parts.map(
      (part) =>
        `${buildSkillSectionMarker(part)}\n${read(partFileName(name, part))}`,
    ),
  ].join('\n');
};

// Undefined for a skill that has no front matter
export const getSkillFrontMatter = (
  name: string,
): SkillFrontMatter | undefined =>
  getLibrary().frontMatter.get(canonicalSkillName(name));

// What a load_skills call returns for a long skill: the sections asked for (or
// the skill's default ones when none were), plus the sections they require.
// Undefined means the whole skill, as for a skill without parts.
export const resolveSkillSections = (
  name: string,
  requested?: string[],
): string[] | undefined => {
  const frontMatter = getSkillFrontMatter(name);

  if (frontMatter?.parts === undefined) {
    return requested;
  }

  const wanted =
    requested !== undefined && requested.length > 0
      ? requested
      : frontMatter.defaultSections;

  if (wanted === undefined) {
    return requested;
  }

  // Unknown names pass through, so the tool can report them
  return [
    ...new Set(
      wanted.flatMap((section) => [
        section,
        ...(frontMatter.requires?.[section] ?? []),
      ]),
    ),
  ];
};

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
