import { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import { projectIdAtom, projectsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useOrgChartSnackBar } from '@/orgchart/hooks/useOrgChartSnackBar';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

import type { OrgChartNodeData } from 'twenty-shared/utils';
import { getProxiedImageUrl, isValidLinkedInProfileUrl } from 'twenty-shared/utils';
import type { ContextResultItem } from '../types';
import { uploadOrgChartCandidatesToJob } from '../utils/orgChartUtils';

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

const StyledCandidateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  max-height: 200px;
  overflow: auto;
`;

const StyledCandidateRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1.5]};
  padding: ${themeCssVariables.spacing[1]} 0;
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledAvatarWrapper = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  min-width: ${({ $size }) => $size}px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
`;

const StyledAvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
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

function buildCandidatesFromNode(
  node: OrgChartNodeData,
  companyName?: string,
): ContextResultItem[] {
  const rows: ContextResultItem[] = [];
  for (let i = 0; i < 16; i += 1) {
    const nameKey = `name_${i}` as keyof OrgChartNodeData;
    const titleKey = `title_${i}` as keyof OrgChartNodeData;
    const linkedinKey = `linkedin_url_${i}` as keyof OrgChartNodeData;
    const imageKey = `image_${i}` as keyof OrgChartNodeData;
    const name = node[nameKey];
    if (typeof name === 'string' && name.trim().length > 0) {
      const linkedinRaw =
        typeof node[linkedinKey] === 'string'
          ? (node[linkedinKey] as string)
          : '';
      const linkedinUrl = isValidLinkedInProfileUrl(linkedinRaw)
        ? linkedinRaw.trim()
        : undefined;
      const image = node[imageKey];
      rows.push({
        id: `${node.key}-${i}`,
        fullName: name.trim(),
        headline: (typeof node[titleKey] === 'string' ? node[titleKey] : '') as string,
        company: companyName ?? '',
        linkedinUrl,
        raw: typeof image === 'string' ? { image, profile_picture_url: image } : {},
      });
    }
  }
  return rows;
}

const getCandidateAvatarUrl = (c: ContextResultItem): string | undefined => {
  const raw = c.raw as Record<string, unknown> | undefined;
  if (!raw) return undefined;
  const img =
    (raw.image as string | undefined) ??
    (raw.profile_picture_url as string | undefined);
  return typeof img === 'string' && img.trim().length > 0 ? img : undefined;
};

const CandidateAvatar = ({ src, size = 30 }: { src: string; size?: number }) => {
  const [effectiveSrc, setEffectiveSrc] = useState(src);

  useEffect(() => {
    setEffectiveSrc(src);
  }, [src]);

  return (
    <StyledAvatarWrapper $size={size}>
      <StyledAvatarImage
        src={effectiveSrc}
        alt=""
        onError={() => setEffectiveSrc(DEFAULT_AVATAR)}
      />
    </StyledAvatarWrapper>
  );
};

export type OrgChartAddToProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  node: OrgChartNodeData | null;
  companyName?: string;
  queueStartChatAfter?: boolean;
  onSuccess?: () => void;
};

export const OrgChartAddToProjectModal = ({
  isOpen,
  onClose,
  node,
  companyName,
  queueStartChatAfter = true,
  onSuccess,
}: OrgChartAddToProjectModalProps) => {
  const { enqueueSnackBar } = useOrgChartSnackBar();
  const tokenPair = useAtomStateValue(tokenPairState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const currentProjectId = useAtomStateValue(projectIdAtom);
  const projects = useAtomStateValue(projectsState);
  const { refetchJobs } = useProjectRefetch();
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(false);

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

  const candidates = useMemo(() => {
    if (!node) return [];
    return buildCandidatesFromNode(node, companyName);
  }, [node, companyName]);

  useEffect(() => {
    if (isOpen && activeJobs.length === 0) {
      setIsJobsLoading(true);
      refetchJobs().finally(() => setIsJobsLoading(false));
    }
  }, [isOpen, activeJobs.length, refetchJobs]);

  useEffect(() => {
    if (isOpen && candidates.length > 0) {
      setSelectedCandidateIds(new Set(candidates.map((c) => c.id)));
    }
  }, [isOpen, candidates]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (
      currentProjectId &&
      currentProjectId !== 'project-id' &&
      activeJobs.some((job) => job.id === currentProjectId)
    ) {
      setSelectedProjectId(currentProjectId);
      return;
    }

    setSelectedProjectId('');
  }, [activeJobs, currentProjectId, isOpen]);

  const selectedJob = useMemo(
    () => activeJobs.find((j) => j.id === selectedProjectId),
    [activeJobs, selectedProjectId],
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
    setSelectedCandidateIds(new Set(candidates.map((c) => c.id)));
  }, [candidates]);

  const deselectAllCandidates = useCallback(() => {
    setSelectedCandidateIds(new Set());
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedJob || !node) return;
    const selected = candidates.filter((c) => selectedCandidateIds.has(c.id));
    if (selected.length === 0) {
      enqueueSnackBar('Select at least one candidate', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    beginUploadProgressSseSession();
    try {
      const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';
      const nodeStdFunction = node
        ? (node as Record<string, unknown>).std_function as string | undefined
        : undefined;
      const nodeStdGrade = node
        ? (node as Record<string, unknown>).std_grade as string | undefined
        : undefined;
      const upload = await uploadOrgChartCandidatesToJob({
        baseUrl,
        accessToken: tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '',
        items: selected,
        projectId: selectedJob.id,
        jobName: selectedJob.name,
        recruiterId: currentWorkspaceMember?.id,
        queueStartChatAfter,
        orgChartSelectedNodes:
          nodeStdFunction ?? nodeStdGrade
            ? {
                ...(nodeStdFunction && { std_function: nodeStdFunction }),
                ...(nodeStdGrade && { std_grade: nodeStdGrade }),
              }
            : undefined,
      });
      if (upload.ok) {
        enqueueSnackBar(
          `Adding ${selected.length} candidate(s) to job. You will see progress in the notification.`,
          { variant: SnackBarVariant.Success, duration: 4000 },
        );
        onSuccess?.();
        onClose();
      } else {
        throw new Error(upload.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add candidates to job';
      enqueueSnackBar(message, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
      endUploadProgressSseSessionAfterDelay();
    }
  }, [
    selectedJob,
    node,
    candidates,
    selectedCandidateIds,
    queueStartChatAfter,
    currentWorkspaceMember?.id,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    enqueueSnackBar,
    onSuccess,
    onClose,
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  ]);

  if (!isOpen) return null;

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
            <StyledSectionLabel>Project</StyledSectionLabel>
            <StyledSelect
              data-testid="orgchart-add-node-existing-job-select"
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
          <StyledSection>
            <StyledSectionLabel>
              Candidates in this position ({candidates.length})
            </StyledSectionLabel>
            {candidates.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <StyledSecondaryButton type="button" onClick={selectAllCandidates}>
                  Select all
                </StyledSecondaryButton>
                <StyledSecondaryButton type="button" onClick={deselectAllCandidates}>
                  Deselect all
                </StyledSecondaryButton>
              </div>
            )}
            <StyledCandidateList>
              {candidates.map((c) => {
                const rawUrl = getCandidateAvatarUrl(c);
                const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';
                const avatarUrl = rawUrl
                  ? getProxiedImageUrl(rawUrl, baseUrl)
                  : undefined;
                return (
                  <StyledCandidateRow key={c.id}>
                    {avatarUrl && <CandidateAvatar src={avatarUrl} size={30} />}
                    <input
                      data-testid={`orgchart-add-node-candidate-${c.id}`}
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
                  </StyledCandidateRow>
                );
              })}
            </StyledCandidateList>
          </StyledSection>
        </StyledBody>
        <StyledFooter>
          <StyledSecondaryButton type="button" onClick={onClose}>
            Cancel
          </StyledSecondaryButton>
          <StyledPrimaryButton
            data-testid="orgchart-add-node-submit"
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting || !selectedProjectId || selectedCandidateIds.size === 0
            }
          >
            {isSubmitting ? 'Adding…' : 'Add to job'}
          </StyledPrimaryButton>
        </StyledFooter>
      </StyledModal>
    </StyledBackdrop>
  );
};
