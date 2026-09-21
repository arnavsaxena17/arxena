import { type AgentResponseSchema } from 'twenty-shared/ai';

import { DEFAULT_JEV_SCORE_CRITERIA } from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';
import { type JevQuestions } from 'src/engine/metadata-modules/ai/ai-evaluation/types/jev-evaluation.type';

export type DecisionFieldLike = {
  name: string;
  type: string;
  description?: string;
  enumValues?: string[];
};

export const isJevCompatibleFilterField = (
  field: DecisionFieldLike,
): boolean => {
  const fieldType = field.type.toLowerCase();

  if (fieldType === 'boolean') {
    return true;
  }

  if (fieldType === 'enum') {
    return Array.isArray(field.enumValues) && field.enumValues.length >= 2;
  }

  return false;
};

export const canUseJevForFilterFields = (
  fields: DecisionFieldLike[],
): boolean => {
  return (
    fields.length > 0 &&
    fields.every((field) => isJevCompatibleFilterField(field))
  );
};

export const isDecisionOnlyAgentSchema = (
  schema: AgentResponseSchema,
): boolean => {
  const properties = Object.values(schema.properties ?? {});

  if (properties.length === 0) {
    return false;
  }

  return properties.every(
    (property) => property.type === 'boolean' || property.type === 'number',
  );
};

export const mapFilterFieldsToJevQuestions = (
  fields: DecisionFieldLike[],
  systemPrompt: string,
): JevQuestions => {
  const questions: JevQuestions = {};

  for (const field of fields) {
    const fieldType = field.type.toLowerCase();
    const instructions =
      field.description?.trim() ||
      `${systemPrompt}\n\nDecide the value for "${field.name}".`;

    if (fieldType === 'boolean') {
      questions[field.name] = {
        type: 'boolean',
        instructions,
      };
      continue;
    }

    if (fieldType === 'enum' && field.enumValues) {
      const criteria = Object.fromEntries(
        field.enumValues.map((enumValue) => [enumValue, enumValue]),
      );

      questions[field.name] = {
        type: 'choice',
        instructions,
        criteria,
      };
    }
  }

  return questions;
};

export const mapAgentSchemaToJevQuestions = (
  schema: AgentResponseSchema,
  contextPrompt: string,
): JevQuestions => {
  const questions: JevQuestions = {};

  for (const [propertyName, property] of Object.entries(schema.properties)) {
    const instructions =
      property.description?.trim() ||
      `${contextPrompt}\n\nDecide the value for "${propertyName}".`;

    if (property.type === 'boolean') {
      questions[propertyName] = {
        type: 'boolean',
        instructions,
      };
      continue;
    }

    if (property.type === 'number') {
      questions[propertyName] = {
        type: 'score',
        instructions,
        criteria: [...DEFAULT_JEV_SCORE_CRITERIA],
      };
    }
  }

  return questions;
};
