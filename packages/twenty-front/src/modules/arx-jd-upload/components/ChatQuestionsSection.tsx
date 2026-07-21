import { Button } from 'twenty-ui';
import { IconMinus, IconPlus } from 'twenty-ui/icons';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { IconInfoCircle } from 'twenty-ui/icons';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { FindOneJob } from 'twenty-shared';

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

/** Empty arrays are truthy in JS — do not use `questions || fallback` or `[]` wins over defaults. */
const resolveChatQuestionsList = (
  flowQuestions: string[] | undefined,
  existingSnapshot: string[] | undefined,
): string[] => {
  if (flowQuestions !== undefined && flowQuestions.length > 0) {
    return flowQuestions;
  }
  if (existingSnapshot && existingSnapshot.length > 0) {
    return existingSnapshot;
  }
  return [...DEFAULT_CHAT_QUESTIONS];
};

export const ChatQuestionsSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [isLoading, setIsLoading] = useState(true);
  const parsedJDRef = useRef(parsedJD);
  const fetchedJobIdRef = useRef<string | null>(null);

  parsedJDRef.current = parsedJD;

  useEffect(() => {
    const fetchExistingQuestions = async () => {
      const jobId = parsedJDRef.current?.id;

      if (!jobId) {
        fetchedJobIdRef.current = null;
        setIsLoading(false);
        return;
      }

      if (fetchedJobIdRef.current === jobId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios({
          method: 'post',
          url: `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
          data: {
            operationName: 'FindOneJob',
            variables: {
              objectRecordId: jobId,
            },
            query: FindOneJob,
          },
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        });

        const questions = Array.isArray(response.data?.data?.job?.chatQuestions)
          ? response.data.data.job.chatQuestions
          : [];

        fetchedJobIdRef.current = jobId;

        const currentParsedJD = parsedJDRef.current;
        if (!currentParsedJD) {
          return;
        }

        if (questions.length > 0) {
          setParsedJD({
            ...currentParsedJD,
            existingChatQuestions: questions,
            chatFlow: {
              ...currentParsedJD.chatFlow,
              questions,
            },
          });
        } else {
          setParsedJD({
            ...currentParsedJD,
            existingChatQuestions: [],
            chatFlow: {
              ...currentParsedJD.chatFlow,
              questions: [...DEFAULT_CHAT_QUESTIONS],
            },
          });
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    fetchExistingQuestions();
  }, [parsedJD?.id, tokenPair?.accessToken?.token, setParsedJD]);

  if (parsedJD === null) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const isDuplicateQuestion = (
    questions: string[],
    value: string,
    currentIndex: number,
  ) => {
    return questions.some(
      (question, index) =>
        index !== currentIndex &&
        question.trim().toLowerCase() === value.trim().toLowerCase(),
    );
  };

  const displayQuestions = resolveChatQuestionsList(
    parsedJD.chatFlow?.questions,
    parsedJD.existingChatQuestions,
  );

  const handleChatQuestionAdd = () => {
    const newQuestion = '';

    if (isDuplicateQuestion(displayQuestions, newQuestion, -1)) {
      return;
    }

    setParsedJD({
      ...parsedJD,
      chatFlow: {
        ...parsedJD.chatFlow,
        questions: [...displayQuestions, newQuestion],
      },
    });
  };

  const handleChatQuestionRemove = (index: number) => {
    const updatedQuestions = displayQuestions.filter((_, i) => i !== index);

    setParsedJD({
      ...parsedJD,
      existingChatQuestions: updatedQuestions,
      chatFlow: {
        ...parsedJD.chatFlow,
        questions: updatedQuestions,
      },
    });
  };

  if (isLoading) {
    return <div>Loading questions...</div>;
  }

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
                const newValue = e.target.value;
                const questions = [...displayQuestions];

                if (isDuplicateQuestion(questions, newValue, index)) {
                  return;
                }

                questions[index] = newValue;

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
