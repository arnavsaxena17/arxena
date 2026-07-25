import { Button } from 'twenty-ui/input';
import { IconMinus, IconPlus } from 'twenty-ui/icon';
import React from 'react';

import { FormComponentProps } from '../types/FormComponentProps';
import { ParsedJD } from '../types/ParsedJD';
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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  if (!parsedJD) {
    return null;
  }

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
    } as ParsedJD);
  };

  const handleVideoQuestionRemove = (index: number) => {
    const currentQuestions = parsedJD.videoInterview?.questions?.length
      ? [...parsedJD.videoInterview.questions]
      : [...DEFAULT_VIDEO_QUESTIONS];

    setParsedJD({
      ...parsedJD,
      videoInterview: {
        ...parsedJD.videoInterview,
        questions: currentQuestions.filter((_, questionIndex) => questionIndex !== index),
      },
    } as ParsedJD);
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
              onChange={(event) => {
                const questions = [...displayQuestions];
                questions[index] = event.target.value;

                setParsedJD({
                  ...parsedJD,
                  videoInterview: {
                    ...parsedJD.videoInterview,
                    questions,
                  },
                } as ParsedJD);
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
        />
      </StyledSectionContent>
    </StyledSection>
  );
};
