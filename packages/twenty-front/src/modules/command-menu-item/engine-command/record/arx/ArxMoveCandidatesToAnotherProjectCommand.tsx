import { tokenPairState } from '@/auth/states/tokenPairState';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_MOVE_CANDIDATES_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { useMoveCandidatesToProject } from '@/object-record/hooks/useMoveCandidatesToProject';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

type ProjectListItem = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
  searchName?: string;
};

const StyledProjectPickerWrap = styled.div`
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

const projectLabel = (project: ProjectListItem) =>
  project.searchName?.trim() || project.name?.trim() || project.id;

export const ArxMoveCandidatesToAnotherProjectCommand = () => {
  const { selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext();
  const tokenPair = useAtomStateValue(tokenPairState);
  const dataTableRefreshFunction = useAtomStateValue(
    dataTableRefreshFunctionState,
  );
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_MOVE_CANDIDATES_MODAL_ID);
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();

  const [modalProjects, setModalProjects] = useState<ProjectListItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [pendingCandidateIds, setPendingCandidateIds] = useState<
    string[] | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { moveCandidatesToProject, loading } = useMoveCandidatesToProject({
    onSuccess: async (result) => {
      const failedPart =
        result.failed > 0 ? `, ${result.failed} could not be updated` : '';
      enqueueSuccessSnackBar({
        message: `Moved ${result.updated} candidate(s) to the selected project${failedPart}`,
        options: { duration: 5000 },
      });

      if (dataTableRefreshFunction != null) {
        try {
          await dataTableRefreshFunction();
        } catch {
          enqueueWarningSnackBar({
            message:
              'Candidates were updated but the table could not refresh automatically.',
            options: { duration: 5000 },
          });
        }
      }
    },
    onError: (error) => {
      enqueueErrorSnackBar({
        message: error.message,
        options: { duration: 5000 },
      });
    },
  });

  const fetchProjectsForModal = useCallback(async (): Promise<
    ProjectListItem[]
  > => {
    const response = await axios.post(
      `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-all-projects`,
      {},
      {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
        },
      },
    );
    const raw = (response?.data?.projects ?? response?.data?.jobs) as
      | Array<{ node: ProjectListItem }>
      | undefined;

    if (!raw?.length) {
      return [];
    }

    return raw
      .map((entry) => entry.node)
      .sort((first, second) => {
        if (first?.isActive !== second?.isActive) {
          return second?.isActive ? -1 : 1;
        }

        return (
          new Date(second?.createdAt ?? 0).getTime() -
          new Date(first?.createdAt ?? 0).getTime()
        );
      });
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  useEffect(() => {
    const prepareModal = async () => {
      try {
        setIsProcessing(true);
        const candidateIds = await resolveRecordIds();
        const projects = await fetchProjectsForModal();

        if (projects.length === 0) {
          enqueueWarningSnackBar({
            message: 'No projects are available to move candidates to.',
            options: { duration: 5000 },
          });
          handleCancel();
          return;
        }

        setModalProjects(projects);
        const activeProjects = projects.filter((project) => project.isActive);
        setSelectedProjectId(activeProjects[0]?.id ?? projects[0]?.id ?? '');
        setPendingCandidateIds(candidateIds);
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
  }, [
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
    fetchProjectsForModal,
    handleCancel,
    resolveRecordIds,
  ]);

  const activeProjects = useMemo(
    () => modalProjects.filter((project) => project.isActive),
    [modalProjects],
  );
  const inactiveProjects = useMemo(
    () => modalProjects.filter((project) => !project.isActive),
    [modalProjects],
  );

  const handleExecute = useCallback(async () => {
    if (isProcessing || !pendingCandidateIds?.length || !selectedProjectId) {
      return;
    }

    try {
      setIsProcessing(true);
      await moveCandidatesToProject(pendingCandidateIds, selectedProjectId);
    } finally {
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    moveCandidatesToProject,
    pendingCandidateIds,
    selectedProjectId,
  ]);

  const modalSubtitle = (
    <StyledProjectPickerWrap>
      <span>
        <Trans>
          Choose the project to assign for {selectedRecordCount} selected
          candidate(s). Their project link will be updated to this project.
        </Trans>
      </span>
      <StyledSelect
        value={selectedProjectId}
        onChange={(event) => setSelectedProjectId(event.target.value)}
        aria-label="Target project"
        disabled={modalProjects.length === 0}
      >
        {activeProjects.length > 0 && (
          <optgroup label="Active projects">
            {activeProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {projectLabel(project)}
              </option>
            ))}
          </optgroup>
        )}
        {inactiveProjects.length > 0 && (
          <optgroup label="Inactive projects">
            {inactiveProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {projectLabel(project)}
              </option>
            ))}
          </optgroup>
        )}
      </StyledSelect>
    </StyledProjectPickerWrap>
  );

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_MOVE_CANDIDATES_MODAL_ID}
        title="Move candidates to another project"
        subtitle={modalSubtitle}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Move to project"
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
