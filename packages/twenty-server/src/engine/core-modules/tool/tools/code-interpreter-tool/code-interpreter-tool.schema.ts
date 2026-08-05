import { z } from 'zod';

export const CodeInterpreterInputZodSchema = z.object({
  code: z.string().describe('Python code to execute'),
  files: z
    .array(
      z.object({
        filename: z.string().describe('Name of the file'),
        fileId: z
          .string()
          .describe(
            'AgentChat file id to mount at /home/user/{filename}: user attachments, code_interpreter outputs, or spilled tool-output fileIds (outputRef.fileId when a prior tool result was too large to inline).',
          ),
      }),
    )
    .optional()
    .describe('Files to make available in the execution environment'),
  loadingMessage: z
    .string()
    .describe(
      "A brief, present-tense status message shown to the user while the code runs (e.g., 'Analyzing sales data').",
    ),
  completedMessage: z
    .string()
    .optional()
    .describe(
      "A brief, past-tense status message shown to the user after the code finishes (e.g., 'Analyzed sales data'). No exclamation marks. Don't be optimistic, stay neutral on completion state. Falls back to the loading message when omitted.",
    ),
});
