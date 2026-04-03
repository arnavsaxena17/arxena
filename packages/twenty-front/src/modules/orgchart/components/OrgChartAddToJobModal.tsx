import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { jobsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';

const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

import type { OrgChartNodeData } from 'twenty-shared';
import { getProxiedImageUrl, isValidLinkedInProfileUrl } from 'twenty-shared';
import type { ContextResultItem } from '../types';
import { toLinkedInPremiumCandidate } from '../utils/orgChartUtils';

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

const StyledCandidateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  max-height: 200px;
  overflow: auto;
`;

const StyledCandidateRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  padding: ${({ theme }) => theme.spacing(1)} 0;
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
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

export type OrgChartAddToJobModalProps = {
  isOpen: boolean;
  onClose: () => void;
  node: OrgChartNodeData | null;
  companyName?: string;
  queueStartChatAfter?: boolean;
  onSuccess?: () => void;
};

export const OrgChartAddToJobModal = ({
  isOpen,
  onClose,
  node,
  companyName,
  queueStartChatAfter = true,
  onSuccess,
}: OrgChartAddToJobModalProps) => {
  const { enqueueSnackBar } = useSnackBar();
  const tokenPair = useRecoilValue(tokenPairState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const jobs = useRecoilValue(jobsState);
  const { refetchJobs } = useJobRefetch();
  const { beginUploadProgressSseSession, endUploadProgressSseSessionAfterDelay } =
    useUploadProgressSseSession();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(false);

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
      const candidatesPayload = selected.map(toLinkedInPremiumCandidate);
      const nodeStdFunction = node
        ? (node as Record<string, unknown>).std_function as string | undefined
        : undefined;
      const nodeStdGrade = node
        ? (node as Record<string, unknown>).std_grade as string | undefined
        : undefined;
      const body: Record<string, unknown> = {
        candidates: candidatesPayload,
        data_source: 'linkedin_premium',
        job_id: selectedJob.id,
        job_name: selectedJob.name,
        recruiterId: currentWorkspaceMember?.id,
        job: {
          id: selectedJob.id,
          name: selectedJob.name,
          recruiterId: currentWorkspaceMember?.id,
        },
        queue_start_chat_after: queueStartChatAfter,
      };
      if (nodeStdFunction ?? nodeStdGrade) {
        body.org_chart_selected_nodes = {
          ...(nodeStdFunction && { std_function: nodeStdFunction }),
          ...(nodeStdGrade && { std_grade: nodeStdGrade }),
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
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.message || result.error || 'Upload failed');
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
    tokenPair?.accessToken?.token,
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
            <StyledSectionLabel>Job</StyledSectionLabel>
            <StyledSelect
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
                const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
                const avatarUrl = rawUrl
                  ? getProxiedImageUrl(rawUrl, baseUrl)
                  : undefined;
                return (
                  <StyledCandidateRow key={c.id}>
                    {avatarUrl && <CandidateAvatar src={avatarUrl} size={30} />}
                    <input
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
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting || !selectedJobId || selectedCandidateIds.size === 0
            }
          >
            {isSubmitting ? 'Adding…' : 'Add to job'}
          </StyledPrimaryButton>
        </StyledFooter>
      </StyledModal>
    </StyledBackdrop>
  );
};
