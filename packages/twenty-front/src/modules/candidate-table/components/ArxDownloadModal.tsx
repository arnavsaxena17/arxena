import {
  getFormatLabel,
  getOSName,
  getRecommendedFormat,
  getSystemInfo,
  SystemInfo,
  triggerArxenaAppDownload,
} from '@/candidate-table/utils/arxena-app-download';
import { Modal } from 'twenty-ui/surfaces';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useEffect, useState } from 'react';
import { Button } from 'twenty-ui/input';

const StyledModalContent = styled.div`
  padding: ${themeCssVariables.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-width: 220px;
  max-width: 500px;
`;

const StyledTitle = styled.h2`
  margin: 0;
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledDescription = styled.p`
  margin: 0;
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.5;
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledFullWidthButton = styled(Button)`
  width: 100%;
`;

type ArxDownloadModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const ArxDownloadModal = ({ isOpen, onClose }: ArxDownloadModalProps) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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

  return (
    <Modal isOpen={isOpen} size="medium" padding="medium">
      <StyledModalContent>
        <StyledTitle>Download Arxena App</StyledTitle>
        {error ? (
          <StyledDescription style={{ color: themeCssVariables.color.red }}>
            {error}
          </StyledDescription>
        ) : systemInfo ? (
          <>
            <StyledDescription>
              We've detected that you're using {getOSName(systemInfo.os)} (
              {systemInfo.arch}). We'll download the recommended{' '}
              {getFormatLabel(
                systemInfo.os,
                getRecommendedFormat(systemInfo.os),
              )}{' '}
              for your system.
            </StyledDescription>

            <StyledFullWidthButton
              variant="primary"
              onClick={handleDownload}
              disabled={isDownloading}
              title={`Download for ${getOSName(systemInfo.os)}`}
            >
              {isDownloading
                ? 'Starting Download...'
                : `Download for ${getOSName(systemInfo.os)}`}
            </StyledFullWidthButton>
          </>
        ) : (
          <StyledDescription>Detecting your system...</StyledDescription>
        )}
      </StyledModalContent>
    </Modal>
  );
}; 