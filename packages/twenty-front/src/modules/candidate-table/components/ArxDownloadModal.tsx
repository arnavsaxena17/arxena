// import { Button } from '@/ui/input/button/components/Button';
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

type SystemInfo = {
  os: string;
  arch: string;
};

type ArxDownloadModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const ArxDownloadModal = ({ isOpen, onClose }: ArxDownloadModalProps) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const theme = useTheme();

  const getBaseUrl = () => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:5050' 
      : 'https://arxena.com';
  };

  const detectOS = (userAgent: string): string => {
    userAgent = userAgent.toLowerCase();
    console.log("userAgent", userAgent);

    // Check for macOS (multiple possible indicators)
    if (userAgent.includes('mac os x') || 
        userAgent.includes('macintosh') || 
        userAgent.includes('darwin')) {
      return 'darwin';
    }
    
    // Check for Windows (multiple possible indicators)
    if (userAgent.includes('windows') || 
        userAgent.includes('win64') || 
        userAgent.includes('win32')) {
      return 'windows';
    }
    
    // Check for Linux (multiple possible indicators)
    if (userAgent.includes('linux') || 
        userAgent.includes('x11') ||
        userAgent.includes('ubuntu') ||
        userAgent.includes('fedora') ||
        userAgent.includes('debian')) {
      return 'linux';
    }

    // If no match found
    return 'unknown';
  };

  const detectArchitecture = (): string => {
    const platform = window.navigator.platform.toLowerCase();
    const userAgent = window.navigator.userAgent.toLowerCase();
    const cpuClass = (navigator as any).cpuClass;
    
    console.log("platform", platform);
    console.log("cpuClass", cpuClass);

    // Check for ARM architecture
    if (platform.includes('arm') || 
        userAgent.includes('arm') || 
        userAgent.includes('aarch64')) {
      return 'arm64';
    }

    // Check for specific 64-bit indicators
    if (platform.includes('x64') || 
        platform.includes('x86_64') || 
        platform.includes('amd64') ||
        userAgent.includes('x64') || 
        userAgent.includes('x86_64') || 
        userAgent.includes('amd64') ||
        (cpuClass && cpuClass.includes('64'))) {
      return 'x64';
    }

    // Default to x64 if we can't definitively determine
    return 'x64';
  };

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const userAgent = window.navigator.userAgent;
        const os = detectOS(userAgent);
        const arch = detectArchitecture();
        
        setSystemInfo({ os, arch });
      } catch (err) {
        setError('Failed to detect system information');
        console.error('System detection error:', err);
      }
    };

    if (isOpen) {
      fetchSystemInfo();
    }
  }, [isOpen]);

  const getRecommendedFormat = (os: string): string => {
    switch (os.toLowerCase()) {
      case 'darwin':
        return 'dmg';
      case 'linux':
        return 'appimage';
      case 'windows':
        return 'exe';
      default:
        return '';
    }
  };

  const getFormatLabel = (os: string, format: string): string => {
    switch (format) {
      case 'dmg':
        return 'DMG Installer';
      case 'appimage':
        return 'AppImage';
      case 'exe':
        return 'Windows Installer';
      case 'deb':
        return 'DEB Package';
      default:
        return 'Installer';
    }
  };

  const handleDownload = async () => {
    try {
      if (!systemInfo) {
        throw new Error('System information not available');
      }

      setIsDownloading(true);
      const baseUrl = getBaseUrl();
      const format = getRecommendedFormat(systemInfo.os);
      
      const response = await fetch(`${baseUrl}/download-app?arch=${systemInfo.arch}&format=${format}`, {
        method: 'GET',
        headers: {
          'User-Agent': window.navigator.userAgent, // Ensure OS detection works on backend
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the filename from the Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'arxena-app';
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Close modal after a short delay to show download starting
      setTimeout(() => {
        setIsDownloading(false);
        onClose();
      }, 1000);
    } catch (err) {
      setError('Failed to download the application');
      setIsDownloading(false);
      console.error('Download error:', err);
    }
  };

  const getOSName = (os: string): string => {
    console.log("os of the system", os);
    switch (os.toLowerCase()) {
      case 'windows':
        return 'Windows';
      case 'darwin':
        return 'macOS';
      case 'linux':
        return 'Linux';
      case 'unknown':
        return 'Unknown Operating System';
      default:
        return `${os.charAt(0).toUpperCase()}${os.slice(1)}`;
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