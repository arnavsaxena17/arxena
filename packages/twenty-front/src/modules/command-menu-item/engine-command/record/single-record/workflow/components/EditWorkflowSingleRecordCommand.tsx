import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { EditOutreachSequencerOptionsModal } from '@/workflow/components/EditOutreachSequencerOptionsModal';
import { EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID } from '@/workflow/constants/EditOutreachSequencerOptionsModalId';
import { useWorkflowWithCurrentVersion } from '@/workflow/hooks/useWorkflowWithCurrentVersion';
import { isDefined } from 'twenty-shared/utils';

export const EditWorkflowSingleRecordCommand = () => {
  const { selectedRecords } = useHeadlessCommandContextApi();
  const { openModal } = useModal();

  const recordId = selectedRecords[0]?.id;
  const workflowWithCurrentVersion = useWorkflowWithCurrentVersion(
    recordId ?? '',
  );

  if (!isDefined(recordId)) {
    throw new Error('Record ID is required to edit workflow');
  }

  const handleExecute = () => {
    if (!isDefined(workflowWithCurrentVersion)) {
      return;
    }

    openModal(EDIT_OUTREACH_SEQUENCER_OPTIONS_MODAL_ID);
  };

  return (
    <>
      <HeadlessEngineCommandWrapperEffect execute={handleExecute} />
      <EditOutreachSequencerOptionsModal
        workflowId={recordId}
        steps={workflowWithCurrentVersion?.currentVersion?.steps}
        trigger={workflowWithCurrentVersion?.currentVersion?.trigger}
      />
    </>
  );
};
