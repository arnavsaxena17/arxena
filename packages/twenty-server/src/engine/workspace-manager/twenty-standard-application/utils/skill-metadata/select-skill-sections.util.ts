// A skill that is large but used in slices marks each slice with this comment.
// Text before the first marker is always returned.
const SKILL_SECTION_MARKER = /^<!-- skill-section:([a-z0-9-]+) -->$/gm;

export const buildSkillSectionMarker = (sectionName: string): string =>
  `<!-- skill-section:${sectionName} -->`;

export type SelectedSkillSections = {
  content: string;
  availableSections: string[];
  unknownSections: string[];
};

// The always-on head and each marked section's body, keyed by section name.
// A skill without markers is all head.
export const splitSkillSections = (
  content: string,
): { head: string; bodies: Map<string, string> } => {
  const markers = [...content.matchAll(SKILL_SECTION_MARKER)];

  if (markers.length === 0) {
    return { head: content, bodies: new Map() };
  }

  return {
    head: content.slice(0, markers[0].index),
    bodies: new Map(
      markers.map((marker, index) => [
        marker[1],
        content.slice(
          marker.index + marker[0].length,
          markers[index + 1]?.index ?? content.length,
        ),
      ]),
    ),
  };
};

// Returns the always-on head plus only the requested sections. A skill without
// section markers, or a call without sections, returns the content unchanged.
export const selectSkillSections = (
  content: string,
  sections?: string[],
): SelectedSkillSections => {
  const { head, bodies } = splitSkillSections(content);
  const availableSections = [...bodies.keys()];

  if (bodies.size === 0 || sections === undefined || sections.length === 0) {
    return { content, availableSections, unknownSections: [] };
  }

  const wanted = [...new Set(sections)];
  const unknownSections = wanted.filter((section) => !bodies.has(section));
  const loaded = wanted.filter((section) => bodies.has(section));
  const notLoaded = availableSections.filter(
    (section) => !loaded.includes(section),
  );

  return {
    content: [
      head.trimEnd(),
      ...loaded.map((section) => bodies.get(section)?.trim() ?? ''),
      notLoaded.length > 0
        ? `---\nNot loaded: ${notLoaded.join(', ')}. Call load_skills again with \`sections\` to read them.`
        : '',
    ]
      .filter((part) => part.length > 0)
      .join('\n\n'),
    availableSections,
    unknownSections,
  };
};
