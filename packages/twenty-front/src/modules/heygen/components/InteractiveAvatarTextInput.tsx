import styled from '@emotion/styled';
import { Loader } from '@ui/feedback';
import { Button, IconSend } from 'twenty-ui';
import { TextInput } from '../../ui/input/components/TextInput';

type InteractiveAvatarTextInputProps = {
  label: string;
  placeholder: string;
  input: string;
  onSubmit: () => void;
  setInput: (value: string) => void;
  endContent?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
};

const StyledInputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const StyledEndContentContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100%;
  position: absolute;
  right: ${({ theme }) => theme.spacing(2)};
  top: 50%;
  transform: translateY(-50%);
`;

const StyledSendButton = styled(Button)`
  padding: 0;
  min-width: unset;
  background: none;

  &:hover {
    background: none;
  }
`;

export const InteractiveAvatarTextInput = ({
  label,
  placeholder,
  input,
  onSubmit,
  setInput,
  endContent,
  disabled = false,
  loading = false,
}: InteractiveAvatarTextInputProps) => {
  const handleSubmit = () => {
    if (input.trim() === '') {
      return;
    }
    onSubmit();
    setInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <StyledInputContainer>
      <TextInput
        label={label}
        placeholder={placeholder}
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        fullWidth
      />
      <StyledEndContentContainer>
        {endContent}
        {loading ? (
          <Loader color="gray" />
        ) : (
          <StyledSendButton
            onClick={handleSubmit}
            disabled={disabled}
            title="Send message"
          >
            <IconSend size={24} />
          </StyledSendButton>
        )}
      </StyledEndContentContainer>
    </StyledInputContainer>
  );
};
