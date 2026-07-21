import { Button, IconButton } from 'twenty-ui';
import { IconX } from 'twenty-ui/icons';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { useUploadProgressSseSession } from '@/websocket-context/hooks/useUploadProgressSseSession';
import type { OrgChartNodeData } from 'twenty-shared';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

import {
  OUTREACH_TEMPLATES,
  outreachModalTitle,
  type OutreachChannelKey,
} from '../constants/outreachTemplates';
import type { ContextResultItem } from '../types';
import {
  pollCandidateIdOnJob,
  uploadOrgChartCandidatesToJob,
} from '../utils/orgChartUtils';
import {
  OrgChartModalTightContent,
  OrgChartModalTightHeader,
} from './OrgChartModalTightContent';

const StyledOrgChartOutreachModal = styled(Modal)`
  max-height: 90dvh;
  width: min(640px, 100vw - ${({ theme }) => theme.spacing(8)});
`;

const StyledHeaderContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

const StyledModalTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  max-height: min(560px, calc(90dvh - 200px));
  overflow-y: auto;
  width: 100%;
`;

const StyledOutreachModalFooter = styled(Modal.Footer)`
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  height: auto;
  justify-content: flex-end;
  min-height: 60px;
`;

const StyledCandidateHeaderCard = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.secondary};
  padding: ${({ theme }) => theme.spacing(2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.75)};
`;

const StyledCandidateHeaderTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCandidateHeaderSubline = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledTaskBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.75)};
`;

const StyledTaskHeading = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.font.color.tertiary};
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

const StyledTextarea = styled.textarea`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  min-height: 120px;
  resize: vertical;
  font-family: inherit;
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

export type OrgChartOutreachModalProps = {
  isOpen: boolean;
  onClose: () => void;
  channel: OutreachChannelKey | null;
  contextItem: ContextResultItem | null;
  node: OrgChartNodeData | null;
  companyName?: string;
  /** When true, LinkedIn invites can be sent without adding to a job. */
  allowSkipJob?: boolean;
};

export const OrgChartOutreachModal = ({
  isOpen,
  onClose,
  channel,
  contextItem,
  node,
  companyName,
  allowSkipJob = false,
}: OrgChartOutreachModalProps) => {
  const { enqueueSnackBar } = useSnackBar();
  const tokenPair = useRecoilValue(tokenPairState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const currentJobId = useRecoilValue(jobIdAtom);
  const setJobId = useSetRecoilState(jobIdAtom);
  const jobs = useRecoilValue(jobsState);
  const { refetchJobs } = useJobRefetch();
  const {
    beginUploadProgressSseSession,
    endUploadProgressSseSessionAfterDelay,
  } = useUploadProgressSseSession();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState(
    'Message from your recruiter',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [alsoAddToJob, setAlsoAddToJob] = useState(!allowSkipJob);

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

  const templates = channel ? OUTREACH_TEMPLATES[channel] : [];

  useEffect(() => {
    if (isOpen && activeJobs.length === 0) {
      setIsJobsLoading(true);
      refetchJobs().finally(() => setIsJobsLoading(false));
    }
  }, [isOpen, activeJobs.length, refetchJobs]);

  useEffect(() => {
    if (!isOpen || !channel) {
      return;
    }
    const list = OUTREACH_TEMPLATES[channel];
    const first = list[0];
    setTemplateId(first?.id ?? '');
    setMessage(first?.body ?? '');
  }, [isOpen, channel]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setAlsoAddToJob(!allowSkipJob);
  }, [isOpen, allowSkipJob]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (
      currentJobId &&
      currentJobId !== 'job-id' &&
      activeJobs.some((job) => job.id === currentJobId)
    ) {
      setSelectedJobId(currentJobId);
      return;
    }
    setSelectedJobId('');
  }, [activeJobs, currentJobId, isOpen]);

  const selectedJob = useMemo(
    () => activeJobs.find((j) => j.id === selectedJobId),
    [activeJobs, selectedJobId],
  );

  const onTemplateChange = useCallback(
    (id: string) => {
      setTemplateId(id);
      const t = templates.find((x) => x.id === id);
      if (t) {
        setMessage(t.body);
      }
    },
    [templates],
  );

  const onJobChange = useCallback(
    (jobId: string) => {
      setSelectedJobId(jobId);
      if (jobId.trim()) {
        setJobId(jobId);
      }
    },
    [setJobId],
  );

  const handleSubmit = useCallback(async () => {
    if (!channel || !contextItem) {
      enqueueSnackBar('Missing candidate context.', {
        variant: SnackBarVariant.Error,
        duration: 4000,
      });
      return;
    }
    const requiresJob = !allowSkipJob || alsoAddToJob || channel !== 'linkedin_invite';
    if (requiresJob && !selectedJob) {
      enqueueSnackBar('Select a job and try again.', {
        variant: SnackBarVariant.Error,
        duration: 4000,
      });
      return;
    }
    const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    const accessToken = tokenPair?.accessToken?.token ?? '';
    if (!baseUrl.trim() || !accessToken) {
      enqueueSnackBar('Sign in and ensure the server URL is configured.', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
      return;
    }

    if (channel === 'linkedin_invite' && !contextItem.linkedinUrl?.trim()) {
      enqueueSnackBar('LinkedIn URL is required.', {
        variant: SnackBarVariant.Error,
        duration: 4000,
      });
      return;
    }
    if (channel === 'whatsapp' && !contextItem.phone?.trim()) {
      enqueueSnackBar('Phone number is required.', {
        variant: SnackBarVariant.Error,
        duration: 4000,
      });
      return;
    }
    if (
      (channel === 'google_contact' || channel === 'email') &&
      !contextItem.email?.trim()
    ) {
      enqueueSnackBar('Email is required.', {
        variant: SnackBarVariant.Error,
        duration: 4000,
      });
      return;
    }
    if (channel === 'google_contact' && !contextItem.phone?.trim()) {
      enqueueSnackBar('Phone is required for Google Contacts.', {
        variant: SnackBarVariant.Error,
        duration: 4000,
      });
      return;
    }

    setIsSubmitting(true);
    beginUploadProgressSseSession();
    try {
      if (requiresJob && selectedJob) {
        const nodeStdFunction = node
          ? ((node as Record<string, unknown>).std_function as
              | string
              | undefined)
          : undefined;
        const nodeStdGrade = node
          ? ((node as Record<string, unknown>).std_grade as string | undefined)
          : undefined;

        const upload = await uploadOrgChartCandidatesToJob({
          baseUrl,
          accessToken,
          items: [
            {
              ...contextItem,
              company: contextItem.company || companyName || '',
            },
          ],
          jobId: selectedJob.id,
          jobName: selectedJob.name,
          recruiterId: currentWorkspaceMember?.id,
          queueStartChatAfter: false,
          orgChartSelectedNodes:
            nodeStdFunction ?? nodeStdGrade
              ? {
                  ...(nodeStdFunction && { std_function: nodeStdFunction }),
                  ...(nodeStdGrade && { std_grade: nodeStdGrade }),
                }
              : undefined,
        });

        if (!upload.ok) {
          throw new Error(upload.message);
        }

        let candidateId: string | null = null;
        if (contextItem.linkedinUrl?.trim()) {
          candidateId = await pollCandidateIdOnJob({
            baseUrl,
            accessToken,
            linkedinUrl: contextItem.linkedinUrl.trim(),
            jobId: selectedJob.id,
            maxAttempts: 25,
            delayMs: 1200,
          });
        }

        if (
          candidateId &&
          contextItem.linkedinUrl &&
          (contextItem.email || contextItem.phone)
        ) {
          const emails =
            contextItem.email && contextItem.email.trim()
              ? [contextItem.email.trim()]
              : [];
          const phones =
            contextItem.phone && contextItem.phone.trim()
              ? [contextItem.phone.trim()]
              : [];
          if (emails.length > 0 || phones.length > 0) {
            try {
              await fetch(
                `${baseUrl.replace(/\/$/, '')}/candidate-sourcing/update-contact-from-enrichment`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    linkedinUrl: contextItem.linkedinUrl.trim(),
                    emails,
                    phones,
                    jobId: selectedJob.id,
                    candidateId,
                  }),
                  credentials: 'include',
                },
              );
            } catch {
              // best-effort
            }
          }
        }
      }

      const outreachBody: Record<string, unknown> = {
        channel,
        message:
          channel === 'google_contact'
            ? message.trim() || `Added from org chart — ${contextItem.fullName}`
            : message.trim(),
        templateId: templateId || undefined,
        linkedinUrl: contextItem.linkedinUrl,
        phone: contextItem.phone,
        email: contextItem.email,
        fullName: contextItem.fullName,
        jobTitle: contextItem.headline,
        companyName: contextItem.company || companyName,
      };
      if (selectedJob && requiresJob) {
        outreachBody.jobId = selectedJob.id;
      }
      if (channel === 'email') {
        outreachBody.subject = emailSubject.trim();
      }

      const outreachRes = await fetch(
        `${baseUrl.replace(/\/$/, '')}/org-chart-outreach/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(outreachBody),
        },
      );
      const outreachJson = (await outreachRes.json()) as {
        success?: boolean;
        message?: string;
        statusCode?: number;
      };
      if (!outreachRes.ok) {
        const rawMsg = outreachJson.message;
        let errMsg = 'Outreach failed';
        if (typeof rawMsg === 'string') {
          errMsg = rawMsg;
        }
        if (Array.isArray(rawMsg)) {
          errMsg = rawMsg
            .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
            .join('; ');
        }
        throw new Error(errMsg);
      }

      enqueueSnackBar(
        channel === 'google_contact'
          ? 'Contact added to Google.'
          : 'Outreach sent.',
        {
          variant: SnackBarVariant.Success,
          duration: 4000,
        },
      );
      refetchJobs();
      onClose();
    } catch (err) {
      enqueueSnackBar(err instanceof Error ? err.message : 'Outreach failed', {
        variant: SnackBarVariant.Error,
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
      endUploadProgressSseSessionAfterDelay();
    }
  }, [
    allowSkipJob,
    alsoAddToJob,
    beginUploadProgressSseSession,
    channel,
    companyName,
    contextItem,
    currentWorkspaceMember?.id,
    emailSubject,
    enqueueSnackBar,
    endUploadProgressSseSessionAfterDelay,
    message,
    node,
    onClose,
    refetchJobs,
    selectedJob,
    templateId,
    tokenPair?.accessToken?.token,
  ]);

  if (!isOpen || !channel || !contextItem) {
    return null;
  }

  return (
    <StyledOrgChartOutreachModal
      isClosable
      onClose={onClose}
      size="large"
      padding="none"
    >
      <OrgChartModalTightHeader>
        <OnboardingIntentModalLayout>
          <StyledHeaderContainer>
            <StyledModalTitle>{outreachModalTitle(channel)}</StyledModalTitle>
            <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
          </StyledHeaderContainer>
        </OnboardingIntentModalLayout>
      </OrgChartModalTightHeader>
      <OrgChartModalTightContent>
        <OnboardingIntentModalLayout>
          <StyledBody>
            <StyledCandidateHeaderCard data-testid="orgchart-outreach-candidate">
              <StyledCandidateHeaderTitle>
                {contextItem.fullName}
              </StyledCandidateHeaderTitle>
              {(contextItem.headline || contextItem.company || companyName) && (
                <StyledCandidateHeaderSubline>
                  {[contextItem.headline, contextItem.company || companyName]
                    .filter((x) => typeof x === 'string' && x.trim().length > 0)
                    .join(' · ')}
                </StyledCandidateHeaderSubline>
              )}
            </StyledCandidateHeaderCard>

            {channel === 'google_contact' ? (
              <StyledTaskBlock>
                <StyledSectionLabel>Choose a job</StyledSectionLabel>
                <StyledSelect
                  data-testid="orgchart-outreach-job-select"
                  value={selectedJobId}
                  onChange={(e) => onJobChange(e.target.value)}
                  disabled={isJobsLoading}
                >
                  <option value="">Select a job</option>
                  {activeJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </StyledSelect>
              </StyledTaskBlock>
            ) : (
              <>
                {allowSkipJob && channel === 'linkedin_invite' ? (
                  <StyledTaskBlock>
                    <StyledSectionLabel>
                      <label
                        style={{
                          alignItems: 'center',
                          display: 'inline-flex',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={alsoAddToJob}
                          onChange={(e) => setAlsoAddToJob(e.target.checked)}
                          data-testid="orgchart-outreach-also-add-to-job"
                        />
                        Also add to a job
                      </label>
                    </StyledSectionLabel>
                  </StyledTaskBlock>
                ) : null}
                {(!allowSkipJob ||
                  alsoAddToJob ||
                  channel !== 'linkedin_invite') && (
                  <StyledTaskBlock>
                    <StyledTaskHeading>Step 1</StyledTaskHeading>
                    <StyledSectionLabel>Choose a job</StyledSectionLabel>
                    <StyledSelect
                      data-testid="orgchart-outreach-job-select"
                      value={selectedJobId}
                      onChange={(e) => onJobChange(e.target.value)}
                      disabled={isJobsLoading}
                    >
                      <option value="">Select a job</option>
                      {activeJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.name}
                        </option>
                      ))}
                    </StyledSelect>
                  </StyledTaskBlock>
                )}

                <StyledTaskBlock>
                  <StyledTaskHeading>
                    {allowSkipJob &&
                    channel === 'linkedin_invite' &&
                    !alsoAddToJob
                      ? 'Step 1'
                      : 'Step 2'}
                  </StyledTaskHeading>
                  <StyledSectionLabel>Pick a template</StyledSectionLabel>
                  <StyledSelect
                    data-testid="orgchart-outreach-template-select"
                    value={templateId}
                    onChange={(e) => onTemplateChange(e.target.value)}
                  >
                    {templates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.label}
                      </option>
                    ))}
                  </StyledSelect>
                </StyledTaskBlock>

                {channel === 'email' ? (
                  <StyledTaskBlock>
                    <StyledTaskHeading>Step 3</StyledTaskHeading>
                    <StyledSectionLabel>Subject</StyledSectionLabel>
                    <StyledInput
                      data-testid="orgchart-outreach-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </StyledTaskBlock>
                ) : null}

                <StyledTaskBlock>
                  <StyledTaskHeading>
                    {channel === 'email' ? 'Step 4' : 'Step 3'}
                  </StyledTaskHeading>
                  <StyledSectionLabel>Customize the message</StyledSectionLabel>
                  <StyledTextarea
                    data-testid="orgchart-outreach-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </StyledTaskBlock>
              </>
            )}
          </StyledBody>
        </OnboardingIntentModalLayout>
      </OrgChartModalTightContent>
      <StyledOutreachModalFooter>
        <Button variant="secondary" title="Cancel" onClick={onClose} />
        <Button
          variant="primary"
          title={
            isSubmitting
              ? channel === 'google_contact'
                ? 'Adding…'
                : 'Sending…'
              : channel === 'google_contact'
                ? 'Add to Google Contacts'
                : allowSkipJob && !alsoAddToJob
                  ? 'Send connection request'
                  : 'Add to job & send'
          }
          onClick={() => void handleSubmit()}
          disabled={
            isSubmitting ||
            ((!(allowSkipJob && channel === 'linkedin_invite' && !alsoAddToJob) &&
              !selectedJobId) ||
              (channel !== 'google_contact' && !message.trim()))
          }
          dataTestId="orgchart-outreach-send"
        />
      </StyledOutreachModalFooter>
    </StyledOrgChartOutreachModal>
  );
};
