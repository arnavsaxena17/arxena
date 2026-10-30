import { z } from 'zod';

import {
  ASK_QUESTIONS_TOOL_NAME,
  type AskQuestionsToolInput,
  type AskQuestionsToolResult,
} from 'twenty-shared/ai';

export { ASK_QUESTIONS_TOOL_NAME };

// A model sometimes leaves `label` out and only writes `description`, or sends
// a fifth question. Either used to fail the whole call and end the turn, so the
// schema accepts what can be repaired and `normalizeAskQuestionsInput` repairs
// it: a label from the description, at most four questions and four options.
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
                .optional()
                .describe(
                  'Concise option the user can pick (1-5 words). Required in practice: without it, a few words of the description are used.',
                ),
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
          .min(1)
          .max(4)
          .describe('2-4 mutually exclusive options.'),
        allowMultiSelect: z
          .boolean()
          .optional()
          .describe('Allow the user to select more than one option.'),
        allowFreeText: z
          .boolean()
          .optional()
          .describe(
            'Show that the user can type the exact requirement in their own words. Set it on any question whose answer may need a number, a range, a list of labels or a place.',
          ),
        freeTextHint: z
          .string()
          .max(120)
          .optional()
          .describe(
            'One example of what to type, e.g. "₹500-800 Cr, FY25" or "Pune and Chakan".',
          ),
      }),
    )
    .min(1)
    .max(4)
    .describe('One to four questions to ask the user.'),
});

type AskQuestionsDraftInput = z.infer<typeof askQuestionsInputSchema>;

const MAX_OPTIONS_PER_QUESTION = 4;
const MAX_QUESTIONS = 4;
const MAX_LABEL_WORDS = 5;
const MAX_LABEL_CHARACTERS = 48;

const labelFromDescription = (description: string | undefined): string => {
  const clause = (description ?? '')
    .replace(/\s+/g, ' ')
    .split(/[(—,;:.]/)[0]
    .replace(/[\s).]+$/g, '');
  const words = clause
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, MAX_LABEL_WORDS)
    .join(' ');

  return words.length > 0
    ? words.slice(0, MAX_LABEL_CHARACTERS)
    : 'Option';
};

// Repairs the shapes a model actually sends, so one malformed option does not
// throw away a whole question batch
export const normalizeAskQuestionsInput = (
  input: AskQuestionsDraftInput,
): AskQuestionsToolInput => ({
  questions: input.questions.slice(0, MAX_QUESTIONS).map((question) => {
    const options = question.options
      .slice(0, MAX_OPTIONS_PER_QUESTION)
      .map((option) => ({
        ...option,
        label:
          option.label?.trim() || labelFromDescription(option.description),
      }));
    const recommended = options.filter((option) => option.isRecommended);

    // At most one recommended option; keep the first, as the UI expects
    if (recommended.length > 1) {
      recommended
        .slice(1)
        .forEach((option) => Object.assign(option, { isRecommended: false }));
    }

    return { ...question, options };
  }),
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
    'user can always type a free-form answer instead of picking an option. Every option needs a ' +
    'short `label`; send at most four questions with two to four options each.',
  inputSchema: askQuestionsInputSchema,
  execute: async (
    input: AskQuestionsDraftInput,
  ): Promise<AskQuestionsPendingOutput> => ({
    success: true,
    message: 'Questions presented to the user; awaiting their answer.',
    result: { questions: normalizeAskQuestionsInput(input).questions, status: 'pending' },
  }),
});
