import React from 'react';
import { Button, IconMinus, IconPlus } from 'twenty-ui';
import { FormComponentProps } from '../types/FormComponentProps';
import {
  StyledInput,
  StyledLabel,
  StyledSection,
  StyledSectionContent,
  StyledSectionHeader,
} from './ArxJDUploadModal.styled';

const DEFAULT_VIDEO_QUESTIONS = [
  'Please tell us about yourself',
  'Why are you interested in working with us?',
];

export const VideoQuestionsSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  // Prevent hotkey propagation when typing in inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleVideoQuestionAdd = () => {
    const currentQuestions = parsedJD.videoInterview?.questions?.length
      ? [...parsedJD.videoInterview.questions]
      : [...DEFAULT_VIDEO_QUESTIONS];

    setParsedJD({
      ...parsedJD,
      videoInterview: {
        ...parsedJD.videoInterview,
        questions: [...currentQuestions, ''],
      },
    });
  };

  const handleVideoQuestionRemove = (index: number) => {
    const currentQuestions = parsedJD.videoInterview?.questions?.length
      ? [...parsedJD.videoInterview.questions]
      : [...DEFAULT_VIDEO_QUESTIONS];

    setParsedJD({
      ...parsedJD,
      videoInterview: {
        ...parsedJD.videoInterview,
        questions: currentQuestions.filter((_, i) => i !== index),
      },
    });
  };

  const displayQuestions = parsedJD.videoInterview?.questions?.length
    ? parsedJD.videoInterview.questions
    : DEFAULT_VIDEO_QUESTIONS;

  return (
    <StyledSection>
      <StyledSectionHeader>Video Interview</StyledSectionHeader>
      <StyledSectionContent>
        <StyledLabel>Video Interview Questions</StyledLabel>
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
                  videoInterview: {
                    ...parsedJD.videoInterview,
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
              onClick={() => handleVideoQuestionRemove(index)}
            />
          </div>
        ))}
        <Button
          variant="secondary"
          title="Add Question"
          Icon={IconPlus}
          onClick={handleVideoQuestionAdd}
        >
          Add Question
        </Button>
      </StyledSectionContent>
    </StyledSection>
  );
};
