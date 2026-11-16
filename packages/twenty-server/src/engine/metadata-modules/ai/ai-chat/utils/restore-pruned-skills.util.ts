import { isNonEmptyString, isObject } from '@sniptt/guards';
import { type ModelMessage } from 'ai';

import { LOAD_SKILL_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/load-skill.tool';

type LoadedSkill = { name: string; content: string };

const parseOutputValue = (output: unknown): unknown => {
  if (!isObject(output)) {
    return undefined;
  }

  const { type, value } = output as { type?: unknown; value?: unknown };

  if (type === 'json') {
    return value;
  }

  if (type === 'text' && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const skillsOfOutput = (output: unknown): LoadedSkill[] => {
  const value = parseOutputValue(output);
  const skills = isObject(value) ? (value as { skills?: unknown }).skills : [];

  return Array.isArray(skills)
    ? skills.filter(
        (skill): skill is LoadedSkill =>
          isObject(skill) &&
          isNonEmptyString((skill as LoadedSkill).name) &&
          isNonEmptyString((skill as LoadedSkill).content),
      )
    : [];
};

// Latest load per skill name, in load order; a later load replaces an earlier
// one because it may have asked for other sections
export const collectLoadedSkills = (
  messages: ModelMessage[],
): Map<string, string> => {
  const loaded = new Map<string, string>();

  for (const message of messages) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (
        part.type !== 'tool-result' ||
        part.toolName !== LOAD_SKILL_TOOL_NAME
      ) {
        continue;
      }

      for (const skill of skillsOfOutput(part.output)) {
        loaded.delete(skill.name);
        loaded.set(skill.name, skill.content);
      }
    }
  }

  return loaded;
};

// Pruning keeps only the last tool-call pairs, so a skill loaded earlier in the
// thread would silently leave the context. Returns the skills it removed as a
// system prompt section, or undefined when none were removed.
export const buildRestoredSkillsSection = (
  messagesBeforePruning: ModelMessage[],
  messagesAfterPruning: ModelMessage[],
): string | undefined => {
  const before = collectLoadedSkills(messagesBeforePruning);
  const after = collectLoadedSkills(messagesAfterPruning);
  const removed = [...before.entries()].filter(
    ([name, content]) => after.get(name) !== content,
  );

  if (removed.length === 0) {
    return undefined;
  }

  return [
    '## Skills loaded earlier in this thread',
    '',
    'Older messages were pruned to fit the context window. These skills were loaded before that and still apply; do not load them again.',
    ...removed.map(
      ([name, content]) => `\n<skill name="${name}">\n${content}\n</skill>`,
    ),
  ].join('\n');
};
