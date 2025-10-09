import styled from '@emotion/styled';
import { IconSend } from 'twenty-ui';

const StyledChatInput = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(12)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledInput = styled.input`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.color.blue50};
  }
  
  &:disabled {
    background-color: ${({ theme }) => theme.color.gray20};
    cursor: not-allowed;
  }
`;

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
};

export const ChatInput = ({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = "Refine your search...",
  disabled = false 
}: ChatInputProps) => {
  return (
    <StyledChatInput>
      <StyledInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyPress={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            onSubmit(e);
          }
        }}
      />
      <StyledButton
        onClick={onSubmit}
        disabled={!value.trim() || disabled}
      >
        <IconSend size={16} />
      </StyledButton>
    </StyledChatInput>
  );
};
