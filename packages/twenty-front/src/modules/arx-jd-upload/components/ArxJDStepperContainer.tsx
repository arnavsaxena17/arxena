import styled from '@emotion/styled';
import React from 'react';

import { useArxJDFormStepper } from '../hooks/useArxJDFormStepper';
import { FormComponentProps } from '../types/FormComponentProps';
import { ArxJDFormStepper } from './ArxJDFormStepper';
import { ArxJDStepBar } from './ArxJDStepBar';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const StyledHeader = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  display: flex;
  height: 60px;
  padding: 0px;
  padding-left: ${({ theme }) => theme.spacing(6)};
  padding-right: ${({ theme }) => theme.spacing(6)};
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow-y: auto;
`;

export type ArxJDStepperContainerProps = FormComponentProps & {
  onCancel?: () => void;
  onSubmit?: () => void;
  showFooter?: boolean;
  getRootProps?: () => Record<string, any>;
  getInputProps?: () => Record<string, any>;
  isDragActive?: boolean;
  isUploading?: boolean;
  error?: string | null;
  handleFileUpload?: (files: File[]) => Promise<void>;
};

export const ArxJDStepperContainer: React.FC<ArxJDStepperContainerProps> = ({
  parsedJD,
  setParsedJD,
  onCancel,
  onSubmit,
  getRootProps,
  getInputProps,
  isDragActive,
  isUploading,
  error,
  handleFileUpload,
}) => {
  const { activeStep } = useArxJDFormStepper();

  return (
    <StyledContainer onClick={(e) => e.stopPropagation()}>
      <StyledHeader>
        <ArxJDStepBar activeStep={activeStep} parsedJD={parsedJD} />
      </StyledHeader>
      <StyledContent>
        <ArxJDFormStepper
          parsedJD={parsedJD}
          setParsedJD={setParsedJD}
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          isUploading={isUploading}
          error={error}
          handleFileUpload={handleFileUpload}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </StyledContent>
    </StyledContainer>
  );
};
