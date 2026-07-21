import { type EmailSequence } from '@/drip-campaign/states/dripCampaignModalOpenState';
import styled from '@emotion/styled';
import { IconEdit, IconX } from 'twenty-ui/icons';
import { useEffect, useState } from 'react';

const StyledEditor = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw;
  max-width: 800px;
  height: 80vh;
  max-height: 600px;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  z-index: 2000;
  display: flex;
  flex-direction: column;
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const StyledTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const StyledButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid ${({ theme, variant }) => 
    variant === 'primary' ? theme.color.blue60 : theme.border.color.medium};
  background-color: ${({ theme, variant }) => 
    variant === 'primary' ? theme.color.blue60 : theme.background.primary};
  color: ${({ theme, variant }) => 
    variant === 'primary' ? theme.font.color.inverted : theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledContent = styled.div`
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const StyledFormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledInput = styled.input`
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 8px;
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue60};
  }
`;

const StyledTextarea = styled.textarea`
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 8px;
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  transition: border-color 0.2s ease;
  min-height: 120px;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue60};
  }
`;

const StyledDelayContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
`;

const StyledDelayGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StyledDelayInput = styled.input`
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 8px;
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  text-align: center;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue60};
  }
`;

const StyledCheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledCheckbox = styled.input`
  width: 16px;
  height: 16px;
  accent-color: ${({ theme }) => theme.color.blue60};
`;

const StyledOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1999;
`;

interface EmailSequenceEditorProps {
  sequence: EmailSequence;
  onUpdate: (sequence: EmailSequence) => void;
  onClose: () => void;
}

export const EmailSequenceEditor: React.FC<EmailSequenceEditorProps> = ({
  sequence,
  onUpdate,
  onClose
}) => {
  const [formData, setFormData] = useState<EmailSequence>(sequence);

  useEffect(() => {
    setFormData(sequence);
  }, [sequence]);

  const handleInputChange = (field: keyof EmailSequence, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onUpdate(formData);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <>
      <StyledOverlay onClick={onClose} />
      <StyledEditor onKeyDown={handleKeyDown}>
        <StyledHeader>
          <StyledTitle>
            <IconEdit size={20} />
            Edit Email Sequence
          </StyledTitle>
          <StyledButtonGroup>
            <StyledButton variant="primary" onClick={handleSave}>
              💾 Save
            </StyledButton>
            <StyledCloseButton onClick={onClose}>
              <IconX size={16} />
            </StyledCloseButton>
          </StyledButtonGroup>
        </StyledHeader>

        <StyledContent>
          <StyledFormGroup>
            <StyledLabel>Sequence Name</StyledLabel>
            <StyledInput
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter sequence name"
            />
          </StyledFormGroup>

          <StyledFormGroup>
            <StyledLabel>Email Subject</StyledLabel>
            <StyledInput
              type="text"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              placeholder="Enter email subject"
            />
          </StyledFormGroup>

          <StyledFormGroup>
            <StyledLabel>Email Content</StyledLabel>
            <StyledTextarea
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="Enter email content (HTML supported)"
            />
          </StyledFormGroup>

          <StyledFormGroup>
            <StyledLabel>Send Delay</StyledLabel>
            <StyledDelayContainer>
              <StyledDelayGroup>
                <StyledLabel>Days</StyledLabel>
                <StyledDelayInput
                  type="number"
                  min="0"
                  value={formData.delayDays}
                  onChange={(e) => handleInputChange('delayDays', parseInt(e.target.value) || 0)}
                />
              </StyledDelayGroup>
              <StyledDelayGroup>
                <StyledLabel>Hours</StyledLabel>
                <StyledDelayInput
                  type="number"
                  min="0"
                  max="23"
                  value={formData.delayHours}
                  onChange={(e) => handleInputChange('delayHours', parseInt(e.target.value) || 0)}
                />
              </StyledDelayGroup>
              <StyledDelayGroup>
                <StyledLabel>Minutes</StyledLabel>
                <StyledDelayInput
                  type="number"
                  min="0"
                  max="59"
                  value={formData.delayMinutes}
                  onChange={(e) => handleInputChange('delayMinutes', parseInt(e.target.value) || 0)}
                />
              </StyledDelayGroup>
            </StyledDelayContainer>
          </StyledFormGroup>

          <StyledFormGroup>
            <StyledCheckboxContainer>
              <StyledCheckbox
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
              />
              <StyledLabel>Active</StyledLabel>
            </StyledCheckboxContainer>
          </StyledFormGroup>
        </StyledContent>
      </StyledEditor>
    </>
  );
};
