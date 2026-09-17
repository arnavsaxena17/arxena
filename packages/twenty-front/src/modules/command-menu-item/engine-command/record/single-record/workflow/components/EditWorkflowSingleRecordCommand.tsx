import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useUnmountCommand } from '@/command-menu-item/engine-command/hooks/useUnmountEngineCommand';
import { CommandComponentInstanceContext } from '@/command-menu-item/engine-command/states/contexts/CommandComponentInstanceContext';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { EditOutreachSequencerOptionsModal } from '@/workflow/components/EditOutreachSequencerOptionsModal';
import { EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID } from '@/workflow/constants/EditOutreachSequencerOptionsModalId';
import { useWorkflowWithCurrentVersion } from '@/workflow/hooks/useWorkflowWithCurrentVersion';
import { useEffect } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const EditWorkflowSingleRecordCommand = () => {
  const { selectedRecords } = useHeadlessCommandContextApi();
  const { openModal } = useModal();
  const unmountCommand = useUnmountCommand();
  const commandMenuItemId = useAvailableComponentInstanceIdOrThrow(
    CommandComponentInstanceContext,
  );

  const recordId = selectedRecords[0]?.id;
  const workflowWithCurrentVersion = useWorkflowWithCurrentVersion(
    recordId ?? '',
  );

  if (!isDefined(recordId)) {
    throw new Error('Record ID is required to edit workflow');
  }

  // Keep this command mounted while the modal is open — HeadlessEngineCommandWrapperEffect
  // would unmount immediately and tear the modal down.
  useEffect(() => {
    if (!isDefined(workflowWithCurrentVersion)) {
      return;
    }

    openModal(EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID);
  }, [openModal, workflowWithCurrentVersion]);

  const handleDismiss = () => {
    unmountCommand(commandMenuItemId);
  };

  return (
    <EditOutreachSequencerOptionsModal
      workflowId={recordId}
      steps={workflowWithCurrentVersion?.currentVersion?.steps}
      trigger={workflowWithCurrentVersion?.currentVersion?.trigger}
      onDismiss={handleDismiss}
    />
  );
};
