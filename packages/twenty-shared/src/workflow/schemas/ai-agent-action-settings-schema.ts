import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowAiAgentOutputValidationCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  instructions: z.string(),
  invalidWhen: z.string(),
  validWhen: z.string(),
});

export type WorkflowAiAgentOutputValidationCheck = z.infer<
  typeof workflowAiAgentOutputValidationCheckSchema
>;

// Yes on a check rejects the draft. These two wordings were calibrated on
// labeled outreach drafts on 2026-10-01.
export const DEFAULT_AI_AGENT_OUTPUT_VALIDATION_CHECKS: WorkflowAiAgentOutputValidationCheck[] =
  [
    {
      id: 'operatorNote',
      label: 'Operator note',
      instructions:
        'Does this text address the person who will send the message, instead of being the single message the prospect would receive on this channel?',
      invalidWhen:
        'It contains drafting notes, instructions to the sender, a strategy explanation, an AI self-reference, or more than one alternative version for the sender to choose.',
      validWhen:
        'It is a single message the prospect could receive as-is, even if it mentions a company, a role, or a meeting.',
    },
    {
      id: 'unresolvedPlaceholder',
      label: 'Unresolved blank',
      instructions:
        'Does this text still contain a blank the sender must fill before it can be sent to the prospect?',
      invalidWhen:
        "It includes a prose instruction to insert a missing value, such as a calendar link, company name, or the sender's name, or it names a variable the prospect would see.",
      validWhen:
        'Every detail in the text is already filled in. Naming a real company, person, or time is not a blank.',
    },
  ];

export const workflowAiAgentOutputValidationSchema = z.object({
  enabled: z.boolean(),
  fieldKeys: z.array(z.string()),
  checks: z.array(workflowAiAgentOutputValidationCheckSchema).optional(),
});

export const workflowAiAgentActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      agentId: z.string().optional(),
      prompt: z.string().optional(),
      outputValidation: workflowAiAgentOutputValidationSchema.optional(),
    }),
  });
