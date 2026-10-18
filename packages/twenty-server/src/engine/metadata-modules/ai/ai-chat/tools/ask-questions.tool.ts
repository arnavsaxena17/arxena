import { z } from 'zod';

import {
  ASK_QUESTIONS_TOOL_NAME,
  type AskQuestionsToolInput,
  type AskQuestionsToolResult,
} from 'twenty-shared/ai';

export { ASK_QUESTIONS_TOOL_NAME };

export const askQuestionsInputSchema = z.object({
  questions: z
    .array(
      z.object({
        header: z
          .string()
          .describe(
            'Very short label/tag for the question (≤ ~32 chars), e.g. "Email type".',
          ),
        question: z
          .string()
          .describe(
            'The full question to ask the user. Be clear and specific.',
          ),
        options: z
          .array(
            z.object({
              label: z
                .string()
                .describe('Concise option the user can pick (1-5 words).'),
              description: z
                .string()
                .optional()
                .describe(
                  'Longer explanation shown when the user opens the option info icon.',
                ),
              isRecommended: z
                .boolean()
                .optional()
                .describe('Mark the single suggested option, if any.'),
            }),
          )
          .min(2)
          .max(4)
          .refine(
            (options) =>
              options.filter((option) => option.isRecommended === true)
                .length <= 1,
            { message: 'At most one option can be marked as recommended.' },
          )
          .describe('2-4 mutually exclusive options.'),
        allowMultiSelect: z
          .boolean()
          .optional()
          .describe('Allow the user to select more than one option.'),
      }),
    )
    .min(1)
    .max(4)
    .describe('One to four questions to ask the user.'),
});

type AskQuestionsPendingOutput = {
  success: true;
  message: string;
  result: AskQuestionsToolResult;
};

export const createAskQuestionsTool = () => ({
  description:
    'Ask the user one or more multiple-choice questions when in doubt: ambiguous intent, ' +
    'conflicting instructions, or a consequential next step without a clear go-ahead. Prefer ' +
    'this over guessing. The conversation pauses until they answer. Do NOT use it for ' +
    'information you could look up with another tool, or for trivial choices with an obvious ' +
    'default. Exception: when Outreach browsing context has no projectId, you MUST ask which ' +
    'project to tag Find results to — a similar project name is not an obvious default. The ' +
    'user can always type a free-form answer instead of picking an option.',
  inputSchema: askQuestionsInputSchema,
  execute: async (
    input: AskQuestionsToolInput,
  ): Promise<AskQuestionsPendingOutput> => ({
    success: true,
    message: 'Questions presented to the user; awaiting their answer.',
    result: { questions: input.questions, status: 'pending' },
  }),
});
