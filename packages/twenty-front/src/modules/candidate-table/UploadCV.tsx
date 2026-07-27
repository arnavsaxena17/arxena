import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { styled } from '@linaria/react';
import { useRef } from 'react';

const StyledButton = styled.button<{ bgColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.bgColor};
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  position: relative;

  &:hover {
    filter: brightness(90%);
  }

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    white-space: nowrap;
  }
  &:hover::after {
    opacity: 1;
  }
`;

const UploadCVButton = styled(StyledButton)`
  margin-left: 8px;
`;

type UploadCVProps = {
  candidateId: string;
  onUploadSuccess: () => void;
  /** @deprecated Unused — auth comes from Apollo / workspace session */
  tokenPair?: any;
  /** @deprecated Unused — createdBy comes from auth context */
  currentIndividual?: any;
  buttonColor?: string;
};

export const UploadCV = ({
  candidateId,
  onUploadSuccess,
  buttonColor = '#4CAF50',
}: UploadCVProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const { uploadAttachmentFile } = useUploadAttachmentFile();

  const handleUpload = async (file: File) => {
    if (!file) {
      return;
    }

    try {
      await uploadAttachmentFile(file, {
        targetObjectNameSingular: 'candidate',
        id: candidateId,
      });

      enqueueSuccessSnackBar({ message: 'CV uploaded successfully' });
      onUploadSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      enqueueErrorSnackBar({ message: 'Failed to upload CV' });
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx"
        onChange={(event) =>
          event.target.files && handleUpload(event.target.files[0])
        }
      />
      <UploadCVButton
        onClick={handleClick}
        bgColor={buttonColor}
        data-tooltip="Upload CV"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </UploadCVButton>
    </>
  );
};
