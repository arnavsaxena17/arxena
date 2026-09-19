import { ModalStatefulWrapper } from '@/ui/layout/modal/components/ModalStatefulWrapper';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { isModalOpenedComponentState } from '@/ui/layout/modal/states/isModalOpenedComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID } from '@/workflow/constants/EditOutreachSequencerOptionsModalId';
import { useApplyOutreachSequencerGraphOptions } from '@/workflow/hooks/useApplyOutreachSequencerGraphOptions';
import {
  inferOutreachSequencerGraphOptionsFromSteps,
  type OutreachSequencerGraphOptions,
} from '@/workflow/utils/inferOutreachSequencerGraphOptionsFromSteps';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Button, Checkbox } from 'twenty-ui/input';
import { Section, SectionAlignment, SectionFontColor } from 'twenty-ui/layout';
import { H1Title, H1TitleFontColor } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type EditOutreachSequencerOptionsModalProps = {
  workflowId: string;
  steps: Array<{ id?: string }> | null | undefined;
  trigger?: { type?: string } | null;
  onDismiss?: () => void;
};

const StyledCenteredTitle = styled.div`
  text-align: center;
`;

const StyledSectionContainer = styled.div`
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

const StyledOptionRow = styled.label`
  align-items: flex-start;
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledOptionText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledOptionLabel = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledOptionHelp = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledButtonRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

export const EditOutreachSequencerOptionsModal = ({
  workflowId,
  steps,
  trigger,
  onDismiss,
}: EditOutreachSequencerOptionsModalProps) => {
  const { t } = useLingui();
  const { closeModal } = useModal();
  const { applyOutreachSequencerGraphOptions } =
    useApplyOutreachSequencerGraphOptions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isModalOpened = useAtomComponentStateValue(
    isModalOpenedComponentState,
    EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID,
  );
  const [options, setOptions] = useState<OutreachSequencerGraphOptions>(() =>
    inferOutreachSequencerGraphOptionsFromSteps(steps, trigger),
  );
  const [optionsSyncedForOpen, setOptionsSyncedForOpen] = useState(false);

  if (isModalOpened && !optionsSyncedForOpen) {
    setOptions(inferOutreachSequencerGraphOptionsFromSteps(steps, trigger));
    setOptionsSyncedForOpen(true);
  }

  if (!isModalOpened && optionsSyncedForOpen) {
    setOptionsSyncedForOpen(false);
  }

  const handleClose = () => {
    closeModal(EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID);
    onDismiss?.();
  };

  const handleApply = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await applyOutreachSequencerGraphOptions({
        workflowId,
        ...options,
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const setOption = (
    key: keyof OutreachSequencerGraphOptions,
    value: boolean,
  ) => {
    setOptions((previousOptions) => ({
      ...previousOptions,
      [key]: value,
    }));
  };

  if (!isDefined(workflowId)) {
    return null;
  }

  return (
    <ModalStatefulWrapper
      modalInstanceId={EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID}
      size="medium"
      padding="medium"
      isClosable
      onClose={handleClose}
      renderInDocumentBody
    >
      <StyledCenteredTitle>
        <H1Title
          title={t`Edit Workflow`}
          fontColor={H1TitleFontColor.Primary}
        />
      </StyledCenteredTitle>
      <StyledSectionContainer>
        <Section
          alignment={SectionAlignment.Left}
          fontColor={SectionFontColor.Secondary}
        >
          {t`Applying rebuilds the Candidate Sequencer draft from the outreach template and discards hand-edits on the draft. Activate when ready. Start Outreach on candidates or people to ignite; replies continue automatically until Stop Outreach.`}
        </Section>
      </StyledSectionContainer>
      <StyledOptionRow>
        <Checkbox
          checked={options.useLlmConnectionNote}
          onCheckedChange={(value) => setOption('useLlmConnectionNote', value)}
        />
        <StyledOptionText>
          <StyledOptionLabel>
            {t`LLM-generated connection note`}
          </StyledOptionLabel>
          <StyledOptionHelp>
            {t`When off, send a blank connection request with no draft/approve nodes.`}
          </StyledOptionHelp>
        </StyledOptionText>
      </StyledOptionRow>
      <StyledOptionRow>
        <Checkbox
          checked={options.humanInTheLoop}
          onCheckedChange={(value) => setOption('humanInTheLoop', value)}
        />
        <StyledOptionText>
          <StyledOptionLabel>{t`Human in the loop`}</StyledOptionLabel>
          <StyledOptionHelp>
            {t`When off (automated), remove approve steps and send drafted messages directly.`}
          </StyledOptionHelp>
        </StyledOptionText>
      </StyledOptionRow>
      <StyledOptionRow>
        <Checkbox
          checked={options.whatsappEnabled}
          onCheckedChange={(value) => setOption('whatsappEnabled', value)}
        />
        <StyledOptionText>
          <StyledOptionLabel>{t`WhatsApp messaging`}</StyledOptionLabel>
          <StyledOptionHelp>
            {t`When off, replies and follow-ups only use email and LinkedIn.`}
          </StyledOptionHelp>
        </StyledOptionText>
      </StyledOptionRow>
      <StyledOptionRow>
        <Checkbox
          checked={options.meetingFollowUpEnabled}
          onCheckedChange={(value) =>
            setOption('meetingFollowUpEnabled', value)
          }
        />
        <StyledOptionText>
          <StyledOptionLabel>
            {t`Meeting-booked follow-up cadence`}
          </StyledOptionLabel>
          <StyledOptionHelp>
            {t`When off, skip the meeting reminder / no-show / reschedule tree.`}
          </StyledOptionHelp>
        </StyledOptionText>
      </StyledOptionRow>
      <StyledOptionRow>
        <Checkbox
          checked={options.checkDeduplicationPerCompany}
          onCheckedChange={(value) =>
            setOption('checkDeduplicationPerCompany', value)
          }
        />
        <StyledOptionText>
          <StyledOptionLabel>
            {t`Check deduplication per company`}
          </StyledOptionLabel>
          <StyledOptionHelp>
            {t`When on, defer prospects whose company already has someone contacted or an earlier QUEUED sibling. Off by default — qualify goes straight to the connection note.`}
          </StyledOptionHelp>
        </StyledOptionText>
      </StyledOptionRow>
      <StyledButtonRow>
        <Button
          title={t`Apply`}
          variant="primary"
          accent="blue"
          fullWidth
          justify="center"
          onClick={handleApply}
          disabled={isSubmitting}
          isLoading={isSubmitting}
        />
        <Button
          title={t`Cancel`}
          variant="secondary"
          fullWidth
          justify="center"
          onClick={handleClose}
          disabled={isSubmitting}
        />
      </StyledButtonRow>
    </ModalStatefulWrapper>
  );
};
