import { gql } from '@apollo/client';

export const GET_CANDIDATE_RECORD = gql`
  query FindOneCandidate($objectRecordId: ID!) {
    candidate(filter: { id: { eq: $objectRecordId } }) {
      __typename
      clientInterviews {
        edges {
          node {
            __typename
            candidateId
            id
            position
            dateofInterview
            updatedAt
            name
            createdAt
          }
          __typename
        }
        __typename
      }
      people {
        __typename
        phone
        xLink {
          label
          url
          __typename
        }
        email
        jobTitle
        city
        id
        position
        name {
          firstName
          lastName
          __typename
        }
        updatedAt
        createdAt
        companyId
        linkedinLink {
          label
          url
          __typename
        }
        avatarUrl
      }
      activityTargets {
        edges {
          node {
            __typename
            createdAt
            jobId
            candidateEnrichmentId
            candidateId
            personId
            opportunityId
            candidateReminderId
            clientInterviewId
            whatsappMessageId
            id
            updatedAt
            answerId
            cvsentId
            clientContactId
            recruiterInterviewId
            screeningId
            activityId
            questionId
            companyId
            offerId
          }
          __typename
        }
        __typename
      }
      favorites {
        edges {
          node {
            __typename
            clientContactId
            whatsappMessageId
            companyId
            candidateId
            position
            personId
            questionId
            candidateReminderId
            clientInterviewId
            workspaceMemberId
            cvsentId
            opportunityId
            answerId
            id
            recruiterInterviewId
            jobId
            candidateEnrichmentId
            createdAt
            updatedAt
            screeningId
            offerId
          }
          __typename
        }
        __typename
      }
      engagementStatus
      attachments {
        edges {
          node {
            __typename
            recruiterInterviewId
            cvsentId
            clientInterviewId
            whatsappMessageId
            name
            offerId
            candidateId
            candidateEnrichmentId
            clientContactId
            authorId
            createdAt
            type
            opportunityId
            answerId
            personId
            candidateReminderId
            questionId
            updatedAt
            screeningId
            jobId
            companyId
            fullPath
            id
            activityId
          }
          __typename
        }
        __typename
      }
      recruiterInterviews {
        edges {
          node {
            __typename
            createdAt
            schedule
            transcription
            updatedAt
            id
            analysis
            candidateId
            name
            position
          }
          __typename
        }
        __typename
      }
      jobs {
        __typename
        peopleId
        isActive
        objectMetadataId
        arxenaSiteId
        createdAt
        id
        clientContactsId
        recruiterId
        name
        updatedAt
        jobLocation
        position
        companiesId
      }
      updatedAt
      peopleId
      jobsId
      status
      createdAt
      screenings {
        edges {
          node {
            __typename
            name
            updatedAt
            id
            createdAt
            candidateId
            position
          }
          __typename
        }
        __typename
      }
      candidateReminders {
        edges {
          node {
            __typename
            name
            id
            updatedAt
            remindCandidateDuration
            isReminderActive
            position
            createdAt
            candidateId
            remindCandidateAtTimestamp
          }
          __typename
        }
        __typename
      }
      timelineActivities {
        edges {
          node {
            __typename
            linkedObjectMetadataId
            personId
            opportunityId
            linkedRecordCachedName
            offerId
            updatedAt
            candidateReminderId
            companyId
            linkedRecordId
            id
            answerId
            questionId
            jobId
            candidateEnrichmentId
            cvsentId
            createdAt
            workspaceMemberId
            whatsappMessageId
            happensAt
            screeningId
            candidateId
            properties
            clientContactId
            recruiterInterviewId
            clientInterviewId
            name
          }
          __typename
        }
        __typename
      }
      jobSpecificFields
      answers {
        edges {
          node {
            __typename
            candidateId
            id
            updatedAt
            position
            createdAt
            name
            questionsId
          }
          __typename
        }
        __typename
      }
      id
      cvSents {
        edges {
          node {
            __typename
            candidateId
            createdAt
            position
            name
            updatedAt
            id
          }
          __typename
        }
        __typename
      }
      whatsappMessages {
        edges {
          node {
            __typename
            updatedAt
            candidateId
            position
            whatsappDeliveryStatus
            whatsappMessageId
            phoneFrom
            createdAt
            message
            audioFilePath
            id
            name
            recruiterId
            messageObj
            phoneTo
            jobsId
            typeOfMessage
            whatsappProvider
          }
          __typename
        }
        __typename
      }
      name
      position
      startChat
      whatsappProvider
    }
  }
`;
