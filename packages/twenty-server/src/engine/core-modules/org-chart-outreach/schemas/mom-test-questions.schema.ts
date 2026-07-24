import { z } from 'zod';

export const momTestHypothesisTagSchema = z.enum(['T', 'M', 'M-r', 'V']);

export const momTestCoreQuestionSchema = z.object({
  question: z.string().min(1),
  tag: momTestHypothesisTagSchema,
  listen_for: z
    .string()
    .min(1)
    .describe(
      'What answer pattern would confirm vs kill the tagged hypothesis',
    ),
});

export const momTestMoneyProbeSchema = z.object({
  question: z.string().min(1),
  tag: momTestHypothesisTagSchema,
});

/** Structured Mom Test discovery-question output (JSON mode). */
export const momTestQuestionsLlmResultSchema = z.object({
  persona_read: z
    .string()
    .min(1)
    .describe(
      'One line — classified persona, seniority, key resume anchors used',
    ),
  core_questions: z
    .array(momTestCoreQuestionSchema)
    .min(4)
    .max(5),
  money_probes: z.array(momTestMoneyProbeSchema).min(2).max(3),
  trap_check: z
    .string()
    .min(1)
    .describe(
      'Biggest risk THIS interviewee gives bad data, and how to neutralize it',
    ),
});

export type MomTestHypothesisTag = z.infer<typeof momTestHypothesisTagSchema>;
export type MomTestCoreQuestion = z.infer<typeof momTestCoreQuestionSchema>;
export type MomTestMoneyProbe = z.infer<typeof momTestMoneyProbeSchema>;
export type MomTestQuestionsLlmResult = z.infer<
  typeof momTestQuestionsLlmResultSchema
>;
