import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { IconInfoCircle } from '@tabler/icons-react';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { graphqlMutationToDeleteManyCandidateFields, graphqlQueryToFindManyCandidateFields } from 'twenty-shared';
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

/** Empty arrays are truthy in JS — do not use `questions || fallback` or `[]` wins over defaults. */
const resolveChatQuestionsList = (
  flowQuestions: string[] | undefined,
  existing: string[],
): string[] => {
  if (flowQuestions !== undefined && flowQuestions.length > 0) {
    return flowQuestions;
  }
  if (existing.length > 0) {
    return existing;
  }
  return [...DEFAULT_CHAT_QUESTIONS];
};

export const ChatQuestionsSection: React.FC<FormComponentProps> = ({
  parsedJD,
  setParsedJD,
}) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [existingQuestions, setExistingQuestions] = useState<string[]>([]);
  const [questionFieldIds, setQuestionFieldIds] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExistingQuestions = async () => {
      if (!parsedJD?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios({
          method: 'post',
          url: `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
          data: {
            operationName: 'FindManyCandidateFields',
            variables: {
              filter: { jobsId: { in: [parsedJD.id] } },
              orderBy: [{ position: 'AscNullsFirst' }],
            },
            query: graphqlQueryToFindManyCandidateFields,
          },
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, },
        });

        const questions = response.data?.data?.candidateFields?.edges?.map(
          (edge: any) => edge.node.name
        ) || [];

        // Store question IDs for deletion later
        const fieldIds: Record<string, string> = {};
        response.data?.data?.candidateFields?.edges?.forEach((edge: any) => {
          fieldIds[edge.node.name] = edge.node.id;
        });
        setQuestionFieldIds(fieldIds);

        if (questions.length > 0) {
          setExistingQuestions(questions);
          setParsedJD({
            ...parsedJD,
            existingChatQuestions: questions,
            chatFlow: {
              ...parsedJD.chatFlow,
              questions: questions,
            },
          });
        } else {
          setExistingQuestions(DEFAULT_CHAT_QUESTIONS);
          setParsedJD({
            ...parsedJD,
            existingChatQuestions: DEFAULT_CHAT_QUESTIONS,
            chatFlow: {
              ...parsedJD.chatFlow,
              questions: DEFAULT_CHAT_QUESTIONS,
            },
          });
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
        setExistingQuestions(DEFAULT_CHAT_QUESTIONS);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExistingQuestions();
  }, [parsedJD?.id, tokenPair?.accessToken?.token]);

  if (parsedJD === null) {
    return null;
  }

  // Prevent hotkey propagation when typing in inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleChatQuestionAdd = () => {
    const currentQuestions = resolveChatQuestionsList(
      parsedJD.chatFlow?.questions,
      existingQuestions,
    );
    const newQuestion = '';
    
    // Only add if it's not a duplicate
    if (!isDuplicateQuestion(currentQuestions, newQuestion, -1)) {
      const updatedQuestions = [...currentQuestions, newQuestion];
      const updatedExistingQuestions = [...existingQuestions, newQuestion];
      
      setParsedJD({
        ...parsedJD,
        existingChatQuestions: updatedExistingQuestions,
        chatFlow: {
          ...parsedJD.chatFlow,
          questions: updatedQuestions,
        },
      });
    }
  };

  const isDuplicateQuestion = (questions: string[], value: string, currentIndex: number) => {
    return questions.some((q, idx) => idx !== currentIndex && q.trim().toLowerCase() === value.trim().toLowerCase());
  };

  const handleChatQuestionRemove = async (index: number) => {
    const currentQuestions = resolveChatQuestionsList(
      parsedJD.chatFlow?.questions,
      existingQuestions,
    );
    const questionToRemove = currentQuestions[index];
    const questionId = questionFieldIds[questionToRemove];

    // If the question exists in the database, delete it
    if (questionId && parsedJD?.id) {
      try {
        await axios({
          method: 'post',
          url: `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
          data: {
            operationName: 'DeleteManyCandidateFields',
            variables: {
              filter: { id: { in: [questionId] } },
            },
            query: graphqlMutationToDeleteManyCandidateFields,
          },
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, },
        });

        // Remove the question ID from our local state
        const updatedQuestionFieldIds = { ...questionFieldIds };
        delete updatedQuestionFieldIds[questionToRemove];
        setQuestionFieldIds(updatedQuestionFieldIds);
      } catch (error) {
        console.error('Error deleting question:', error);
      }
    }

    // Update the UI state
    const updatedQuestions = currentQuestions.filter((_, i) => i !== index);
    const updatedExistingQuestions = existingQuestions.filter((_, i) => i !== index);
    
    setParsedJD({
      ...parsedJD,
      existingChatQuestions: updatedExistingQuestions,
      chatFlow: {
        ...parsedJD.chatFlow,
        questions: updatedQuestions,
      },
    });
  };

  const displayQuestions = resolveChatQuestionsList(
    parsedJD.chatFlow?.questions,
    existingQuestions,
  );

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

                // Only update if the new value is not a duplicate
                if (!isDuplicateQuestion(questions, newValue, index)) {
                  questions[index] = newValue;

                  const updatedExistingQuestions = questions.map((q, i) => {
                    if (i === index) {
                      return newValue;
                    }
                    if (i < existingQuestions.length) {
                      return existingQuestions[i];
                    }
                    return displayQuestions[i] ?? q;
                  });

                  setParsedJD({
                    ...parsedJD,
                    existingChatQuestions: updatedExistingQuestions,
                    chatFlow: {
                      ...parsedJD.chatFlow,
                      questions,
                    },
                  });
                }
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
