import {
  getFormatLabel,
  getOSName,
  getRecommendedFormat,
  getSystemInfo,
  SystemInfo,
  triggerArxenaAppDownload,
} from '@/candidate-table/utils/arxena-app-download';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { Button } from 'twenty-ui';

const StyledModalContent = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  min-width: 220px;
  max-width: 500px;
`;

const StyledTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.color.gray[900]};
`;

const StyledDescription = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 1.5;
  color: ${({ theme }) => theme.color.gray[600]};
`;

const StyledButtonContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
  text-align: center;
`;

type ArxDownloadModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const ArxDownloadModal = ({ isOpen, onClose }: ArxDownloadModalProps) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (isOpen) {
      try {
        setSystemInfo(getSystemInfo());
      } catch (err) {
        setError('Failed to detect system information');
        console.error('System detection error:', err);
      }
    }
  }, [isOpen]);

  const handleDownload = async () => {
    try {
      if (!systemInfo) {
        throw new Error('System information not available');
      }
      setIsDownloading(true);
      triggerArxenaAppDownload(systemInfo);
      setTimeout(() => {
        setIsDownloading(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError('Failed to download the application');
      setIsDownloading(false);
      console.error('Download error:', err);
    }
  };

  return isOpen ? (
    <Modal 
      isClosable 
      onClose={onClose}
      size="small"
    >
      <StyledModalContent>
        <StyledTitle>Download Arxena App</StyledTitle>
        {error ? (
          <StyledDescription style={{ color: theme.color.red[500] }}>{error}</StyledDescription>
        ) : systemInfo ? (
          <>
            <StyledDescription>
              We've detected that you're using {getOSName(systemInfo.os)} ({systemInfo.arch}).
              We'll download the recommended {getFormatLabel(systemInfo.os, getRecommendedFormat(systemInfo.os))} for your system.
            </StyledDescription>

            <StyledButtonContainer>
              <Button
                variant="primary"
                onClick={handleDownload}
                disabled={isDownloading}
                fullWidth
                title={`Download for ${getOSName(systemInfo.os)}`}
              >
                {isDownloading ? 'Starting Download...' : `Download for ${getOSName(systemInfo.os)}`}
              </Button>
            </StyledButtonContainer>
          </>
        ) : (
          <StyledDescription>Detecting your system...</StyledDescription>
        )}
      </StyledModalContent>
    </Modal>
  ) : null;
}; 