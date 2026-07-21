import { IconDotsVertical, IconTrash, IconUpload } from 'twenty-ui/icons';
import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { createDefaultParsedJD } from '@/arx-jd-upload/utils/createDefaultParsedJD';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useRecoilState } from 'recoil';

const DocumentViewer = lazy(() =>
  import('@/activities/files/components/DocumentViewer').then((module) => ({
    default: module.DocumentViewer,
  })),
);

const StyledJDHeaderRow = styled.div<{ $isCompact?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme, $isCompact }) =>
    $isCompact ? theme.spacing(0.5) : theme.spacing(1)};
`;

const StyledJDSummary = styled.div`
  flex: 1;
  min-width: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledJDViewerToggleSummary = styled(StyledJDSummary.withComponent('button'))<{
  $isClickable: boolean;
}>`
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: ${({ $isClickable }) => ($isClickable ? 'pointer' : 'default')};

  &:hover {
    text-decoration: ${({ $isClickable }) => ($isClickable ? 'underline' : 'none')};
    opacity: ${({ $isClickable }) => ($isClickable ? 0.95 : 1)};
  }
`;

const StyledJDViewerContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledJDViewerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledJDViewerCloseButton = styled.button`
  padding: ${({ theme }) => theme.spacing(0.5, 1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.xs};

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledJDMenuContainer = styled.div`
  position: relative;
  display: inline-flex;
`;

const StyledJDMenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(0.5, 1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  transition: all 0.15s ease-in-out;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledJDMenuDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing(1)});
  right: 0;
  min-width: 200px;
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 1000;
`;

const StyledJDMenuAction = styled.button<{ danger?: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  border: none;
  background: transparent;
  text-align: left;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme, danger }) =>
    danger ? theme.color.red : theme.font.color.primary};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

type AssistantJDSectionProps = {
  threadId: string;
  jobId: string | null | undefined;
  threadJobName?: string | null;
  onAttachJobToThread: (jobId: string) => Promise<void> | void;
  hideMenu?: boolean;
  exposeActions?: (actions: {
    openFilePicker: () => void;
    openJDViewer: () => void;
    removeJD: () => Promise<void>;
    canRemoveJD: boolean;
    hasJDFile: boolean;
    uploadLabel: string;
  } | null) => void;
};

export const AssistantJDSection = ({
  threadId,
  jobId,
  threadJobName,
  onAttachJobToThread,
  hideMenu = false,
  exposeActions,
}: AssistantJDSectionProps) => {
  const [isJDMenuOpen, setIsJDMenuOpen] = useState(false);
  const [isJDViewerOpen, setIsJDViewerOpen] = useState(false);
  const jdMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachJobIdRef = useRef<string | null>(null);

  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);

  useEffect(() => {
    // If the user switches conversations, we must not keep "pending attach"
    // from the previous thread. Otherwise the previous thread's parsedJD
    // can remain visible even when the new thread has no `jobId`.
    pendingAttachJobIdRef.current = null;
    // Also close the viewer when switching context.
    setIsJDViewerOpen(false);
  }, [threadId, jobId]);

  const { handleFileUpload, handleFileRemoval, isUploading } =
    useArxJDUpload('job', 'edit');

  const handleFileRemovalRef = useRef(handleFileRemoval);
  useEffect(() => {
    handleFileRemovalRef.current = handleFileRemoval;
  }, [handleFileRemoval]);

  const hasJobAttached = Boolean(jobId);
  const isAttachingJob = Boolean(pendingAttachJobIdRef.current && !jobId);

  const { records: attachmentRecords = [] } = useFindManyRecords({
    objectNameSingular: 'attachment',
    filter: jobId ? { jobId: { eq: jobId } } : undefined,
    skip: !jobId,
  });

  const hasJDFile = attachmentRecords.length > 0;

  const getJDDisplayName = useCallback(() => {
    if (!parsedJD) return null;
    const base =
      parsedJD.jobCode && parsedJD.name
        ? `${parsedJD.jobCode} - ${parsedJD.name}`
        : parsedJD.name || 'Job Description';
    return base.length > 40 ? `${base.slice(0, 37)}...` : base;
  }, [parsedJD]);

  const handleJDReplaceClick = useCallback(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }, []);

  useEffect(() => {
    if (!isJDMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (jdMenuRef.current?.contains(targetNode)) return;
      setIsJDMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isJDMenuOpen]);

  const handleFileInputChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const createdOrUpdatedJobId = await handleFileUpload(files);

    // Prefer the explicit return value from handleFileUpload, but fall back to
    // the current parsedJD.id when available. This makes sure that even if the
    // upload flow succeeds but does not return an id, we still attach the job
    // that was just created/updated to the assistant thread.
    const jobIdToAttach =
      typeof createdOrUpdatedJobId === 'string'
        ? createdOrUpdatedJobId
        : parsedJD?.id ?? null;

    if (!hasJobAttached && typeof jobIdToAttach === 'string') {
      pendingAttachJobIdRef.current = jobIdToAttach;
      await onAttachJobToThread(jobIdToAttach);
    }
    setIsJDMenuOpen(false);
  };

  useEffect(() => {
    if (jobId) {
      if (pendingAttachJobIdRef.current === jobId) {
        pendingAttachJobIdRef.current = null;
      }
      if (parsedJD?.id !== jobId) {
        setParsedJD(
          createDefaultParsedJD({
            id: jobId,
            name: threadJobName ?? '',
          }),
        );
      }
      return;
    }

    if (
      pendingAttachJobIdRef.current &&
      parsedJD?.id === pendingAttachJobIdRef.current
    ) {
      return;
    }

    if (parsedJD) setParsedJD(null);
  }, [threadId, jobId, threadJobName, parsedJD, setParsedJD]);

  const canViewJD = Boolean(hasJobAttached && hasJDFile && parsedJD?.filePath);

  const exposedActions = useMemo(() => {
    if (!exposeActions) return null;

    const canRemoveJD = hasJobAttached && hasJDFile;
    const uploadLabel = hasJDFile ? 'Replace JD' : 'Upload JD';

    return {
      openFilePicker: handleJDReplaceClick,
      openJDViewer: () => setIsJDViewerOpen(true),
      removeJD: async () => {
        await handleFileRemovalRef.current();
      },
      canRemoveJD,
      hasJDFile,
      uploadLabel,
    };
  }, [
    exposeActions,
    handleJDReplaceClick,
    hasJDFile,
    hasJobAttached,
  ]);

  useEffect(() => {
    if (!exposeActions) return;
    if (!exposedActions) return;

    exposeActions(exposedActions);
  }, [exposeActions, exposedActions]);

  useEffect(() => {
    if (!exposeActions) return;

    return () => {
      exposeActions(null);
    };
  }, [exposeActions]);

  const jdSummaryText = isUploading
    ? 'Uploading job description...'
    : isAttachingJob
      ? 'Attaching job...'
      : hasJobAttached
        ? hasJDFile
          ? `JD attached: ${getJDDisplayName() ?? 'Job Description'}`
          : hideMenu
            ? 'Upload JD'
            : 'No JD attached'
        : hideMenu
          ? 'Upload JD to attach a job'
          : 'No job attached';

  const canUploadJD = Boolean(hideMenu && !isUploading && !isAttachingJob);
  const canOpenSummary = canViewJD || canUploadJD;

  return (
    <>
      <StyledJDHeaderRow $isCompact={hideMenu}>
        <StyledJDViewerToggleSummary
          type={canViewJD ? 'button' : 'button'}
          $isClickable={canOpenSummary}
          onClick={() => {
            if (canViewJD) {
              setIsJDViewerOpen(true);
              return;
            }

            if (canUploadJD) {
              handleJDReplaceClick();
            }
          }}
          title={
            canViewJD
              ? 'Click to view job description'
              : canUploadJD
                ? 'Upload job description'
                : undefined
          }
        >
          {jdSummaryText}
        </StyledJDViewerToggleSummary>
        {!hideMenu && (
          <StyledJDMenuContainer ref={jdMenuRef}>
            <StyledJDMenuButton
              type="button"
              onClick={() => setIsJDMenuOpen((open) => !open)}
              title="Job description actions"
            >
              <IconDotsVertical size={14} />
            </StyledJDMenuButton>
            {isJDMenuOpen && (
              <StyledJDMenuDropdown>
                <StyledJDMenuAction
                  type="button"
                  onClick={handleJDReplaceClick}
                  disabled={isUploading}
                >
                  <IconUpload size={14} />
                  {hasJDFile ? 'Replace JD' : 'Upload JD'}
                </StyledJDMenuAction>
                {hasJobAttached && hasJDFile && (
                  <StyledJDMenuAction
                    type="button"
                    danger
                    onClick={async () => {
                      await handleFileRemoval();
                      setIsJDMenuOpen(false);
                    }}
                    disabled={isUploading}
                  >
                    <IconTrash size={14} />
                    Remove JD
                  </StyledJDMenuAction>
                )}
              </StyledJDMenuDropdown>
            )}
          </StyledJDMenuContainer>
        )}
        <input
          ref={fileInputRef}
          data-testid="assistant-jd-file-input"
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </StyledJDHeaderRow>
      {isJDViewerOpen && parsedJD?.filePath && (
        <StyledJDViewerContainer>
          <StyledJDViewerHeader>
            <span>
              Viewing JD:{' '}
              {getJDDisplayName() ?? parsedJD.name ?? 'Job Description'}
            </span>
            <StyledJDViewerCloseButton
              type="button"
              onClick={() => setIsJDViewerOpen(false)}
            >
              Close
            </StyledJDViewerCloseButton>
          </StyledJDViewerHeader>
          <Suspense fallback={null}>
            <DocumentViewer
              documentName={getJDDisplayName() ?? parsedJD.name ?? 'Job Description'}
              documentUrl={parsedJD.filePath}
            />
          </Suspense>
        </StyledJDViewerContainer>
      )}
    </>
  );
};
