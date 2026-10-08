import { SettingsOptionCardContentCounter } from '@/settings/components/SettingsOptions/SettingsOptionCardContentCounter';
import { SettingsOptionCardContentToggle } from '@/settings/components/SettingsOptions/SettingsOptionCardContentToggle';
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
import {
  IconBrandWhatsapp,
  IconBuildingSkyscraper,
  IconCalendarEvent,
  IconClock,
  IconFilter,
  IconMail,
  IconMessageCircle,
  IconRepeat,
  IconSparkles,
  IconTestPipe,
  IconUser,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Card } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H1Title, H1TitleFontColor, H2Title } from 'twenty-ui/typography';

type EditOutreachSequencerOptionsModalProps = {
  workflowId: string;
  steps:
    | Array<{
        id?: string;
        settings?: {
          input?: {
            duration?: {
              days?: number;
              hours?: number;
              minutes?: number;
              seconds?: number;
            };
          };
        };
      }>
    | null
    | undefined;
  trigger?: { type?: string } | null;
  onDismiss?: () => void;
};

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-height: calc(90dvh - ${themeCssVariables.spacing[12]});
  min-height: 0;
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledCallout = styled.p`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin: 0;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledScrollArea = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[5]};
  min-height: 0;
  overflow-y: auto;
  padding-right: ${themeCssVariables.spacing[1]};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledNestedOptions = styled.div`
  border-left: 2px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-left: ${themeCssVariables.spacing[2]};
  padding-left: ${themeCssVariables.spacing[3]};
`;

const StyledFooter = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[4]};
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
      size="large"
      padding="medium"
      isClosable
      onClose={handleClose}
      renderInDocumentBody
      autoHeight
    >
      <StyledRoot>
        <StyledHeader>
          <H1Title
            title={t`Edit Workflow`}
            fontColor={H1TitleFontColor.Primary}
          />
          <StyledCallout>
            {t`Apply rebuilds the Candidate Sequencer draft from the outreach template and discards hand-edits. Activate when ready. Start Outreach to ignite; replies continue until Stop Outreach.`}
          </StyledCallout>
        </StyledHeader>

        <StyledScrollArea>
          <StyledSection>
            <H2Title title={t`Messaging & review`} />
            <Card
              rounded
              backgroundColor={themeCssVariables.background.secondary}
            >
              <SettingsOptionCardContentToggle
                Icon={IconSparkles}
                title={t`LLM-generated connection note`}
                description={t`Off: blank connection request with no draft/approve nodes.`}
                checked={options.useLlmConnectionNote}
                onChange={(value) => setOption('useLlmConnectionNote', value)}
                toggleCentered={false}
                divider
                disabled={isSubmitting}
              />
              <SettingsOptionCardContentToggle
                Icon={IconUser}
                title={t`Human in the loop`}
                description={t`Off: remove approve steps and send drafted messages directly.`}
                checked={options.humanInTheLoop}
                onChange={(value) => setOption('humanInTheLoop', value)}
                toggleCentered={false}
                divider
                disabled={isSubmitting}
              />
              <SettingsOptionCardContentToggle
                Icon={IconBrandWhatsapp}
                title={t`WhatsApp messaging`}
                description={t`Off: replies and follow-ups only use email and LinkedIn.`}
                checked={options.whatsappEnabled}
                onChange={(value) => setOption('whatsappEnabled', value)}
                toggleCentered={false}
                divider
                disabled={isSubmitting}
              />
              <SettingsOptionCardContentToggle
                Icon={IconMail}
                title={t`Email account connected`}
                description={t`Off: wherever an email would be sent, a system email asks the workspace member to send it instead.`}
                checked={options.emailConnected}
                onChange={(value) => setOption('emailConnected', value)}
                toggleCentered={false}
                divider
                disabled={isSubmitting}
              />
              <SettingsOptionCardContentToggle
                Icon={IconMail}
                title={t`Sales Navigator InMail before email`}
                description={t`On: after the connection wait, draft and send InMail before enriching email.`}
                checked={options.inmailEnabled}
                onChange={(value) => setOption('inmailEnabled', value)}
                toggleCentered={false}
                divider
                disabled={isSubmitting}
              />
              <SettingsOptionCardContentToggle
                Icon={IconCalendarEvent}
                title={t`Meeting-booked follow-up cadence`}
                description={t`Off: skip the meeting reminder / no-show / reschedule tree.`}
                checked={options.meetingFollowUpEnabled}
                onChange={(value) => setOption('meetingFollowUpEnabled', value)}
                toggleCentered={false}
                disabled={isSubmitting}
              />
            </Card>
          </StyledSection>

          <StyledSection>
            <H2Title title={t`Prospect filters`} />
            <Card
              rounded
              backgroundColor={themeCssVariables.background.secondary}
            >
              <SettingsOptionCardContentToggle
                Icon={IconBuildingSkyscraper}
                title={t`Check deduplication per company`}
                description={t`On: defer prospects whose company already has someone contacted or an earlier QUEUED sibling.`}
                checked={options.checkDeduplicationPerCompany}
                onChange={(value) =>
                  setOption('checkDeduplicationPerCompany', value)
                }
                toggleCentered={false}
                divider
                disabled={isSubmitting}
              />
              <SettingsOptionCardContentToggle
                Icon={IconFilter}
                title={t`Qualify prospect`}
                description={t`Off: skip qualify, enrichment stamp, and go/no-go — profile fetch goes straight to connect.`}
                checked={options.qualifyProspectEnabled}
                onChange={(value) => setOption('qualifyProspectEnabled', value)}
                toggleCentered={false}
                disabled={isSubmitting}
              />
            </Card>
          </StyledSection>

          <StyledSection>
            <H2Title title={t`Pre-connect engagement`} />
            <Card
              rounded
              backgroundColor={themeCssVariables.background.secondary}
            >
              <SettingsOptionCardContentToggle
                Icon={IconMessageCircle}
                title={t`Comment before connect`}
                description={t`View profile, wait, comment on posts, wait for inbound invite, then connect if none arrives.`}
                checked={options.commentBeforeConnect}
                onChange={(value) => setOption('commentBeforeConnect', value)}
                toggleCentered={false}
                disabled={isSubmitting}
              />
            </Card>
            {options.commentBeforeConnect && (
              <StyledNestedOptions>
                <Card
                  rounded
                  backgroundColor={themeCssVariables.background.secondary}
                >
                  <SettingsOptionCardContentToggle
                    Icon={IconRepeat}
                    title={t`Two comment rounds`}
                    description={t`On: comment on a second distinct post after a 1-day wait.`}
                    checked={options.commentRounds === 2}
                    onChange={(value) =>
                      setOptions((previousOptions) => ({
                        ...previousOptions,
                        commentRounds: value ? 2 : 1,
                      }))
                    }
                    toggleCentered={false}
                    divider
                    disabled={isSubmitting}
                  />
                  <SettingsOptionCardContentCounter
                    Icon={IconClock}
                    title={t`Inbound invite wait (days)`}
                    description={t`Days to wait for an inbound invite before sending outbound connect.`}
                    value={options.inboundInviteWaitDays}
                    onChange={(nextValue) =>
                      setOptions((previousOptions) => ({
                        ...previousOptions,
                        inboundInviteWaitDays: nextValue,
                      }))
                    }
                    minValue={1}
                    maxValue={30}
                    disabled={isSubmitting}
                  />
                </Card>
              </StyledNestedOptions>
            )}
          </StyledSection>

          <StyledSection>
            <H2Title title={t`Testing`} />
            <Card
              rounded
              backgroundColor={themeCssVariables.background.secondary}
            >
              <SettingsOptionCardContentToggle
                Icon={IconTestPipe}
                title={t`Test mode`}
                description={t`On: every wait (3–7 days) becomes 1 minute for rapid branch testing.`}
                checked={options.testMode}
                onChange={(value) => setOption('testMode', value)}
                toggleCentered={false}
                disabled={isSubmitting}
              />
            </Card>
          </StyledSection>
        </StyledScrollArea>

        <StyledFooter>
          <Button
            title={t`Cancel`}
            variant="secondary"
            fullWidth
            justify="center"
            onClick={handleClose}
            disabled={isSubmitting}
          />
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
        </StyledFooter>
      </StyledRoot>
    </ModalStatefulWrapper>
  );
};
