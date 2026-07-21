import { Button } from 'twenty-ui';
import { IconPencil, IconPlayerPlay, IconPlayerStop, IconPower, IconSettingsAutomation, IconTrash } from 'twenty-ui/icons';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useActivateWorkflowVersion } from '@/workflow/hooks/useActivateWorkflowVersion';
import { useCreateDraftFromWorkflowVersion } from '@/workflow/hooks/useCreateDraftFromWorkflowVersion';
import { useDeactivateWorkflowVersion } from '@/workflow/hooks/useDeactivateWorkflowVersion';
import { useDeleteOneWorkflowVersion } from '@/workflow/hooks/useDeleteOneWorkflowVersion';
import { useRunWorkflowVersion } from '@/workflow/hooks/useRunWorkflowVersion';
import { useWorkflowVersion } from '@/workflow/hooks/useWorkflowVersion';
import { useWorkflowWithCurrentVersion } from '@/workflow/hooks/useWorkflowWithCurrentVersion';
import { openOverrideWorkflowDraftConfirmationModalState } from '@/workflow/states/openOverrideWorkflowDraftConfirmationModalState';
import { assertWorkflowWithCurrentVersionIsDefined } from '@/workflow/utils/assertWorkflowWithCurrentVersionIsDefined';
import { OverrideWorkflowDraftConfirmationModal } from '@/workflow/components/OverrideWorkflowDraftConfirmationModal';
import { AppPath } from '@/types/AppPath';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useSetRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';

import { useNavigateApp } from '~/hooks/useNavigateApp';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { WorkflowVersion } from '@/workflow/types/Workflow';

const StyledActionButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-wrap: wrap;
`;

type WorkflowBuilderActionButtonsProps = {
  workflowId?: string;
  workflowVersionId?: string;
};

export const WorkflowBuilderActionButtons = ({
  workflowId,
  workflowVersionId,
}: WorkflowBuilderActionButtonsProps) => {
  const { t } = useLingui();
  const theme = useTheme();
  const navigate = useNavigateApp();
  const { enqueueSnackBar } = useSnackBar();

  const workflowWithCurrentVersion = useWorkflowWithCurrentVersion(workflowId);
  const workflowVersion = useWorkflowVersion(workflowVersionId);

  const { activateWorkflowVersion } = useActivateWorkflowVersion();
  const { deactivateWorkflowVersion } = useDeactivateWorkflowVersion();
  const { deleteOneWorkflowVersion } = useDeleteOneWorkflowVersion();
  const { runWorkflowVersion } = useRunWorkflowVersion();
  const { createDraftFromWorkflowVersion } =
    useCreateDraftFromWorkflowVersion();

  const setOpenOverrideWorkflowDraftConfirmationModal = useSetRecoilState(
    openOverrideWorkflowDraftConfirmationModalState,
  );

  const activeVersion = isDefined(workflowVersionId)
    ? workflowVersion
    : workflowWithCurrentVersion?.currentVersion;

  const activeWorkflowId = isDefined(workflowVersionId)
    ? workflowVersion?.workflowId
    : workflowId;

  const { records: draftWorkflowVersions } = useFindManyRecords<WorkflowVersion>(
    {
      objectNameSingular: CoreObjectNameSingular.WorkflowVersion,
      filter: {
        workflowId: {
          eq: activeWorkflowId,
        },
        status: {
          eq: 'DRAFT',
        },
      },
      skip: !isDefined(activeWorkflowId),
      limit: 1,
    },
  );

  const draftWorkflowVersion = draftWorkflowVersions[0];

  const isWaitingForVersion = !isDefined(activeVersion);

  const trigger = activeVersion?.trigger;

  const canWorkflowBeTested =
    trigger?.type === 'MANUAL' && !trigger.settings.objectType;

  const showDiscardDraftButton =
    isDefined(workflowWithCurrentVersion) &&
    !isDefined(workflowVersionId) &&
    workflowWithCurrentVersion.currentVersion?.status === 'DRAFT' &&
    workflowWithCurrentVersion.versions?.length > 1;

  const showUseAsDraftButton =
    isDefined(workflowVersion) &&
    isDefined(workflowVersionId) &&
    workflowVersion.status !== 'DRAFT';

  const hasAlreadyDraftVersion = isDefined(draftWorkflowVersion);

  const handleTest = async () => {
    if (!isDefined(activeVersion)) {
      return;
    }

    if (!canWorkflowBeTested) {
      enqueueSnackBar(t`Workflow cannot be tested`, {
        variant: SnackBarVariant.Error,
        detailedMessage: t`Trigger type should be Manual - when no record(s) are selected`,
        icon: (
          <IconSettingsAutomation
            size={16}
            color={theme.snackBar.error.color}
          />
        ),
      });
      return;
    }

    await runWorkflowVersion({
      workflowVersionId: activeVersion.id,
    });
  };

  const handleActivate = () => {
    if (!isDefined(activeVersion) || !isDefined(activeWorkflowId)) {
      return;
    }

    return activateWorkflowVersion({
      workflowVersionId: activeVersion.id,
      workflowId: activeWorkflowId,
    });
  };

  const handleDeactivate = () => {
    if (!isDefined(activeVersion)) {
      return;
    }

    return deactivateWorkflowVersion({
      workflowVersionId: activeVersion.id,
    });
  };

  const handleDiscardDraft = () => {
    if (!isDefined(workflowWithCurrentVersion)) {
      return;
    }

    assertWorkflowWithCurrentVersionIsDefined(workflowWithCurrentVersion);

    return deleteOneWorkflowVersion({
      workflowVersionId: workflowWithCurrentVersion.currentVersion.id,
    });
  };

  const handleUseAsDraft = async () => {
    if (!isDefined(workflowVersion) || !isDefined(activeWorkflowId)) {
      return;
    }

    if (hasAlreadyDraftVersion) {
      setOpenOverrideWorkflowDraftConfirmationModal(true);
      return;
    }

    await createDraftFromWorkflowVersion({
      workflowId: activeWorkflowId,
      workflowVersionIdToCopy: workflowVersion.id,
    });

    navigate(AppPath.RecordShowPage, {
      objectNameSingular: CoreObjectNameSingular.Workflow,
      objectRecordId: activeWorkflowId,
    });
  };

  return (
    <>
      <StyledActionButtonsContainer>
        <Button
          title={t`Test`}
          variant="secondary"
          size="small"
          Icon={IconPlayerPlay}
          disabled={isWaitingForVersion}
          onClick={handleTest}
        />

        {showDiscardDraftButton ? (
          <Button
            title={t`Discard Draft`}
            variant="secondary"
            size="small"
            Icon={IconTrash}
            disabled={isWaitingForVersion}
            onClick={handleDiscardDraft}
          />
        ) : null}

        {showUseAsDraftButton ? (
          <Button
            title={t`Use as Draft`}
            variant="secondary"
            size="small"
            Icon={IconPencil}
            disabled={isWaitingForVersion}
            onClick={handleUseAsDraft}
          />
        ) : null}

        {activeVersion?.status === 'DRAFT' ||
        activeVersion?.status === 'DEACTIVATED' ? (
          <Button
            title={t`Activate`}
            variant="secondary"
            size="small"
            Icon={IconPower}
            disabled={isWaitingForVersion}
            onClick={handleActivate}
          />
        ) : activeVersion?.status === 'ACTIVE' ? (
          <Button
            title={t`Deactivate`}
            variant="secondary"
            size="small"
            Icon={IconPlayerStop}
            disabled={isWaitingForVersion}
            onClick={handleDeactivate}
          />
        ) : null}
      </StyledActionButtonsContainer>

      {isDefined(workflowVersion) &&
      isDefined(workflowVersionId) &&
      isDefined(draftWorkflowVersion) ? (
        <OverrideWorkflowDraftConfirmationModal
          workflowId={workflowVersion.workflowId}
          workflowVersionIdToCopy={workflowVersionId}
        />
      ) : null}
    </>
  );
};
