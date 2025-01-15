import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { IconTrash } from 'twenty-ui';

const StyledInputArea = styled.input`
  background-color: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.primary};
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  line-height: 16px;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(2)};
  padding-top: ${({ theme }) => theme.spacing(3)};
  resize: none;
  width: 100%;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
    font-weight: ${({ theme }) => theme.font.weight.regular};
  }

  &:disabled {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  flex-grow: 1;
  justify-content: center;
  align-items: center;
`;

const StyledTrashIconContainer = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  justify-content: center;
`;

export const InstructionsTextArea = ({
  id,
  deleteInstruction,
  instructionNumber,
}: {
  id: string;
  deleteInstruction: (id: string) => void;
  instructionNumber: number;
}) => {
  const thisInstructionId = id;

  const theme = useTheme();

  const deleteIns = () => {
    deleteInstruction(thisInstructionId);
  };

  const name = `newVideoInterviewTemplate[0][instructions][${instructionNumber}]`;

  return (
    <StyledContainer>
      <StyledInputArea
        placeholder={'Start Typing...'}
        type={'text'}
        name={name}
      />
      <StyledTrashIconContainer>
        <IconTrash
          onClick={deleteIns}
          size={theme.icon.size.sm}
          style={{ cursor: 'pointer' }}
        />
      </StyledTrashIconContainer>
    </StyledContainer>
  );
};
