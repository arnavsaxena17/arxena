import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import {
  type RecordId,
  type Variable,
} from '@/object-record/record-field/ui/form-types/types/RecordPickerValue';
import { WorkflowSendActionExecutionResult } from '@/workflow/workflow-steps/workflow-actions/send-action-test/components/WorkflowSendActionExecutionResult';
import { type WorkflowSendActionTestChannel } from '@/workflow/workflow-steps/workflow-actions/send-action-test/types/WorkflowSendActionTestChannel';
import { type WorkflowSendActionTestData } from '@/workflow/workflow-steps/workflow-actions/send-action-test/types/WorkflowSendActionTestData';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isValidUuid } from 'twenty-shared/utils';
import { Callout } from 'twenty-ui/feedback';
import { IconAlertTriangle } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type WorkflowSendActionTestTabProps = {
  channel: WorkflowSendActionTestChannel;
  candidateId: string | undefined;
  body: string;
  subject?: string;
  readonly: boolean;
  isTesting: boolean;
  sendActionTestData: WorkflowSendActionTestData;
  onCandidateChange: (candidateId: string | undefined) => void;
  onBodyChange: (body: string) => void;
  onSubjectChange?: (subject: string) => void;
};

const StyledTestTabContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  height: 100%;
  min-height: 400px;
`;

export const WorkflowSendActionTestTab = ({
  channel,
  candidateId,
  body,
  subject,
  readonly,
  isTesting,
  sendActionTestData,
  onCandidateChange,
  onBodyChange,
  onSubjectChange,
}: WorkflowSendActionTestTabProps) => {
  const { t } = useLingui();

  const handleCandidateChange = (value: RecordId | Variable | null) => {
    if (isNonEmptyString(value) && isValidUuid(value)) {
      onCandidateChange(value);

      return;
    }

    onCandidateChange(undefined);
  };

  const warningTitle =
    channel === 'EMAIL'
      ? t`Sends a real email`
      : channel === 'WHATSAPP'
        ? t`Sends a real WhatsApp message`
        : t`Sends a real LinkedIn message`;

  return (
    <StyledTestTabContent>
      <Callout
        variant={'warning'}
        Icon={IconAlertTriangle}
        title={warningTitle}
        description={t`Pick a candidate to resolve recipient fields from FIND nodes. Enter the body (and subject for email) here — FORM/AI chips are not hydrated in Test.`}
      />
      <FormSingleRecordPicker
        label={t`Candidate`}
        defaultValue={candidateId}
        onChange={handleCandidateChange}
        objectNameSingulars={['candidate']}
        disabled={readonly}
      />
      {channel === 'EMAIL' && isDefined(onSubjectChange) && (
        <FormTextFieldInput
          label={t`Subject`}
          placeholder={t`Email subject to send`}
          readonly={readonly}
          defaultValue={subject ?? ''}
          onChange={onSubjectChange}
        />
      )}
      <FormTextFieldInput
        label={t`Body`}
        placeholder={t`Message body to send`}
        multiline
        readonly={readonly}
        defaultValue={body}
        onChange={onBodyChange}
      />
      <WorkflowSendActionExecutionResult
        sendActionTestData={sendActionTestData}
        isTesting={isTesting}
      />
    </StyledTestTabContent>
  );
};
