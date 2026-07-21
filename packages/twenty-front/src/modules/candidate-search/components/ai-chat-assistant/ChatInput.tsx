import { IconSend } from 'twenty-ui/icons';
import styled from '@emotion/styled';
import { FocusEventHandler, useEffect, useRef, useState } from 'react';
import { Key } from 'ts-key-enum';

import { InputHotkeyScope } from '@/ui/input/types/InputHotkeyScope';
import { usePreviousHotkeyScope } from '@/ui/utilities/hotkey/hooks/usePreviousHotkeyScope';
import { useScopedHotkeys } from '@/ui/utilities/hotkey/hooks/useScopedHotkeys';
import { isDefined } from 'twenty-shared';

const StyledChatInput = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  flex-shrink: 0;
`;

const StyledTextarea = styled.textarea`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  height: 30px;
  resize: none;
  font-family: inherit;
  line-height: 1.4;
  overflow-y: auto;
  
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
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    goBackToPreviousHotkeyScope,
    setHotkeyScopeAndMemorizePreviousScope,
  } = usePreviousHotkeyScope();

  const handleFocus: FocusEventHandler<HTMLTextAreaElement> = (e) => {
    setIsFocused(true);
    setHotkeyScopeAndMemorizePreviousScope(InputHotkeyScope.TextInput);
  };

  const handleBlur: FocusEventHandler<HTMLTextAreaElement> = (e) => {
    setIsFocused(false);
    goBackToPreviousHotkeyScope();
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 60)}px`;
    }
  }, [value]);

  useScopedHotkeys(
    [Key.Escape],
    () => {
      if (!isFocused) {
        return;
      }

      if (isDefined(textareaRef) && 'current' in textareaRef) {
        textareaRef.current?.blur();
        setIsFocused(false);
      }
    },
    InputHotkeyScope.TextInput,
    [textareaRef, isFocused],
    {
      preventDefault: false,
    },
  );

  useScopedHotkeys(
    [Key.Enter],
    () => {
      if (!isFocused) {
        return;
      }
      onSubmit(new Event('submit') as unknown as React.FormEvent);

      if (isDefined(textareaRef) && 'current' in textareaRef) {
        setIsFocused(false);
      }
    },
    InputHotkeyScope.TextInput,
    [textareaRef, isFocused, onSubmit],
    {
      preventDefault: false,
    },
  );

  return (
    <StyledChatInput>
      <StyledTextarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
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
