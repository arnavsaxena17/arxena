import { useState } from 'react';
import styled from '@emotion/styled';
import { v4 as uid } from 'uuid';

import { InstructionsTextArea } from '@/arx-enrich/right-side/components/introduction/instructions/InstructionsTextArea';
import { Instruction } from '@/arx-enrich/right-side/components/introduction/instructions/types/instruction';
import { H2Title } from '@/ui/display/typography/components/H2Title';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  font-family: inherit;
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  height: min-content;
`;

const StyledInstructionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 8px;
  padding: 0 0 0 16px;
  margin: 0px;
`;

const StyledListItem = styled.li`
  &::marker {
    font-family: inherit;
    color: ${({ theme }) => theme.font.color.light};
    font-size: ${({ theme }) => theme.font.size.md};
    font-weight: ${({ theme }) => theme.font.weight.regular};
  }
`;

const StyledButton = styled.div`
  border: none;
  font-family: inherit;
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  cursor: pointer;
  background-color: none;
  margin-top: 16px;
`;

export const Instructions = () => {
  const [instructionsArr, setInstructionsArr] = useState<Instruction[]>([]);

  const addInstruction = () => {
    const newId = uid();
    const newInstruction: Instruction = {
      id: newId,
      element: (instructionNumber) => (
        <InstructionsTextArea
          id={newId}
          deleteInstruction={deleteInstruction}
          instructionNumber={instructionNumber}
        />
      ),
    };
    setInstructionsArr((previousInstruction) => [
      ...previousInstruction,
      newInstruction,
    ]);
  };

  const deleteInstruction = (id: string) => {
    setInstructionsArr((prevInstructions) =>
      prevInstructions.filter((instruction) => instruction.id !== id),
    );
  };

  return (
    <StyledContainer>
      <H2Title title={'Instructions'} />
      {instructionsArr.length === 0 ? (
        <StyledContainer>No Instructions Added</StyledContainer>
      ) : (
        <StyledInstructionsContainer type="1">
          {instructionsArr.map((instruction, index) => (
            <StyledListItem key={instruction.id}>
              {instruction.element(index)}
            </StyledListItem>
          ))}
        </StyledInstructionsContainer>
      )}
      <StyledButton onClick={addInstruction}>
        {'+ Add Instruction'}
      </StyledButton>
    </StyledContainer>
  );
};
