import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';
import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';

import { Button } from '@/ui/input/button/components/Button';

import { useMemo } from 'react';
import { Enrichment } from '../arxEnrichmentModal';


const StyledArxEnrichNameContainer = styled.div`
  display: flex;
`;

const StyledButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: min-content;
  gap: 8px;
`;

const StyledInput = styled.input`
  align-items: flex-start;
  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
    font-size: ${({ theme }) => theme.font.size.lg};
    font-weight: ${({ theme }) => theme.font.weight.medium};
    font-family: ${({ theme }) => theme.font.family};
  }
  &:focus {
    outline: none;
  }
  display: flex;
  flex-grow: 1;
  border: none;
  height: auto;
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
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



export const ArxEnrichModalCloseButton = ({ closeModal }: { closeModal: () => void }) => {
  return <Button variant="secondary" accent="danger" size="small" onClick={closeModal} justify="center" title="Close" type="submit" />;
};



export const ArxEnrichCreateButton = ({ 
  onClick,
  enrichment,
  disabled 
}: { 
  onClick?: (event: React.FormEvent<HTMLFormElement>) => void;
  enrichment: Enrichment;
  disabled: boolean;
}) => {
  return (
    <div style={{ position: 'relative' }}>
      <Button 
        variant="primary" 
        accent="blue" 
        size="small" 
        justify="center" 
        title={'Create Enrichment'} 
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
      <StyledArxEnrichNameContainer>
        <StyledInput 
          type="text" 
          placeholder="Model Name..." 
          name="ModelName[]" 
          value={currentEnrichment?.modelName || ''} 
          onChange={handleModelNameChange} 
          required 
        />
        <StyledButtonsContainer>
          <ArxEnrichModalCloseButton closeModal={closeModal} />
          <ArxEnrichCreateButton 
            onClick={onSubmit} 
            enrichment={currentEnrichment}
            disabled={!isFormValid}
          />
        </StyledButtonsContainer>
      </StyledArxEnrichNameContainer>
    </>
  );
};
