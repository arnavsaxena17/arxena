import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { Button } from 'twenty-ui';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import { projectIdAtom, projectsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useOrgChartSnackBar } from '@/orgchart/hooks/useOrgChartSnackBar';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';
import { graphqlToAddNewProject } from 'twenty-shared/graphql';

import type { ContextResultItem } from '../types';
import {
  getSuggestedJobNameFromContext,
  uploadOrgChartCandidatesToJob,
} from '../utils/orgChartUtils';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  overflow: auto;
  padding: 0;
  width: 100%;
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

const StyledRadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledRadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1.5]};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1.5]};
  justify-content: flex-end;
  margin-top: ${themeCssVariables.spacing[1]};
  padding-top: ${themeCssVariables.spacing[2]};
  border-top: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledSelectAllRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin-bottom: ${themeCssVariables.spacing[0.5]};
`;

export type OrgChartResultsAddToProjectPanelProps = {
  results: ContextResultItem[];
  companyName?: string | undefined | null;
  contextModalMode?: string | undefined | null;
  selectedNodeFunction?: string;
  selectedNodeGrade?: string;
  queueStartChatAfter?: boolean;
  initialSelectedIds?: string[];
  onCancel: () => void;
  onComplete: () => void;
};

export const OrgChartResultsAddToProjectPanel = ({
  results,
  companyName,
  contextModalMode,
  selectedNodeFunction,
  selectedNodeGrade,
  queueStartChatAfter = true,
  initialSelectedIds,
  onCancel,
  onComplete,
}: OrgChartResultsAddToProjectPanelProps) => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useOrgChartSnackBar();
  const tokenPair = useAtomStateValue(tokenPairState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const currentProjectId = useAtomStateValue(projectIdAtom);
  const projects = useAtomStateValue(projectsState);
  const { refetchJobs } = useProjectRefetch();
  const {
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  } = useUploadProgressSseSession();

  const [jobMode, setJobMode] = useState<'new' | 'existing'>('new');
  const [newJobName, setNewJobName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(
    new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(false);

  const apolloCoreClient = useApolloCoreClient();
  const [createProject] = useMutation(gql(graphqlToAddNewProject), {
    client: apolloCoreClient,
  });

  const suggestedJobName = useMemo(
    () =>
      getSuggestedJobNameFromContext(
        companyName ?? 'Company',
        contextModalMode ?? null,
      ),
    [companyName, contextModalMode],
  );

  const activeJobs = useMemo(
    () =>
      [...projects]
        .filter((j) => j.isActive)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
    [projects],
  );

  const selectedJob = useMemo(
    () => activeJobs.find((j) => j.id === selectedProjectId),
    [activeJobs, selectedProjectId],
  );

  useEffect(() => {
    if (activeJobs.length === 0) {
      setIsJobsLoading(true);
      refetchJobs().finally(() => setIsJobsLoading(false));
    }
  }, [activeJobs.length, refetchJobs]);

  useEffect(() => {
    if (results.length > 0) {
      const ids =
        initialSelectedIds && initialSelectedIds.length > 0
          ? initialSelectedIds.filter((id) => results.some((r) => r.id === id))
          : results.map((c) => c.id);
      setSelectedCandidateIds(new Set(ids.length > 0 ? ids : results.map((c) => c.id)));
    }
  }, [results, initialSelectedIds]);

  useEffect(() => {
    setNewJobName(suggestedJobName);
  }, [suggestedJobName]);

  useEffect(() => {
    if (
      currentProjectId &&
      currentProjectId !== 'project-id' &&
      activeJobs.some((job) => job.id === currentProjectId)
    ) {
      setJobMode('existing');
      setSelectedProjectId(currentProjectId);
      return;
    }

    setJobMode('new');
    setSelectedProjectId('');
  }, [activeJobs, currentProjectId]);

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

    let projectId: string;
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
        const res = await createProject({
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
        const createdId = (
          res.data as { createProject?: { id?: string } } | null | undefined
        )?.createProject?.id;
        if (!createdId) {
          throw new Error('Failed to create job');
        }
        projectId = createdId;
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
      projectId = selectedJob.id;
      jobName = selectedJob.name;
    }

    setIsSubmitting(true);
    beginUploadProgressSseSession();
    try {
      const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';
      const upload = await uploadOrgChartCandidatesToJob({
        baseUrl,
        accessToken: tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '',
        items: selected,
        projectId,
        jobName,
        recruiterId: currentWorkspaceMember?.id,
        queueStartChatAfter,
        orgChartSelectedNodes:
          (selectedNodeFunction ?? selectedNodeGrade)
            ? {
                ...(selectedNodeFunction && {
                  std_function: selectedNodeFunction,
                }),
                ...(selectedNodeGrade && { std_grade: selectedNodeGrade }),
              }
            : undefined,
      });
      if (upload.ok) {
        enqueueSnackBar(
          `Adding ${selected.length} candidate(s) to job. You will see progress in the notification.`,
          { variant: SnackBarVariant.Success, duration: 4000 },
        );
        refetchJobs();
        onComplete();
      } else {
        throw new Error(upload.message);
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
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    createProject,
    enqueueSnackBar,
    refetchJobs,
    onComplete,
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  ]);

  const canSubmit =
    !isSubmitting &&
    selectedCandidateIds.size > 0 &&
    (jobMode === 'existing' ? !!selectedProjectId : !!newJobName.trim());

  return (
    <StyledBody data-testid="orgchart-add-results-to-job-panel">
      <StyledSection>
        <StyledSectionLabel>Project</StyledSectionLabel>
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
          <StyledSectionLabel>Project name</StyledSectionLabel>
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
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
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
        <StyledSectionLabel>Candidates ({results.length})</StyledSectionLabel>
        {results.length > 1 && (
          <StyledSelectAllRow>
            <Button
              variant="secondary"
              size="small"
              title={t`Select all`}
              onClick={selectAllCandidates}
            />
            <Button
              variant="secondary"
              size="small"
              title={t`Deselect all`}
              onClick={deselectAllCandidates}
            />
          </StyledSelectAllRow>
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

      <StyledFooter>
        <Button variant="secondary" title={t`Cancel`} onClick={onCancel} />
        <Button
          variant="primary"
          title={isSubmitting ? t`Adding…` : t`Add to job`}
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          dataTestId="orgchart-add-results-submit"
        />
      </StyledFooter>
    </StyledBody>
  );
};
