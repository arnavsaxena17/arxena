import { gql } from '@apollo/client';

export const CREATE_ONE_AI_INTERVIEW_QUESTION = gql`
  mutation CreateOneAIInterviewQuestion($input: AIInterviewQuestionCreateInput!) {
    createAIInterviewQuestion(data: $input) {
      __typename
      attachments {
        edges {
          node {
            __typename
            name
            updatedAt
            offerId
            type
            questionId
            fullPath
            aIModelId
            aIInterviewQuestionId
            screeningId
            recruiterInterviewId
            clientInterviewId
            responseId
            aIInterviewStatusId
            id
            companyId
            answerId
            candidateId
            personId
            opportunityId
            aIInterviewId
            activityId
            createdAt
            whatsappMessageId
            authorId
            cvsentId
            jobId
          }
          __typename
        }
        __typename
      }
      createdAt
      retakes
      favorites {
        edges {
          node {
            __typename
            answerId
            id
            createdAt
            updatedAt
            offerId
            position
            aIInterviewStatusId
            screeningId
            aIInterviewId
            aIModelId
            responseId
            companyId
            whatsappMessageId
            recruiterInterviewId
            workspaceMemberId
            clientInterviewId
            opportunityId
            questionId
            candidateId
            jobId
            aIInterviewQuestionId
            cvsentId
            personId
          }
          __typename
        }
        __typename
      }
      answerType
      aIInterview {
        __typename
        name
        jobId
        position
        aIModelId
        instructions
        updatedAt
        id
        createdAt
        introduction
      }
      timelineActivities {
        edges {
          node {
            __typename
            properties
            offerId
            updatedAt
            whatsappMessageId
            aIInterviewId
            responseId
            questionId
            recruiterInterviewId
            linkedRecordId
            companyId
            happensAt
            personId
            opportunityId
            id
            jobId
            aIInterviewStatusId
            screeningId
            workspaceMemberId
            cvsentId
            aIInterviewQuestionId
            candidateId
            answerId
            linkedObjectMetadataId
            createdAt
            aIModelId
            linkedRecordCachedName
            clientInterviewId
            name
          }
          __typename
        }
        __typename
      }
      questionType
      questionValue
      activityTargets {
        edges {
          node {
            __typename
            aIInterviewStatusId
            whatsappMessageId
            opportunityId
            personId
            aIModelId
            jobId
            companyId
            aIInterviewId
            createdAt
            recruiterInterviewId
            questionId
            cvsentId
            answerId
            clientInterviewId
            screeningId
            updatedAt
            responseId
            activityId
            candidateId
            aIInterviewQuestionId
            offerId
            id
          }
          __typename
        }
        __typename
      }
      updatedAt
      name
      position
      id
      responses {
        edges {
          node {
            __typename
            aIInterviewStatusId
            timeLimitAdherence
            completedResponse
            retakesRemaining
            updatedAt
            position
            timerStopped
            startedResponding
            transcript
            id
            feedback
            timerStarted
            name
            createdAt
            aIInterviewQuestionId
          }
          __typename
        }
        __typename
      }
      aIInterviewId
      timeLimit
    }
  }
`;
