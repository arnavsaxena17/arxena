import { gql, useMutation } from '@apollo/client';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';
import { graphqlToAddNewJob } from 'twenty-shared';

import type { ContextResultItem } from '../types';
import {
    getSuggestedJobNameFromContext,
    toLinkedInPremiumCandidate,
} from '../utils/orgChartUtils';

const StyledBackdrop = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
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

const StyledRadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledRadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
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

export type OrgChartResultsAddToJobModalProps = {
  isOpen: boolean;
  onClose: () => void;
  results: ContextResultItem[];
  companyName?: string | undefined | null;
  contextModalMode?: string | undefined | null;
  selectedNodeFunction?: string;
  selectedNodeGrade?: string;
  queueStartChatAfter?: boolean;
  onSuccess?: () => void;
};

export const OrgChartResultsAddToJobModal = ({
  isOpen,
  onClose,
  results,
  companyName,
  contextModalMode,
  selectedNodeFunction,
  selectedNodeGrade,
  queueStartChatAfter = true,
  onSuccess,
}: OrgChartResultsAddToJobModalProps) => {
  const { enqueueSnackBar } = useSnackBar();
  const tokenPair = useRecoilValue(tokenPairState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentJobId = useRecoilValue(jobIdAtom);
  const jobs = useRecoilValue(jobsState);
  const { refetchJobs } = useJobRefetch();
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();

  const [jobMode, setJobMode] = useState<'new' | 'existing'>('new');
  const [newJobName, setNewJobName] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(
    new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(false);

  const [createJob] = useMutation(gql(graphqlToAddNewJob));

  const suggestedJobName = useMemo(
    () =>
      getSuggestedJobNameFromContext(companyName ?? 'Company', contextModalMode ?? null),
    [companyName, contextModalMode],
  );

  const activeJobs = useMemo(
    () =>
      [...jobs]
        .filter((j) => j.isActive)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
    [jobs],
  );

  useEffect(() => {
    if (isOpen && activeJobs.length === 0) {
      setIsJobsLoading(true);
      refetchJobs().finally(() => setIsJobsLoading(false));
    }
  }, [isOpen, activeJobs.length, refetchJobs]);

  useEffect(() => {
    if (isOpen && results.length > 0) {
      setSelectedCandidateIds(new Set(results.map((c) => c.id)));
    }
  }, [isOpen, results]);

  useEffect(() => {
    if (isOpen) {
      setNewJobName(suggestedJobName);
    }
  }, [isOpen, suggestedJobName]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (
      currentJobId &&
      currentJobId !== 'job-id' &&
      activeJobs.some((job) => job.id === currentJobId)
    ) {
      setJobMode('existing');
      setSelectedJobId(currentJobId);
      return;
    }

    setJobMode('new');
    setSelectedJobId('');
  }, [activeJobs, currentJobId, isOpen]);

  const selectedJob = useMemo(
    () => activeJobs.find((j) => j.id === selectedJobId),
    [activeJobs, selectedJobId],
  );

  const toggleCandidate = useCallback((id: string) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllCandidates = useCallback(() => {
    setSelectedCandidateIds(new Set(results.map((c) => c.id)));
  }, [results]);

  const deselectAllCandidates = useCallback(() => {
    setSelectedCandidateIds(new Set());
  }, []);

  const handleSubmit = useCallback(async () => {
    const selected = results.filter((c) => selectedCandidateIds.has(c.id));
    if (selected.length === 0) {
      enqueueSnackBar('Select at least one candidate', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
      return;
    }

    let jobId: string;
    let jobName: string;

    if (jobMode === 'new') {
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
            input: {
              name: trimmedName,
              isActive: true,
              ...(currentWorkspaceMember?.id && {
                recruiterId: currentWorkspaceMember.id,
              }),
            },
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
      if (!selectedJob) {
        enqueueSnackBar('Select a job', {
          variant: SnackBarVariant.Error,
          duration: 3000,
        });
        return;
      }
      jobId = selectedJob.id;
      jobName = selectedJob.name;
    }

    setIsSubmitting(true);
    beginUploadProgressSseSession();
    try {
      const candidatesPayload = selected.map(toLinkedInPremiumCandidate);
      const body: Record<string, unknown> = {
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
        queue_start_chat_after: queueStartChatAfter,
      };
      if (selectedNodeFunction ?? selectedNodeGrade) {
        body.org_chart_selected_nodes = {
          ...(selectedNodeFunction && { std_function: selectedNodeFunction }),
          ...(selectedNodeGrade && { std_grade: selectedNodeGrade }),
        };
      }

      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/upload-profiles`,
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
          `Adding ${selected.length} candidate(s) to job. You will see progress in the notification.`,
          { variant: SnackBarVariant.Success, duration: 4000 },
        );
        refetchJobs();
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.message || result.error || 'Upload failed');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to add candidates to job';
      enqueueSnackBar(message, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
      endUploadProgressSseSessionAfterDelay();
    }
  }, [
    selectedCandidateIds,
    results,
    jobMode,
    newJobName,
    selectedJob,
    queueStartChatAfter,
    selectedNodeFunction,
    selectedNodeGrade,
    currentWorkspaceMember?.id,
    tokenPair?.accessToken?.token,
    createJob,
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
    selectedCandidateIds.size > 0 &&
    (jobMode === 'existing' ? !!selectedJobId : !!newJobName.trim());

  return (
    <StyledBackdrop onClick={onClose}>
      <StyledModal onClick={(e) => e.stopPropagation()}>
        <StyledHeader>
          <StyledTitle>Add to job</StyledTitle>
          <StyledCloseButton type="button" onClick={onClose} aria-label="Close">
            ×
          </StyledCloseButton>
        </StyledHeader>
        <StyledBody>
          <StyledSection>
            <StyledSectionLabel>Job</StyledSectionLabel>
            <StyledRadioGroup>
              <StyledRadioLabel>
                <input
                  data-testid="orgchart-add-results-job-mode-new"
                  type="radio"
                  name="jobMode"
                  checked={jobMode === 'new'}
                  onChange={() => setJobMode('new')}
                />
                Create new job
              </StyledRadioLabel>
              <StyledRadioLabel>
                <input
                  data-testid="orgchart-add-results-job-mode-existing"
                  type="radio"
                  name="jobMode"
                  checked={jobMode === 'existing'}
                  onChange={() => setJobMode('existing')}
                />
                Add to existing job
              </StyledRadioLabel>
            </StyledRadioGroup>
          </StyledSection>

          {jobMode === 'new' ? (
            <StyledSection>
              <StyledSectionLabel>Job name</StyledSectionLabel>
              <StyledInput
                data-testid="orgchart-add-results-new-job-name"
                type="text"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                placeholder="e.g. Acme Corp – Leadership"
              />
            </StyledSection>
          ) : (
            <StyledSection>
              <StyledSectionLabel>Select job</StyledSectionLabel>
              <StyledSelect
                data-testid="orgchart-add-results-existing-job-select"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                disabled={isJobsLoading}
              >
                <option value="">Select a job</option>
                {activeJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}
                  </option>
                ))}
              </StyledSelect>
              {isJobsLoading && activeJobs.length === 0 && (
                <StyledSectionLabel as="span" style={{ marginTop: 4 }}>
                  Loading jobs…
                </StyledSectionLabel>
              )}
            </StyledSection>
          )}

          <StyledSection>
            <StyledSectionLabel>
              Candidates ({results.length})
            </StyledSectionLabel>
            {results.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <StyledSecondaryButton type="button" onClick={selectAllCandidates}>
                  Select all
                </StyledSecondaryButton>
                <StyledSecondaryButton
                  type="button"
                  onClick={deselectAllCandidates}
                >
                  Deselect all
                </StyledSecondaryButton>
              </div>
            )}
            <div
              style={{
                maxHeight: 200,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {results.map((c) => (
                <StyledRadioLabel key={c.id}>
                  <input
                    data-testid={`orgchart-add-results-candidate-${c.id}`}
                    type="checkbox"
                    checked={selectedCandidateIds.has(c.id)}
                    onChange={() => toggleCandidate(c.id)}
                  />
                  <span>{c.fullName}</span>
                  {c.headline ? (
                    <span
                      style={{
                        color: 'inherit',
                        opacity: 0.8,
                        fontSize: 12,
                      }}
                    >
                      {c.headline}
                    </span>
                  ) : null}
                </StyledRadioLabel>
              ))}
            </div>
          </StyledSection>
        </StyledBody>
        <StyledFooter>
          <StyledSecondaryButton type="button" onClick={onClose}>
            Cancel
          </StyledSecondaryButton>
          <StyledPrimaryButton
            data-testid="orgchart-add-results-submit"
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Adding…' : 'Add to job'}
          </StyledPrimaryButton>
        </StyledFooter>
      </StyledModal>
    </StyledBackdrop>
  );
};
