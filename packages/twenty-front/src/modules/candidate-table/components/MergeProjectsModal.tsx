import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useCallback, useState } from 'react';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import { projectsState } from '@/candidate-table/states/states';
import {
    candidateToLinkedInPremiumFormat,
    deduplicateCandidatesByPeopleId,
    type CandidateNodeFromApi,
} from '@/candidate-table/utils/mergeCandidatesUtils';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';
import { graphqlToAddNewProject } from 'twenty-shared/graphql';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const StyledModal = styled.div`
  width: 560px;
  max-width: 100%;
  max-height: 80vh;
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.border.radius.xl};
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledHeader = styled.div`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTitle = styled.h3`
  margin: 0;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: 600;
  color: ${themeCssVariables.font.color.primary};
`;

const StyledBody = styled.div`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledSectionLabel = styled.label`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 500;
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledSelect = styled.select`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 36px;
`;

const StyledInput = styled.input`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 36px;
`;

const StyledSourceJobList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledFooter = styled.div`
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  justify-content: flex-end;
  gap: ${themeCssVariables.spacing[1.5]};
`;

const StyledPrimaryButton = styled.button`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: none;
  background: ${themeCssVariables.color.blue};
  color: ${themeCssVariables.font.color.inverted};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;

  &:hover:enabled {
    background: ${themeCssVariables.color.blue8};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledSecondaryButton = styled.button`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: transparent;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledCloseButton = styled.button`
  padding: ${themeCssVariables.spacing[0.5]};
  border: none;
  background: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.lg};
  line-height: 1;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

export type MergeProjectsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sourceProjectIds: string[];
  sourceJobs: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
};

const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';

export const MergeProjectsModal = ({
  isOpen,
  onClose,
  sourceProjectIds,
  sourceJobs,
  onSuccess,
}: MergeProjectsModalProps) => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const tokenPair = useAtomStateValue(tokenPairState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const projects = useAtomStateValue(projectsState);
  const { refetchJobs } = useProjectRefetch();
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();

  const apolloCoreClient = useApolloCoreClient();
  const [createProject] = useMutation(gql(graphqlToAddNewProject), {
    client: apolloCoreClient,
  });

  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [newJobName, setNewJobName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetJobOptions = projects.filter(
    (projectItem) => !sourceProjectIds.includes(projectItem.id),
  );

  const selectedTargetJob = targetJobOptions.find(
    (projectItem) => projectItem.id === selectedProjectId,
  );

  const fetchCandidatesByProjectId = useCallback(
    async (projectId: string): Promise<CandidateNodeFromApi[]> => {
      const response = await fetch(
        `${baseUrl}/candidate-sourcing/get-candidates-by-project-id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
          body: JSON.stringify({ projectId }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch candidates for job ${projectId}`);
      }
      return response.json();
    },
    [tokenPair?.accessOrWorkspaceAgnosticToken?.token],
  );

  const handleSubmit = useCallback(async () => {
    let projectId: string;
    let jobName: string;

    if (targetMode === 'new') {
      const trimmedName = newJobName.trim();
      if (!trimmedName) {
        enqueueErrorSnackBar({ message: 'Enter a job name', options: { duration: 3000, } });
        return;
      }
      try {
        const res = await createProject({
          variables: {
            input: { name: trimmedName, isActive: true },
          },
        });
        const createdId = res.data?.createProject?.id;
        if (!createdId) {
          throw new Error('Failed to create job');
        }
        projectId = createdId;
        jobName = trimmedName;
      } catch (err) {
        enqueueErrorSnackBar({
          message: err instanceof Error ? err.message : 'Failed to create job',
          options: { duration: 5000 },
        });
        return;
      }
    } else {
      if (!selectedTargetJob) {
        enqueueErrorSnackBar({ message: 'Select a target job', options: { duration: 3000, } });
        return;
      }
      projectId = selectedTargetJob.id;
      jobName = selectedTargetJob.name;
    }

    setIsSubmitting(true);
    try {
      const allCandidates: CandidateNodeFromApi[] = [];
      for (const jid of sourceProjectIds) {
        const candidates = await fetchCandidatesByProjectId(jid);
        allCandidates.push(...candidates);
      }

      const deduped = deduplicateCandidatesByPeopleId(allCandidates);

      if (deduped.length === 0) {
        enqueueErrorSnackBar({ message: 'No candidates to merge', options: { duration: 3000, } });
        setIsSubmitting(false);
        return;
      }

      const candidatesPayload = deduped.map(candidateToLinkedInPremiumFormat);

      const body = {
        candidates: candidatesPayload,
        data_source: 'linkedin_premium',
        job_id: projectId,
        job_name: jobName,
        recruiterId: currentWorkspaceMember?.id,
        job: {
          id: projectId,
          name: jobName,
          recruiterId: currentWorkspaceMember?.id,
        },
        queue_start_chat_after: false,
      };

      beginUploadProgressSseSession();
      try {
        const response = await fetch(
          `${baseUrl}/candidate-sourcing/upload-profiles`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
            },
            body: JSON.stringify(body),
          },
        );

        const result = await response.json();
        if (result.status === 'ok' || result.status === 'success') {
          enqueueSuccessSnackBar({
            message: `Adding ${deduped.length} candidate(s) to ${jobName}. You will see progress in the notification.`,
            options: { duration: 4000 },
          });
          refetchJobs();
          onSuccess?.();
          onClose();
        } else {
          throw new Error(result.message || result.error || 'Merge failed');
        }
      } finally {
        endUploadProgressSseSessionAfterDelay();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to merge candidates';
      enqueueErrorSnackBar({ message: message, options: { duration: 5000, } });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    targetMode,
    newJobName,
    selectedTargetJob,
    sourceProjectIds,
    createProject,
    fetchCandidatesByProjectId,
    currentWorkspaceMember?.id,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    enqueueSuccessSnackBar, enqueueErrorSnackBar,
    refetchJobs,
    onSuccess,
    onClose,
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  ]);

  if (!isOpen) return null;

  const canSubmit =
    !isSubmitting &&
    (targetMode === 'existing' ? !!selectedProjectId : !!newJobName.trim());

  return (
    <StyledBackdrop onClick={onClose}>
      <StyledModal onClick={(e) => e.stopPropagation()}>
        <StyledHeader>
          <StyledTitle>Merge candidates into job</StyledTitle>
          <StyledCloseButton type="button" onClick={onClose} aria-label="Close">
            ×
          </StyledCloseButton>
        </StyledHeader>
        <StyledBody>
          <StyledSection>
            <StyledSectionLabel>Source jobs</StyledSectionLabel>
            <StyledSourceJobList>
              {sourceJobs.map((j) => (
                <li key={j.id}>{j.name}</li>
              ))}
            </StyledSourceJobList>
          </StyledSection>

          <StyledSection>
            <StyledSectionLabel>Target job</StyledSectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="targetMode"
                  checked={targetMode === 'new'}
                  onChange={() => setTargetMode('new')}
                />
                Create new job
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="targetMode"
                  checked={targetMode === 'existing'}
                  onChange={() => setTargetMode('existing')}
                />
                Add to existing job
              </label>
            </div>
          </StyledSection>

          {targetMode === 'new' ? (
            <StyledSection>
              <StyledSectionLabel>New job name</StyledSectionLabel>
              <StyledInput
                type="text"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                placeholder="e.g. Merged pipeline"
              />
            </StyledSection>
          ) : (
            <StyledSection>
              <StyledSectionLabel>Select target job</StyledSectionLabel>
              <StyledSelect
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">Select a job</option>
                {targetJobOptions.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}
                  </option>
                ))}
              </StyledSelect>
            </StyledSection>
          )}
        </StyledBody>
        <StyledFooter>
          <StyledSecondaryButton type="button" onClick={onClose}>
            Cancel
          </StyledSecondaryButton>
          <StyledPrimaryButton
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Adding…' : 'Merge'}
          </StyledPrimaryButton>
        </StyledFooter>
      </StyledModal>
    </StyledBackdrop>
  );
};
