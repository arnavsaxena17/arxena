import {
  getSkillFrontMatter,
  listRoutedSkillNames,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

export type RoutingLineOptions = {
  // Extra skills a surface loads alongside a skill (e.g. outreach + workflow-building)
  extraSkillNames?: Record<string, string[]>;
  // Surface-only text added to a skill's routing lines
  routingLineSuffixes?: Record<string, string>;
};

const buildLoadSkillCall = (
  skillName: string,
  options: RoutingLineOptions,
): string => {
  const skillNames = [skillName, ...(options.extraSkillNames?.[skillName] ?? [])];

  return `\`load_skills([${skillNames.map((name) => `"${name}"`).join(', ')}])\``;
};

// Attaches to the load call without a space after punctuation (". Keep ...")
const joinHint = (hint: string): string =>
  /^[.,;:]/.test(hint) ? hint : ` ${hint}`;

// One line per route in each skill's front matter, ordered by skill priority.
// Surfaces add text through routingLineSuffixes, at {suffix} in the hint or at the end.
export const buildRoutingLines = (options: RoutingLineOptions = {}): string =>
  listRoutedSkillNames()
    .map((skillName) => ({
      skillName,
      frontMatter: getSkillFrontMatter(skillName)!,
    }))
    .sort(
      (first, second) =>
        first.frontMatter.priority - second.frontMatter.priority ||
        first.skillName.localeCompare(second.skillName),
    )
    .flatMap(({ skillName, frontMatter }) =>
      frontMatter.routes.map((route) => {
        const suffix = options.routingLineSuffixes?.[skillName] ?? '';
        const sectionsText =
          route.sections === undefined
            ? ''
            : ` with \`sections: ${JSON.stringify(route.sections)}\``;
        const hint = route.hint ?? '';
        const hintText = hint.includes('{suffix}')
          ? joinHint(hint.replace('{suffix}', suffix))
          : `${hint === '' ? '' : joinHint(hint)}${suffix}`;

        return `- ${route.when} → ${buildLoadSkillCall(skillName, options)}${sectionsText}${hintText}`;
      }),
    )
    .join('\n');
