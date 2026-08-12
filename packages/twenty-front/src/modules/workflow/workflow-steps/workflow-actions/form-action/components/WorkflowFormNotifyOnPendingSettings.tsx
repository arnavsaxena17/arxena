import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { Select } from '@/ui/input/components/Select';
import { type WorkflowFormAction } from '@/workflow/types/Workflow';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Checkbox } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const NOTIFY_CHANNEL_OPTIONS = [
  { label: 'WhatsApp Official', value: 'WHATSAPP_OFFICIAL' },
  { label: 'WhatsApp Unipile', value: 'WHATSAPP_UNIPILE' },
] as const;

const DEFAULT_CONTEXT_TEMPLATE =
  'Please complete the pending workflow form.';

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
    WHATSAPP_OFFICIAL?: string;
    WHATSAPP_UNIPILE?: string;
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
        : ['WHATSAPP_OFFICIAL'],
    contextTemplate:
      notifyOnPending?.contextTemplate ?? DEFAULT_CONTEXT_TEMPLATE,
    detailsTemplate: notifyOnPending?.detailsTemplate,
    whatsappOfficialRegistryName:
      notifyOnPending?.whatsappOfficialRegistryName,
    recipients: notifyOnPending?.recipients,
    ...patch,
  });

  const channels = notifyOnPending?.channels ?? [];

  return (
    <StyledSection>
      <StyledHeader>
        <StyledTitle>{t`Notify on pending`}</StyledTitle>
        <StyledHint>
          {t`Send this form to WhatsApp when the run pauses. Backdrop and details support workflow variables and appear in the Official template.`}
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
                channels: ['WHATSAPP_OFFICIAL'],
                contextTemplate: DEFAULT_CONTEXT_TEMPLATE,
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
                          : ['WHATSAPP_OFFICIAL'],
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
            label={t`Backdrop (WhatsApp {{1}})`}
            readonly={readonly}
            defaultValue={
              notifyOnPending?.contextTemplate ?? DEFAULT_CONTEXT_TEMPLATE
            }
            onChange={(value) => {
              updateNotify(withCurrentNotify({ contextTemplate: value }));
            }}
            VariablePicker={WorkflowVariablePicker}
          />

          <StyledFieldWithHint>
            <FormTextFieldInput
              label={t`Details (WhatsApp {{2}})`}
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
              {t`If Details is empty, field labels are used. Insert workflow variables so the approver sees company, contact, etc.`}
            </StyledFieldHint>
          </StyledFieldWithHint>

          <FormTextFieldInput
            label={t`Official recipient phone (optional)`}
            readonly={readonly}
            defaultValue={
              notifyOnPending?.recipients?.WHATSAPP_OFFICIAL ?? ''
            }
            onChange={(value) => {
              updateNotify(
                withCurrentNotify({
                  recipients: {
                    ...notifyOnPending?.recipients,
                    WHATSAPP_OFFICIAL: value || undefined,
                  },
                }),
              );
            }}
          />

          <FormTextFieldInput
            label={t`Unipile recipient phone (optional)`}
            readonly={readonly}
            defaultValue={notifyOnPending?.recipients?.WHATSAPP_UNIPILE ?? ''}
            onChange={(value) => {
              updateNotify(
                withCurrentNotify({
                  recipients: {
                    ...notifyOnPending?.recipients,
                    WHATSAPP_UNIPILE: value || undefined,
                  },
                }),
              );
            }}
          />

          <StyledFieldWithHint>
            <Select
              label={t`Force Official template (optional)`}
              dropdownId="workflow-form-notify-registry"
              disabled={readonly}
              value={notifyOnPending?.whatsappOfficialRegistryName ?? ''}
              options={[
                { label: t`Auto from field types`, value: '' },
                { label: 'wf_form_boolean', value: 'wf_form_boolean' },
                { label: 'wf_form_hosted', value: 'wf_form_hosted' },
                { label: 'wf_form_text', value: 'wf_form_text' },
                { label: 'wf_form_generic', value: 'wf_form_generic' },
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
              {t`Forms with RECORD fields always use the hosted fill link template.`}
            </StyledFieldHint>
          </StyledFieldWithHint>
        </StyledFieldsGroup>
      )}
    </StyledSection>
  );
};
