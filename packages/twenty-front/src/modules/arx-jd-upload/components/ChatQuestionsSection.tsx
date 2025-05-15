import styled from '@emotion/styled';
import { IconInfoCircle } from '@tabler/icons-react';
import React from 'react';
import { Button, IconMinus, IconPlus } from 'twenty-ui';
import { FormComponentProps } from '../types/FormComponentProps';
import {
    StyledInput,
    StyledSection,
    StyledSectionContent,
    StyledSectionHeader,
} from './ArxJDUploadModal.styled';

const StyledHeaderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledIconContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: help;
  margin-top: -10px;

  &:hover::after {
    content: 'These questions will be asked to candidates during the initial chat. You can customize them based on your specific requirements.';
    position: absolute;
    top: -10px;
    left: 24px;
    transform: translateY(-100%);
    background-color: ${({ theme }) => theme.background.primary};
    color: ${({ theme }) => theme.font.color.primary};
    padding: ${({ theme }) => theme.spacing(2)};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    box-shadow: ${({ theme }) => theme.boxShadow.light};
    width: max-content;
    max-width: 250px;
    z-index: 1000;
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;

const DEFAULT_CHAT_QUESTIONS = [
  'What is your current and expected CTC?',
  'Who do you report to, which functions report to you?',
];

export const ChatQuestionsSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  // Prevent hotkey propagation when typing in inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleChatQuestionAdd = () => {
    const currentQuestions = parsedJD.chatFlow?.questions?.length
      ? [...parsedJD.chatFlow.questions]
      : [...DEFAULT_CHAT_QUESTIONS];

    setParsedJD({
      ...parsedJD,
      chatFlow: {
        ...parsedJD.chatFlow,
        questions: [...currentQuestions, ''],
      },
    });
  };

  const handleChatQuestionRemove = (index: number) => {
    const currentQuestions = parsedJD.chatFlow?.questions?.length
      ? [...parsedJD.chatFlow.questions]
      : [...DEFAULT_CHAT_QUESTIONS];

    setParsedJD({
      ...parsedJD,
      chatFlow: {
        ...parsedJD.chatFlow,
        questions: currentQuestions.filter((_, i) => i !== index),
      },
    });
  };

  const displayQuestions = parsedJD.chatFlow?.questions?.length
    ? parsedJD.chatFlow.questions
    : DEFAULT_CHAT_QUESTIONS;

  return (
    <StyledSection>
      <StyledHeaderContainer>
        <StyledSectionHeader>Chat Questions</StyledSectionHeader>
        <StyledIconContainer>
          <IconInfoCircle size={14} />
        </StyledIconContainer>
      </StyledHeaderContainer>
      <StyledSectionContent>
        {displayQuestions.map((question, index) => (
          <div
            key={index}
            style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}
          >
            <StyledInput
              value={question}
              onChange={(e) => {
                const questions = [...displayQuestions];
                questions[index] = e.target.value;

                setParsedJD({
                  ...parsedJD,
                  chatFlow: {
                    ...parsedJD.chatFlow,
                    questions,
                  },
                });
              }}
              placeholder="Enter question"
              onKeyDown={handleKeyDown}
            />
            <Button
              variant="secondary"
              title="Remove"
              Icon={IconMinus}
              onClick={() => handleChatQuestionRemove(index)}
            />
          </div>
        ))}
        <Button
          variant="secondary"
          title="Add Question"
          Icon={IconPlus}
          onClick={handleChatQuestionAdd}
        >
          Add Question
        </Button>
      </StyledSectionContent>
    </StyledSection>
  );
};
