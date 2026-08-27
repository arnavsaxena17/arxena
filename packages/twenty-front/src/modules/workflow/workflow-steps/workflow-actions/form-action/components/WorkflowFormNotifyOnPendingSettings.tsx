import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { Select } from '@/ui/input/components/Select';
import { type WorkflowFormAction } from '@/workflow/types/Workflow';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { MessagingChannel, MESSAGING_CHANNEL_LABELS } from 'twenty-shared/arx';
import { Checkbox } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const NOTIFY_CHANNEL_OPTIONS = [
  {
    label: MESSAGING_CHANNEL_LABELS[MessagingChannel.WHATSAPP_OFFICIAL],
    value: MessagingChannel.WHATSAPP_OFFICIAL,
  },
  {
    label: MESSAGING_CHANNEL_LABELS[MessagingChannel.WHATSAPP_UNIPILE],
    value: MessagingChannel.WHATSAPP_UNIPILE,
  },
] as const;

const DEFAULT_CONTEXT_TEMPLATE =
  'Please complete the pending workflow form.';

const DEFAULT_WHATSAPP_OFFICIAL_REGISTRY_NAME = 'wf_form_boolean_text';

const StyledSection = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  margin-top: ${themeCssVariables.spacing[4]};
  padding-bottom: ${themeCssVariables.spacing[4]};
  padding-left: ${themeCssVariables.spacing[7]};
  padding-right: ${themeCssVariables.spacing[7]};
  padding-top: ${themeCssVariables.spacing[4]};
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
`;

const StyledFieldHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledCheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledChannelRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFieldsGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledFieldWithHint = styled.div`
  display: flex;
  flex-direction: column;
`;

type NotifyOnPendingSettings = {
  channels: string[];
  contextTemplate: string;
  detailsTemplate?: string;
  whatsappOfficialRegistryName?: string;
  recipients?: {
    [MessagingChannel.WHATSAPP_OFFICIAL]?: string;
    [MessagingChannel.WHATSAPP_UNIPILE]?: string;
    unipileAccountId?: string;
  };
};

type WorkflowFormNotifyOnPendingSettingsProps = {
  action: WorkflowFormAction;
  readonly: boolean;
  onActionUpdate?: (action: WorkflowFormAction) => void;
};

export const WorkflowFormNotifyOnPendingSettings = ({
  action,
  readonly,
  onActionUpdate,
}: WorkflowFormNotifyOnPendingSettingsProps) => {
  const { t } = useLingui();
  const notifyOnPending = (
    action.settings as {
      notifyOnPending?: NotifyOnPendingSettings;
    }
  ).notifyOnPending;

  const [enabled, setEnabled] = useState(Boolean(notifyOnPending));

  const updateNotify = (next: NotifyOnPendingSettings | undefined) => {
    if (!onActionUpdate || readonly) {
      return;
    }

    onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        ...(next
          ? { notifyOnPending: next }
          : { notifyOnPending: undefined }),
      },
    });
  };

  const withCurrentNotify = (
    patch: Partial<NotifyOnPendingSettings>,
  ): NotifyOnPendingSettings => ({
    channels:
      notifyOnPending?.channels?.length
        ? notifyOnPending.channels
        : [MessagingChannel.WHATSAPP_OFFICIAL],
    contextTemplate:
      notifyOnPending?.contextTemplate ?? DEFAULT_CONTEXT_TEMPLATE,
    detailsTemplate: notifyOnPending?.detailsTemplate,
    whatsappOfficialRegistryName:
      notifyOnPending?.whatsappOfficialRegistryName ??
      DEFAULT_WHATSAPP_OFFICIAL_REGISTRY_NAME,
    recipients: notifyOnPending?.recipients,
    ...patch,
  });

  const channels = notifyOnPending?.channels ?? [];

  return (
    <StyledSection>
      <StyledHeader>
        <StyledTitle>{t`Notify on pending`}</StyledTitle>
        <StyledHint>
          {t`When this run pauses, send a WhatsApp to the GTM owner with a title, contact details, and a link to fill the form.`}
        </StyledHint>
      </StyledHeader>

      <StyledCheckboxGroup>
        <StyledChannelRow>
          <Checkbox
            checked={enabled}
            disabled={readonly}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              if (!checked) {
                updateNotify(undefined);

                return;
              }

              updateNotify({
                channels: [MessagingChannel.WHATSAPP_OFFICIAL],
                contextTemplate: DEFAULT_CONTEXT_TEMPLATE,
                whatsappOfficialRegistryName:
                  DEFAULT_WHATSAPP_OFFICIAL_REGISTRY_NAME,
              });
            }}
          />
          <span>{t`Enable WhatsApp notification`}</span>
        </StyledChannelRow>

        {enabled &&
          NOTIFY_CHANNEL_OPTIONS.map((option) => (
            <StyledChannelRow key={option.value}>
              <Checkbox
                checked={channels.includes(option.value)}
                disabled={readonly}
                onCheckedChange={(checked) => {
                  const nextChannels = checked
                    ? [...new Set([...channels, option.value])]
                    : channels.filter((channel) => channel !== option.value);

                  updateNotify(
                    withCurrentNotify({
                      channels:
                        nextChannels.length > 0
                          ? nextChannels
                          : [MessagingChannel.WHATSAPP_OFFICIAL],
                    }),
                  );
                }}
              />
              <span>{option.label}</span>
            </StyledChannelRow>
          ))}
      </StyledCheckboxGroup>

      {enabled && (
        <StyledFieldsGroup>
          <FormTextFieldInput
            label={t`WhatsApp title`}
            readonly={readonly}
            defaultValue={
              notifyOnPending?.contextTemplate ?? DEFAULT_CONTEXT_TEMPLATE
            }
            onChange={(value) => {
              updateNotify(withCurrentNotify({ contextTemplate: value }));
            }}
            VariablePicker={WorkflowVariablePicker}
            hint={t`Shown as the first line of the Official WhatsApp template.`}
          />

          <StyledFieldWithHint>
            <FormTextFieldInput
              label={t`WhatsApp details`}
              placeholder={t`Enter your text`}
              multiline
              readonly={readonly}
              defaultValue={notifyOnPending?.detailsTemplate ?? ''}
              onChange={(value) => {
                updateNotify(
                  withCurrentNotify({
                    detailsTemplate: value || undefined,
                  }),
                );
              }}
              VariablePicker={WorkflowVariablePicker}
            />
            <StyledFieldHint>
              {t`Contact and draft context for the approver. Insert variables from earlier steps (name, title, company, draft).`}
            </StyledFieldHint>
          </StyledFieldWithHint>

          {channels.includes(MessagingChannel.WHATSAPP_OFFICIAL) && (
            <FormTextFieldInput
              label={t`Official recipient phone`}
              readonly={readonly}
              defaultValue={
                notifyOnPending?.recipients?.[
                  MessagingChannel.WHATSAPP_OFFICIAL
                ] ?? ''
              }
              onChange={(value) => {
                updateNotify(
                  withCurrentNotify({
                    recipients: {
                      ...notifyOnPending?.recipients,
                      [MessagingChannel.WHATSAPP_OFFICIAL]:
                        value || undefined,
                    },
                  }),
                );
              }}
              VariablePicker={WorkflowVariablePicker}
              hint={t`Who receives the Official WhatsApp ping — the GTM owner's profile phone, not the candidate.`}
            />
          )}

          {channels.includes(MessagingChannel.WHATSAPP_UNIPILE) && (
            <FormTextFieldInput
              label={t`Unipile recipient phone`}
              readonly={readonly}
              defaultValue={
                notifyOnPending?.recipients?.[
                  MessagingChannel.WHATSAPP_UNIPILE
                ] ?? ''
              }
              onChange={(value) => {
                updateNotify(
                  withCurrentNotify({
                    recipients: {
                      ...notifyOnPending?.recipients,
                      [MessagingChannel.WHATSAPP_UNIPILE]:
                        value || undefined,
                    },
                  }),
                );
              }}
              VariablePicker={WorkflowVariablePicker}
              hint={t`Personal Unipile WhatsApp number. Can be the same as Official if both channels use one phone.`}
            />
          )}

          <StyledFieldWithHint>
            <Select
              label={t`Official WhatsApp template`}
              dropdownId="workflow-form-notify-registry"
              disabled={readonly}
              value={
                notifyOnPending?.whatsappOfficialRegistryName ??
                DEFAULT_WHATSAPP_OFFICIAL_REGISTRY_NAME
              }
              options={[
                { label: t`Auto from field types`, value: '' },
                { label: t`Yes / No`, value: 'wf_form_boolean' },
                {
                  label: t`Yes / No + message`,
                  value: 'wf_form_boolean_text',
                },
                { label: t`Message only`, value: 'wf_form_text' },
                { label: t`Number`, value: 'wf_form_number' },
                { label: t`Date`, value: 'wf_form_date' },
                { label: t`Select`, value: 'wf_form_select' },
                {
                  label: t`Multi-select`,
                  value: 'wf_form_multi_select',
                },
                {
                  label: t`Text + number + date`,
                  value: 'wf_form_text_number_date',
                },
                { label: t`Generic form`, value: 'wf_form_generic' },
                { label: t`Hosted fill link`, value: 'wf_form_hosted' },
              ]}
              onChange={(value) => {
                updateNotify(
                  withCurrentNotify({
                    whatsappOfficialRegistryName: value || undefined,
                  }),
                );
              }}
            />
            <StyledFieldHint>
              {t`Yes / No + message matches Approve send + Edited message. Switch only if the Official send must use a different template.`}
            </StyledFieldHint>
          </StyledFieldWithHint>
        </StyledFieldsGroup>
      )}
    </StyledSection>
  );
};
