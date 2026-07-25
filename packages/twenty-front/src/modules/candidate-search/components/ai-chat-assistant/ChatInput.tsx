import { IconSend } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useEffect, useRef } from 'react';

const StyledChatInput = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
  flex-shrink: 0;
`;

const StyledTextarea = styled.textarea`
  flex: 1;
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  height: 30px;
  resize: none;
  font-family: inherit;
  line-height: 1.4;
  overflow-y: auto;

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
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
  background-color: ${themeCssVariables.color.blue};
  color: ${themeCssVariables.font.color.inverted};
  cursor: pointer;

  &:hover {
    background-color: ${themeCssVariables.color.blue5};
  }

  &:disabled {
    background-color: ${themeCssVariables.color.gray2};
    cursor: not-allowed;
  }
`;

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
};

export const ChatInput = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Refine your search...',
  disabled = false,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 60)}px`;
    }
  }, [value]);

  return (
    <StyledChatInput>
      <StyledTextarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit(event);
          }
          if (event.key === 'Escape') {
            event.currentTarget.blur();
          }
        }}
      />
      <StyledButton onClick={onSubmit} disabled={!value.trim() || disabled}>
        <IconSend size={16} />
      </StyledButton>
    </StyledChatInput>
  );
};
