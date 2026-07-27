import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_UPDATE_MESSAGING_CHANNEL_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE } from '@/candidate-table/constants/messagingChannelValues';
import { useUpdateCandidateMessagingChannels } from '@/object-record/hooks/useUpdateCandidateMessagingChannels';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const defaultChannel = MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE[0];

const StyledChannelPickerWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  width: 100%;
  text-align: left;
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[2]};
  width: 100%;
`;

export const ArxUpdateMessagingChannelForCandidatesCommand = () => {
  const { selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext();
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_UPDATE_MESSAGING_CHANNEL_MODAL_ID);
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();

  const [selectedMessagingChannel, setSelectedMessagingChannel] =
    useState<string>(defaultChannel);
  const [pendingCandidateIds, setPendingCandidateIds] = useState<
    string[] | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { updateMessagingChannels, loading } =
    useUpdateCandidateMessagingChannels({
      onSuccess: (result) => {
        const failedPart =
          result.failed > 0 ? `, ${result.failed} could not be updated` : '';
        enqueueSuccessSnackBar({
          message: `Updated messaging channel for ${result.updated} candidate(s)${failedPart}`,
          options: { duration: 5000 },
        });
      },
      onError: (error) => {
        enqueueErrorSnackBar({
          message: error.message,
          options: { duration: 5000 },
        });
      },
    });

  useEffect(() => {
    const prepareModal = async () => {
      try {
        setIsProcessing(true);
        const candidateIds = await resolveRecordIds();
        setPendingCandidateIds(candidateIds);
        setSelectedMessagingChannel(defaultChannel);
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Error validating candidates',
          options: { duration: 5000 },
        });
        handleCancel();
      } finally {
        setIsProcessing(false);
      }
    };

    prepareModal();
  }, [enqueueErrorSnackBar, handleCancel, resolveRecordIds]);

  const handleExecute = useCallback(async () => {
    if (isProcessing || !pendingCandidateIds?.length) {
      return;
    }

    try {
      setIsProcessing(true);
      await updateMessagingChannels(
        pendingCandidateIds,
        selectedMessagingChannel,
      );
    } catch {
      enqueueWarningSnackBar({
        message: 'Failed to update messaging channels',
        options: { duration: 5000 },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    enqueueWarningSnackBar,
    isProcessing,
    pendingCandidateIds,
    selectedMessagingChannel,
    updateMessagingChannels,
  ]);

  const modalSubtitle = (
    <StyledChannelPickerWrap>
      <span>
        <Trans>
          Choose the messaging channel to set for {selectedRecordCount} selected
          candidate(s).
        </Trans>
      </span>
      <StyledSelect
        value={selectedMessagingChannel}
        onChange={(event) => setSelectedMessagingChannel(event.target.value)}
        aria-label="Messaging channel"
      >
        {MESSAGING_CHANNEL_VALUES_FOR_BULK_UPDATE.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </StyledSelect>
    </StyledChannelPickerWrap>
  );

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_UPDATE_MESSAGING_CHANNEL_MODAL_ID}
        title="Update messaging channel"
        subtitle={modalSubtitle}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Update channel"
        confirmButtonAccent="blue"
        loading={isProcessing || loading}
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
