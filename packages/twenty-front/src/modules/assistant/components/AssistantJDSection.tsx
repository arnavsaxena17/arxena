import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import type { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import styled from '@emotion/styled';
import { useCallback, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
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

export const AssistantJDSection = () => {
  const [isJDMenuOpen, setIsJDMenuOpen] = useState(false);
  const jdMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsedJD: ParsedJD | null = useRecoilValue(parsedJDSelector);

  const { handleFileUpload, handleFileRemoval, isUploading } =
    useArxJDUpload('job');

  const hasJD = Boolean(parsedJD?.id);

  const getJDDisplayName = useCallback(() => {
    if (!parsedJD) return null;
    const base =
      parsedJD.jobCode && parsedJD.name
        ? `${parsedJD.jobCode} - ${parsedJD.name}`
        : parsedJD.name || 'Job Description';
    return base.length > 40 ? `${base.slice(0, 37)}...` : base;
  }, [parsedJD]);

  const handleJDReplaceClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileInputChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    await handleFileUpload(files);
  };

  if (!parsedJD && !isUploading) {
    return null;
  }

  return (
    <>
      <StyledJDHeaderRow>
        <StyledJDSummary>
          {isUploading
            ? 'Uploading job description...'
            : `JD attached: ${getJDDisplayName()}`}
        </StyledJDSummary>
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
                Replace JD
              </StyledJDMenuAction>
              {hasJD && (
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
