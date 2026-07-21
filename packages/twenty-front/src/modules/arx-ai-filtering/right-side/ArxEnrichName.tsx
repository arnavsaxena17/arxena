import { enrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';

import { Button } from 'twenty-ui';

import { IconMaximize, IconMinus } from 'twenty-ui/icons';
import { useMemo } from 'react';
import { Enrichment } from '../arxEnrichmentModal';

const StyledArxEnrichNameContainer = styled.div<{ hasPrompt: boolean; isMinimized?: boolean }>`
  display: flex;
  justify-content: ${({ hasPrompt, isMinimized }) => {
    if (isMinimized) return 'space-between';
    return 'flex-end';
  }};
  width: 100%;
  align-items: ${({ isMinimized }) => isMinimized ? 'center' : 'flex-start'};
  gap: ${({ isMinimized }) => isMinimized ? '12px' : '8px'};
`;

const StyledButtonsContainer = styled.div<{ isMinimized?: boolean }>`
  display: flex;
  flex-direction: row;
  width: min-content;
  gap: ${({ isMinimized }) => isMinimized ? '4px' : '8px'};
`;

const StyledInput = styled.input<{ isMinimized?: boolean }>`
  align-items: flex-start;
  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
    font-size: ${({ theme, isMinimized }) => isMinimized ? theme.font.size.sm : theme.font.size.lg};
    font-weight: ${({ theme }) => theme.font.weight.medium};
    font-family: ${({ theme }) => theme.font.family};
  }
  &:focus {
    outline: none;
  }
  display: flex;
  flex-grow: ${({ isMinimized }) => isMinimized ? '0' : '0'};
  border: none;
  height: auto;
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme, isMinimized }) => isMinimized ? theme.font.size.sm : theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  max-width: ${({ isMinimized }) => isMinimized ? '200px' : '300px'};
  min-width: ${({ isMinimized }) => isMinimized ? 'auto' : '200px'};
`;

const StyledValidationMessage = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.red};
  white-space: nowrap;
`;

const StyledTopValidationMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: 0.5rem;
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: 1rem;
`;
export const ArxEnrichModalCloseButton = ({ closeModal, isMinimized }: { closeModal: () => void; isMinimized?: boolean }) => {
  return <Button variant="secondary" accent="danger" size={isMinimized ? "small" : "small"} onClick={closeModal} justify="flex-end" title="Close" type="submit" />;
};

export const ArxEnrichModalMinimizeButton = ({ 
  isMinimized, 
  onToggleMinimize 
}: { 
  isMinimized: boolean;
  onToggleMinimize: () => void;
}) => {
  return (
    <Button 
      variant="secondary" 
      accent="default" 
      size="small" 
      onClick={onToggleMinimize} 
      justify="flex-end" 
      title={isMinimized ? "Maximize" : "Minimize"} 
      type="button"
    >
      {isMinimized ? <IconMaximize size={16} /> : <IconMinus size={16} />}
    </Button>
  );
};
export const ArxEnrichCreateButton = ({ 
  onClick,
  enrichment,
  disabled,
  isMinimized
}: { 
  onClick?: (event: React.FormEvent<HTMLFormElement>) => void;
  enrichment: Enrichment;
  disabled: boolean;
  isMinimized?: boolean;
}) => {
  if (isMinimized) {
    return null; // Don't show create button when minimized
  }
  
  return (
    <div style={{ position: 'relative' }}>
      <Button 
        variant="primary" 
        accent="blue" 
        size="small" 
        justify="center" 
        title={'Create AI Filter'} 
        type="submit"
        disabled={disabled}
      />
      {disabled && (
        <StyledValidationMessage>
          Please fill all required fields
        </StyledValidationMessage>
      )}
    </div>
  );
};

interface ArxEnrichNameProps {
  closeModal: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  index: number; // Add this
  onError: (error: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export const validateModelName = (name: string) => {
  if (!name) return 'Model name is required';
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    return 'Model name must start with a capital letter and contain only letters and numbers';
  }
  return '';
};

export const ArxEnrichName: React.FC<ArxEnrichNameProps> = ({
  closeModal,
  // modelName,
  // setModelName,
  onSubmit,
  index,
  onError, // Add this prop
  isMinimized = false,
  onToggleMinimize,

}) => {
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const currentEnrichment = enrichments[index];
  const isFormValid = useMemo(() => {
    if (!currentEnrichment) return false;
    console.log("This is current currentEnrichment", currentEnrichment)
    const isFormValidValue = Boolean(
      currentEnrichment.modelName &&
      currentEnrichment.prompt &&
      (currentEnrichment.selectedModel || currentEnrichment.selectedModel=="") &&
      currentEnrichment.selectedMetadataFields.length > 0 &&
      currentEnrichment.fields.length > 0
    );
    console.log("isFormValidValueisFiformValidValue:", isFormValidValue)
    if (isFormValidValue) {
      onError(''); // Clear previous errors
    }
    return isFormValidValue
  }, [currentEnrichment]);

  const handleModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newModelName = e.target.value;
    const validationError = validateModelName(newModelName);
    if (validationError) {
      onError(validationError);
    } else {
      onError('');
      setEnrichments(prev => {
      const newEnrichments = prev.map((enrichment, idx) => {
        if (idx === index) {
          return {
            ...enrichment,
            modelName: newModelName,
          };
        }
        return enrichment;
      });
      return newEnrichments;
    });
  };
}

  return (
    <>
      <StyledArxEnrichNameContainer hasPrompt={currentEnrichment?.prompt !== ''} isMinimized={isMinimized}>
      {currentEnrichment?.prompt !== '' && (
        <StyledInput 
          type="text" 
          placeholder="Model Name..." 
          name="ModelName[]" 
          value={currentEnrichment?.modelName || ''} 
          onChange={handleModelNameChange} 
          required 
          isMinimized={isMinimized}
        />
        )}
        <StyledButtonsContainer isMinimized={isMinimized}>
          {onToggleMinimize && (
            <ArxEnrichModalMinimizeButton 
              isMinimized={isMinimized} 
              onToggleMinimize={onToggleMinimize} 
            />
          )}
          <ArxEnrichModalCloseButton closeModal={closeModal} isMinimized={isMinimized} />
          {currentEnrichment?.prompt !== '' && (
            <ArxEnrichCreateButton 
              onClick={onSubmit} 
              enrichment={currentEnrichment}
              disabled={!isFormValid}
              isMinimized={isMinimized}
            />
          )}
        </StyledButtonsContainer>
      </StyledArxEnrichNameContainer>
    </>
  );
};
