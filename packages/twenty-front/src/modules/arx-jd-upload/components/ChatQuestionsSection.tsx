import React from 'react';
import { Button, IconMinus, IconPlus } from 'twenty-ui';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledInput,
  StyledSection,
  StyledSectionContent,
  StyledSectionHeader,
} from './ArxJDUploadModal.styled';

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
      <StyledSectionHeader>Chat Questions</StyledSectionHeader>
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
