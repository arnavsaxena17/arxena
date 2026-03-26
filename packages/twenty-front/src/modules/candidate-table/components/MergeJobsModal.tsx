import { gql, useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { jobsState } from '@/candidate-table/states/states';
import {
    candidateToLinkedInPremiumFormat,
    deduplicateCandidatesByPeopleId,
    type CandidateNodeFromApi,
} from '@/candidate-table/utils/mergeCandidatesUtils';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';
import { graphqlToAddNewJob } from 'twenty-shared';

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
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledHeader = styled.div`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledBody = styled.div`
  padding: ${({ theme }) => theme.spacing(2.5)} ${({ theme }) => theme.spacing(3)};
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledSectionLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 500;
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-height: 36px;
`;

const StyledInput = styled.input`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-height: 36px;
`;

const StyledSourceJobList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledFooter = styled.div`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledPrimaryButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover:enabled {
    background: ${({ theme }) => theme.color.blue80};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledSecondaryButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: transparent;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledCloseButton = styled.button`
  padding: ${({ theme }) => theme.spacing(0.5)};
  border: none;
  background: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.lg};
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

export type MergeJobsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sourceJobIds: string[];
  sourceJobs: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
};

const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

export const MergeJobsModal = ({
  isOpen,
  onClose,
  sourceJobIds,
  sourceJobs,
  onSuccess,
}: MergeJobsModalProps) => {
  const { enqueueSnackBar } = useSnackBar();
  const tokenPair = useRecoilValue(tokenPairState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const jobs = useRecoilValue(jobsState);
  const { refetchJobs } = useJobRefetch();
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();

  const [createJob] = useMutation(gql(graphqlToAddNewJob));

  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [newJobName, setNewJobName] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const targetJobOptions = jobs.filter(
    (j) => !sourceJobIds.includes(j.id),
  );

  const selectedTargetJob = targetJobOptions.find((j) => j.id === selectedJobId);

  const fetchCandidatesByJobId = useCallback(
    async (jobId: string): Promise<CandidateNodeFromApi[]> => {
      const response = await fetch(
        `${baseUrl}/candidate-sourcing/get-candidates-by-job-id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
          body: JSON.stringify({ jobId }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch candidates for job ${jobId}`);
      }
      return response.json();
    },
    [tokenPair?.accessToken?.token],
  );

  const handleSubmit = useCallback(async () => {
    let jobId: string;
    let jobName: string;

    if (targetMode === 'new') {
      const trimmedName = newJobName.trim();
      if (!trimmedName) {
        enqueueSnackBar('Enter a job name', {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
        return;
      }
      try {
        const res = await createJob({
          variables: {
            input: { name: trimmedName, isActive: true },
          },
        });
        const createdId = res.data?.createJob?.id;
        if (!createdId) {
          throw new Error('Failed to create job');
        }
        jobId = createdId;
        jobName = trimmedName;
      } catch (err) {
        enqueueSnackBar(
          err instanceof Error ? err.message : 'Failed to create job',
          { variant: SnackBarVariant.Error, duration: 5000 },
        );
        return;
      }
    } else {
      if (!selectedTargetJob) {
        enqueueSnackBar('Select a target job', {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
        return;
      }
      jobId = selectedTargetJob.id;
      jobName = selectedTargetJob.name;
    }

    setIsSubmitting(true);
    try {
      const allCandidates: CandidateNodeFromApi[] = [];
      for (const jid of sourceJobIds) {
        const candidates = await fetchCandidatesByJobId(jid);
        allCandidates.push(...candidates);
      }

      const deduped = deduplicateCandidatesByPeopleId(allCandidates);

      if (deduped.length === 0) {
        enqueueSnackBar('No candidates to merge', {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
        setIsSubmitting(false);
        return;
      }

      const candidatesPayload = deduped.map(candidateToLinkedInPremiumFormat);

      const body = {
        candidates: candidatesPayload,
        data_source: 'linkedin_premium',
        job_id: jobId,
        job_name: jobName,
        recruiterId: currentWorkspaceMember?.id,
        job: {
          id: jobId,
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
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            },
            body: JSON.stringify(body),
          },
        );

        const result = await response.json();
        if (result.status === 'ok' || result.status === 'success') {
          enqueueSnackBar(
            `Adding ${deduped.length} candidate(s) to ${jobName}. You will see progress in the notification.`,
            { variant: SnackBarVariant.Success, duration: 4000 },
          );
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
      enqueueSnackBar(message, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    targetMode,
    newJobName,
    selectedTargetJob,
    sourceJobIds,
    createJob,
    fetchCandidatesByJobId,
    currentWorkspaceMember?.id,
    tokenPair?.accessToken?.token,
    enqueueSnackBar,
    refetchJobs,
    onSuccess,
    onClose,
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  ]);

  if (!isOpen) return null;

  const canSubmit =
    !isSubmitting &&
    (targetMode === 'existing' ? !!selectedJobId : !!newJobName.trim());

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
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
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
