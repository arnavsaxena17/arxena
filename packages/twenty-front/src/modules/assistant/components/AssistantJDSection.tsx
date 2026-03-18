import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { createDefaultParsedJD } from '@/arx-jd-upload/utils/createDefaultParsedJD';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { IconDotsVertical, IconTrash, IconUpload } from 'twenty-ui';

const StyledJDHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(1)};
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
  threadJobId: string | null | undefined;
  threadJobName?: string | null;
  onAttachJobToThread: (jobId: string) => Promise<void> | void;
  hideMenu?: boolean;
  exposeActions?: (actions: {
    openFilePicker: () => void;
    removeJD: () => Promise<void>;
    canRemoveJD: boolean;
    uploadLabel: string;
  } | null) => void;
};

export const AssistantJDSection = ({
  threadId,
  threadJobId,
  threadJobName,
  onAttachJobToThread,
  hideMenu = false,
  exposeActions,
}: AssistantJDSectionProps) => {
  const [isJDMenuOpen, setIsJDMenuOpen] = useState(false);
  const jdMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachJobIdRef = useRef<string | null>(null);

  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);

  const { handleFileUpload, handleFileRemoval, isUploading } =
    useArxJDUpload('job', 'edit');

  const hasJobAttached = Boolean(threadJobId);
  const isAttachingJob = Boolean(pendingAttachJobIdRef.current && !threadJobId);

  const { records: attachmentRecords = [] } = useFindManyRecords({
    objectNameSingular: 'attachment',
    filter: threadJobId ? { jobId: { eq: threadJobId } } : undefined,
    skip: !threadJobId,
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
    if (!hasJobAttached && typeof createdOrUpdatedJobId === 'string') {
      pendingAttachJobIdRef.current = createdOrUpdatedJobId;
      await onAttachJobToThread(createdOrUpdatedJobId);
    }
    setIsJDMenuOpen(false);
  };

  useEffect(() => {
    if (threadJobId) {
      if (pendingAttachJobIdRef.current === threadJobId) {
        pendingAttachJobIdRef.current = null;
      }
      if (parsedJD?.id !== threadJobId) {
        setParsedJD(
          createDefaultParsedJD({
            id: threadJobId,
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
  }, [threadId, threadJobId, threadJobName, parsedJD, setParsedJD]);

  useEffect(() => {
    if (!exposeActions) return;
    exposeActions({
      openFilePicker: handleJDReplaceClick,
      removeJD: async () => {
        await handleFileRemoval();
      },
      canRemoveJD: hasJobAttached && hasJDFile,
      uploadLabel: hasJDFile ? 'Replace JD' : 'Upload JD',
    });
    return () => exposeActions(null);
  }, [
    exposeActions,
    handleJDReplaceClick,
    handleFileRemoval,
    hasJDFile,
    hasJobAttached,
  ]);

  return (
    <>
      <StyledJDHeaderRow>
        <StyledJDSummary>
          {isUploading
            ? 'Uploading job description...'
            : isAttachingJob
              ? 'Attaching job...'
              : hasJobAttached
              ? hasJDFile
                ? `JD attached: ${getJDDisplayName() ?? 'Job Description'}`
                : 'No JD attached'
              : 'No job attached (upload a JD to create one)'}
        </StyledJDSummary>
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
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </StyledJDHeaderRow>
    </>
  );
};
