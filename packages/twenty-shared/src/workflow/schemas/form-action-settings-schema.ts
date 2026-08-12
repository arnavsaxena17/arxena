import { z } from 'zod';
import { FieldMetadataType } from '../../types/FieldMetadataType';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowFormNotifyOnPendingSchema = z.object({
  channels: z.array(z.string()).min(1),
  // Shown as WhatsApp template {{1}} — supports workflow variable tokens
  contextTemplate: z.string(),
  // Shown as WhatsApp template {{2}} — optional; falls back to field labels
  detailsTemplate: z.string().optional(),
  whatsappOfficialRegistryName: z.string().optional(),
  recipients: z
    .object({
      WHATSAPP_OFFICIAL: z.string().optional(),
      WHATSAPP_UNIPILE: z.string().optional(),
      unipileAccountId: z.string().optional(),
    })
    .optional(),
});

export const workflowFormActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        label: z.string(),
        type: z.union([
          z.literal(FieldMetadataType.TEXT),
          z.literal(FieldMetadataType.NUMBER),
          z.literal(FieldMetadataType.DATE),
          z.literal(FieldMetadataType.BOOLEAN),
          z.literal(FieldMetadataType.SELECT),
          z.literal(FieldMetadataType.MULTI_SELECT),
          z.literal('RECORD'),
        ]),
        placeholder: z.string().optional(),
        settings: z.record(z.string(), z.any()).optional(),
        value: z.any().optional(),
      }),
    ),
    notifyOnPending: workflowFormNotifyOnPendingSchema.optional(),
  });
