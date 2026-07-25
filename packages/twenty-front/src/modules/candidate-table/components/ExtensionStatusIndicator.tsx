import { IconCheck, IconLoader, IconX } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import React from 'react';

import { useChromeExtensionDetection } from '../hooks/useChromeExtensionDetection';

const StyledStatusIndicator = styled.div<{ isInstalled: boolean; isChecking: boolean }>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${({ isInstalled, isChecking }) =>
    isChecking ? themeCssVariables.color.blue : isInstalled ? themeCssVariables.color.green : themeCssVariables.color.gray};
  color: ${themeCssVariables.font.color.inverted};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  transition: all 0.2s ease-in-out;

  svg {
    width: 16px;
    height: 16px;
    color: ${themeCssVariables.font.color.inverted};
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
