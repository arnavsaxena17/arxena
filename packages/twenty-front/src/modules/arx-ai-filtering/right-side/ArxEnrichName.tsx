import { enrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { hasAiFilterContext } from '@/arx-ai-filtering/utils/resumeMetadata';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { styled } from '@linaria/react';
import { useMemo } from 'react';
import { Button } from 'twenty-ui/input';
import { IconMaximize, IconMinus } from 'twenty-ui/icon';
import type { Enrichment } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledArxEnrichNameContainer = styled.div<{
  hasPrompt: boolean;
  isMinimized?: boolean;
}>`
  display: flex;
  justify-content: ${({ hasPrompt, isMinimized }) => {
    if (isMinimized) return 'space-between';
    return 'flex-end';
  }};
  width: 100%;
  align-items: ${({ isMinimized }) => (isMinimized ? 'center' : 'flex-start')};
  gap: ${({ isMinimized }) => (isMinimized ? '12px' : '8px')};
`;

const StyledButtonsContainer = styled.div<{ isMinimized?: boolean }>`
  display: flex;
  flex-direction: row;
  width: min-content;
  gap: ${({ isMinimized }) => (isMinimized ? '4px' : '8px')};
`;

const StyledInput = styled.input<{ isMinimized?: boolean }>`
  align-items: flex-start;
  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
    font-size: ${({ isMinimized }) =>
      isMinimized
        ? themeCssVariables.font.size.sm
        : themeCssVariables.font.size.lg};
    font-weight: ${themeCssVariables.font.weight.medium};
    font-family: ${themeCssVariables.font.family};
  }
  &:focus {
    outline: none;
  }
  display: flex;
  flex-grow: ${({ isMinimized }) => (isMinimized ? '0' : '0')};
  border: none;
  height: auto;
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${({ isMinimized }) =>
    isMinimized
      ? themeCssVariables.font.size.sm
      : themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  max-width: ${({ isMinimized }) => (isMinimized ? '200px' : '300px')};
  min-width: ${({ isMinimized }) => (isMinimized ? 'auto' : '200px')};
`;

const StyledValidationMessage = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.color.red};
  white-space: nowrap;
`;

export const ArxEnrichModalCloseButton = ({
  closeModal,
  isMinimized,
}: {
  closeModal: () => void;
  isMinimized?: boolean;
}) => {
  return (
    <Button
      variant="secondary"
      accent="danger"
      size={isMinimized ? 'small' : 'small'}
      onClick={closeModal}
      justify="flex-end"
      title="Close"
      type="submit"
    />
  );
};

export const ArxEnrichModalMinimizeButton = ({
  isMinimized,
  onToggleMinimize,
}: {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}) => {
  return (
    <Button
      Icon={isMinimized ? IconMaximize : IconMinus}
      variant="secondary"
      accent="default"
      size="small"
      onClick={onToggleMinimize}
      justify="flex-end"
      title={isMinimized ? 'Maximize' : 'Minimize'}
      type="button"
    />
  );
};

export const ArxEnrichCreateButton = ({
  onClick,
  enrichment,
  disabled,
  isMinimized,
}: {
  onClick?: (event: React.FormEvent<HTMLFormElement>) => void;
  enrichment: Enrichment;
  disabled: boolean;
  isMinimized?: boolean;
}) => {
  if (isMinimized) {
    return null;
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

type ArxEnrichNameProps = {
  closeModal: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  index: number;
  onError: (error: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
};

export const validateModelName = (name: string) => {
  if (!name) return 'Model name is required';
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    return 'Model name must start with a capital letter and contain only letters and numbers';
  }
  return '';
};

export const ArxEnrichName: React.FC<ArxEnrichNameProps> = ({
  closeModal,
  onSubmit,
  index,
  onError,
  isMinimized = false,
  onToggleMinimize,
}) => {
  const [enrichments, setEnrichments] = useAtomState(enrichmentsState);
  const currentEnrichment = enrichments[index];
  const isFormValid = useMemo(() => {
    if (!currentEnrichment) return false;
    console.log('This is current currentEnrichment', currentEnrichment);
    const isFormValidValue = Boolean(
      currentEnrichment.modelName &&
        currentEnrichment.prompt &&
        (currentEnrichment.selectedModel ||
          currentEnrichment.selectedModel == '') &&
        hasAiFilterContext(currentEnrichment) &&
        currentEnrichment.fields.length > 0,
    );
    console.log('isFormValidValueisFiformValidValue:', isFormValidValue);
    if (isFormValidValue) {
      onError('');
    }
    return isFormValidValue;
  }, [currentEnrichment, onError]);

  const handleModelNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newModelName = event.target.value;
    const validationError = validateModelName(newModelName);
    if (validationError) {
      onError(validationError);
    } else {
      onError('');
      setEnrichments((previousEnrichments) => {
        const newEnrichments = previousEnrichments.map((enrichment, enrichmentIndex) => {
          if (enrichmentIndex === index) {
            return {
              ...enrichment,
              modelName: newModelName,
            };
          }
          return enrichment;
        });
        return newEnrichments;
      });
    }
  };

  return (
    <>
      <StyledArxEnrichNameContainer
        hasPrompt={currentEnrichment?.prompt !== ''}
        isMinimized={isMinimized}
      >
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
          <ArxEnrichModalCloseButton
            closeModal={closeModal}
            isMinimized={isMinimized}
          />
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
