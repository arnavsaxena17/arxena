import { IconTrash } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables, useTheme } from 'twenty-ui/theme-constants';

const StyledInputArea = styled.input`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  line-height: 16px;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[3]};
  resize: none;
  width: 100%;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
    font-weight: ${themeCssVariables.font.weight.regular};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.tertiary};
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
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
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
