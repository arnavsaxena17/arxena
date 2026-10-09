import { z } from 'zod';

export const StartOutreachInputZodSchema = z
  .object({
    projectId: z
      .string()
      .uuid()
      .describe('Project id from the outreachCommand browsing context'),
    candidateIds: z
      .array(z.string().uuid())
      .optional()
      .describe(
        'Candidate ids to start (selectedCandidateIds from the browsing context)',
      ),
    personIds: z
      .array(z.string().uuid())
      .optional()
      .describe(
        'Person ids to start when no candidate ids are known (selectedPersonIds)',
      ),
    startAllQueuedInProject: z
      .boolean()
      .optional()
      .describe(
        'true = start every enrolled QUEUED prospect of the project that is not started or stopped yet (the whole table). Only when the user asked for everyone and nothing is selected.',
      ),
  })
  .refine(
    (input) =>
      input.startAllQueuedInProject === true ||
      (input.candidateIds?.length ?? 0) > 0 ||
      (input.personIds?.length ?? 0) > 0,
    {
      message:
        'Pass candidateIds, personIds, or startAllQueuedInProject=true',
    },
  );

export type StartOutreachInput = z.infer<typeof StartOutreachInputZodSchema>;
