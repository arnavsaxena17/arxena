import { IconCheck, IconLoader, IconX } from 'twenty-ui/icons';
import styled from '@emotion/styled';
import React from 'react';

import { useChromeExtensionDetection } from '../hooks/useChromeExtensionDetection';

const StyledStatusIndicator = styled.div<{ isInstalled: boolean; isChecking: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isInstalled, isChecking }) => 
    isChecking ? theme.color.blue : isInstalled ? theme.color.green : theme.color.gray};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  transition: all 0.2s ease-in-out;

  svg {
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.font.color.inverted};
  }
`;

export const ExtensionStatusIndicator: React.FC = () => {
  const { isExtensionInstalled, isChecking, error } = useChromeExtensionDetection();

  if (isChecking) {
    return (
      <StyledStatusIndicator isInstalled={false} isChecking={true}>
        <IconLoader />
        Checking Extension...
      </StyledStatusIndicator>
    );
  }

  if (error) {
    return (
      <StyledStatusIndicator isInstalled={false} isChecking={false}>
        <IconX />
        Extension Not Found
      </StyledStatusIndicator>
    );
  }

  return (
    <StyledStatusIndicator isInstalled={isExtensionInstalled} isChecking={false}>
      {isExtensionInstalled ? <IconCheck /> : <IconX />}
      {isExtensionInstalled ? 'Extension Installed' : 'Extension Not Installed'}
    </StyledStatusIndicator>
  );
};
