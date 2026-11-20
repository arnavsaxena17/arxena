import { isNonEmptyString, isObject } from '@sniptt/guards';
import { type ModelMessage } from 'ai';
import { ASK_QUESTIONS_TOOL_NAME } from 'twenty-shared/ai';

import { EXECUTE_TOOL_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/execute-tool.tool';
import { GET_TOOL_CATALOG_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/get-tool-catalog.tool';
import { LEARN_TOOLS_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/learn-tools.tool';
import { LOAD_SKILL_TOOL_NAME } from 'src/engine/core-modules/tool-provider/tools/load-skill.tool';
import { splitSkillSections } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/select-skill-sections.util';

// Sections that decide which path a request takes. Once a tool has run on that
// path they have done their job, so earlier requests' copies are dropped.
export const ROUTING_ONLY_SKILL_SECTIONS = new Set([
  'requirements',
  'for-sales',
  'for-recruiting',
  'playbook-company-first',
  'intent-glossary',
]);

// Calls that only plan: loading guidance, learning tools, asking the user. A
// call of anything else means the plan was set and a tool ran on it.
const PLANNING_TOOL_NAMES = new Set([
  LOAD_SKILL_TOOL_NAME,
  LEARN_TOOLS_TOOL_NAME,
  GET_TOOL_CATALOG_TOOL_NAME,
  ASK_QUESTIONS_TOOL_NAME,
]);

const HEAD_KEY = '__head__';

type SkillSource = { name: string; content: string };

export type HistoryCompactionStats = {
  reasoningPartsDropped: number;
  skillSectionsDropped: number;
  toolSchemasDropped: number;
  charsBefore: number;
  charsAfter: number;
};

type ToolOutput = { type?: unknown; value?: unknown };

const readOutputValue = (output: unknown): unknown => {
  if (!isObject(output)) {
    return undefined;
  }

  const { type, value } = output as ToolOutput;

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

// Writes a value back in the output's own encoding
const writeOutputValue = (output: unknown, value: unknown): unknown =>
  (output as ToolOutput).type === 'text'
    ? { ...(output as object), value: JSON.stringify(value) }
    : { ...(output as object), value };

const firstSentence = (text: unknown): string => {
  if (typeof text !== 'string') {
    return '';
  }

  const match = text.match(/^[\s\S]*?[.!?](\s|$)/);

  return (match?.[0] ?? text).trim().slice(0, 240);
};

// Every tool the history actually ran, by its real name: a direct call, or
// the toolName inside execute_tool
const collectCalledToolNames = (messages: ModelMessage[]): Set<string> => {
  const called = new Set<string>();

  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (part.type !== 'tool-call') {
        continue;
      }

      if (part.toolName === EXECUTE_TOOL_TOOL_NAME) {
        const toolName = isObject(part.input)
          ? (part.input as { toolName?: unknown }).toolName
          : undefined;

        if (isNonEmptyString(toolName)) {
          called.add(toolName);
        }
      } else {
        called.add(part.toolName);
      }
    }
  }

  return called;
};

// Index of the first message after which a non-planning tool ran, so a
// load before it had its plan set
const lastWorkingCallIndex = (messages: ModelMessage[]): number => {
  let last = -1;

  messages.forEach((message, index) => {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      return;
    }

    const works = message.content.some(
      (part) =>
        part.type === 'tool-call' && !PLANNING_TOOL_NAMES.has(part.toolName),
    );

    if (works) {
      last = index;
    }
  });

  return last;
};

type LoadedSkillCopy = {
  messageIndex: number;
  partIndex: number;
  skillIndex: number;
  name: string;
  content: string;
};

const collectLoadedSkillCopies = (
  messages: ModelMessage[],
): LoadedSkillCopy[] => {
  const copies: LoadedSkillCopy[] = [];

  messages.forEach((message, messageIndex) => {
    if (message.role !== 'tool' || !Array.isArray(message.content)) {
      return;
    }

    message.content.forEach((part, partIndex) => {
      if (
        part.type !== 'tool-result' ||
        part.toolName !== LOAD_SKILL_TOOL_NAME
      ) {
        return;
      }

      const value = readOutputValue(part.output);
      const skills = isObject(value)
        ? (value as { skills?: unknown }).skills
        : undefined;

      if (!Array.isArray(skills)) {
        return;
      }

      skills.forEach((skill, skillIndex) => {
        const { name, content } = (skill ?? {}) as {
          name?: unknown;
          content?: unknown;
        };

        if (isNonEmptyString(name) && isNonEmptyString(content)) {
          copies.push({ messageIndex, partIndex, skillIndex, name, content });
        }
      });
    });
  });

  return copies;
};

// The pieces of a skill (head and each section) that a loaded copy contains,
// found by their text since load_skills drops the section markers
const piecesInCopy = (
  copyContent: string,
  source: SkillSource | undefined,
): Map<string, string> => {
  const pieces = new Map<string, string>();

  if (source === undefined) {
    return pieces;
  }

  const { head, bodies } = splitSkillSections(source.content);
  const headText = head.trimEnd();

  if (headText.length > 0 && copyContent.includes(headText)) {
    pieces.set(HEAD_KEY, headText);
  }

  for (const [section, body] of bodies) {
    const bodyText = body.trim();

    if (bodyText.length > 0 && copyContent.includes(bodyText)) {
      pieces.set(section, bodyText);
    }
  }

  return pieces;
};

// Shrinks the history a request starts from. It runs once, before the first
// step, on messages from earlier requests only: the steps of the current
// request are never rewritten, so the prompt cache stays valid within a run.
// - Reasoning: only the last assistant message keeps it (some providers need
//   the latest one to continue a tool call); older reasoning is replayed text
//   the model no longer acts on.
// - Skills: a section loaded again later keeps only the later copy, and a
//   routing-only section is dropped once a tool ran after it.
// - learn_tools: a tool never called keeps its name and one line; its schema
//   is a learn_tools call away.
export const compactHistoryForModel = ({
  messages,
  skillCatalog,
}: {
  messages: ModelMessage[];
  skillCatalog: SkillSource[];
}): { messages: ModelMessage[]; stats: HistoryCompactionStats } => {
  const stats: HistoryCompactionStats = {
    reasoningPartsDropped: 0,
    skillSectionsDropped: 0,
    toolSchemasDropped: 0,
    charsBefore: JSON.stringify(messages).length,
    charsAfter: 0,
  };
  const sourceByName = new Map(
    skillCatalog.map((skill) => [skill.name, skill]),
  );
  const calledToolNames = collectCalledToolNames(messages);
  const lastWorkIndex = lastWorkingCallIndex(messages);
  const lastAssistantIndex = messages.reduce(
    (last, message, index) => (message.role === 'assistant' ? index : last),
    -1,
  );

  // What each loaded copy should lose, keyed "message:part:skill"
  const copies = collectLoadedSkillCopies(messages);
  const newContentByCopy = new Map<string, string>();

  copies.forEach((copy, copyIndex) => {
    const source = sourceByName.get(copy.name);
    const pieces = piecesInCopy(copy.content, source);
    const laterPieces = new Set(
      copies
        .slice(copyIndex + 1)
        .filter((later) => later.name === copy.name)
        .flatMap((later) => [...piecesInCopy(later.content, source).keys()]),
    );
    const planWasSet = lastWorkIndex > copy.messageIndex;
    const dropped: string[] = [];
    let content = copy.content;

    for (const [piece, text] of pieces) {
      const reloaded = laterPieces.has(piece);
      const routingDone = planWasSet && ROUTING_ONLY_SKILL_SECTIONS.has(piece);

      if (reloaded || routingDone) {
        content = content.replace(text, '');
        dropped.push(piece === HEAD_KEY ? 'skill overview' : piece);
      }
    }

    if (dropped.length > 0) {
      stats.skillSectionsDropped += dropped.length;
      newContentByCopy.set(
        `${copy.messageIndex}:${copy.partIndex}:${copy.skillIndex}`,
        `${content.replace(/\n{3,}/g, '\n\n').trim()}\n\n[Dropped from this earlier copy: ${dropped.join(', ')} (loaded again later or used only to choose the path). Call load_skills with these sections to read them again.]`,
      );
    }
  });

  const compacted = messages.map((message, messageIndex): ModelMessage => {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      if (messageIndex === lastAssistantIndex) {
        return message;
      }

      const content = message.content.filter(
        (part) => part.type !== 'reasoning',
      );

      stats.reasoningPartsDropped += message.content.length - content.length;

      return content.length === message.content.length
        ? message
        : { ...message, content };
    }

    if (message.role !== 'tool' || !Array.isArray(message.content)) {
      return message;
    }

    let changed = false;
    const content = message.content.map((part, partIndex) => {
      if (part.type !== 'tool-result') {
        return part;
      }

      if (part.toolName === LOAD_SKILL_TOOL_NAME) {
        const value = readOutputValue(part.output) as
          | { skills?: Array<Record<string, unknown>> }
          | undefined;

        if (!Array.isArray(value?.skills)) {
          return part;
        }

        let skillsChanged = false;
        const skills = value.skills.map((skill, skillIndex) => {
          const replacement = newContentByCopy.get(
            `${messageIndex}:${partIndex}:${skillIndex}`,
          );

          if (replacement === undefined) {
            return skill;
          }

          skillsChanged = true;

          return { ...skill, content: replacement };
        });

        if (!skillsChanged) {
          return part;
        }

        changed = true;

        return {
          ...part,
          output: writeOutputValue(part.output, { ...value, skills }),
        } as typeof part;
      }

      if (part.toolName === LEARN_TOOLS_TOOL_NAME) {
        const value = readOutputValue(part.output) as
          | { tools?: Array<Record<string, unknown>> }
          | undefined;

        if (!Array.isArray(value?.tools)) {
          return part;
        }

        let toolsChanged = false;
        const tools = value.tools.map((tool) => {
          if (
            !isNonEmptyString(tool.name) ||
            calledToolNames.has(tool.name) ||
            tool.inputSchema === undefined
          ) {
            return tool;
          }

          toolsChanged = true;
          stats.toolSchemasDropped += 1;

          return {
            name: tool.name,
            description: firstSentence(tool.description),
            schemaOmitted:
              'Not called yet; call learn_tools for this tool before using it.',
          };
        });

        if (!toolsChanged) {
          return part;
        }

        changed = true;

        return {
          ...part,
          output: writeOutputValue(part.output, { ...value, tools }),
        } as typeof part;
      }

      return part;
    });

    return changed ? ({ ...message, content } as ModelMessage) : message;
  });

  stats.charsAfter = JSON.stringify(compacted).length;

  return { messages: compacted, stats };
};
