import { PersonNode } from 'twenty-shared';

type Statistics = {
  label: string;
  count: number;
  percent: number;
};

export const calculateMessageStatistics = (allIndividualsForCurrentJob: PersonNode[]) => {
  const undeliveredMessages = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges?.some(
        (edge: { node: { whatsappDeliveryStatus: string } }) =>
          edge?.node?.whatsappDeliveryStatus === 'failed',
      ),
  ).length;
  const undeliveredPercent = (
    (undeliveredMessages / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  // Messages read but not responded
  const readNotResponded = allIndividualsForCurrentJob?.filter((individual) => {
    const phone = individual?.phones?.primaryPhoneNumber || '';
    const messages =
      individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
    return messages?.some(
      (edge: { node: { whatsappDeliveryStatus: string } }) =>
        edge?.node?.whatsappDeliveryStatus === 'read' &&
        !messages.some(
          (m) =>
            m?.node?.phoneFrom?.replace('+', '') === phone?.replace('+', ''),
        ),
    );
  }).length;
  const readNotRespondedPercent = (
    (readNotResponded / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  // Messages unread and not responded
  const unreadNotResponded = allIndividualsForCurrentJob?.filter(
    (individual) => {
      const messages =
        individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges;
      return messages?.some(
        (edge: { node: { whatsappDeliveryStatus: string } }) =>
          edge?.node?.whatsappDeliveryStatus === 'delivered' &&
          !messages.some(
            (m) =>
              m?.node?.phoneFrom?.replace('+', '') ===
              individual?.phones?.primaryPhoneNumber?.replace('+', ''),
          ),
      );
    },
  ).length;
  const unreadNotRespondedPercent = (
    (unreadNotResponded / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  // Total messages not responded
  const totalNotResponded = readNotResponded + unreadNotResponded;
  const totalNotRespondedPercent = (
    (totalNotResponded / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  // Total messages responded
  const totalResponded = allIndividualsForCurrentJob?.filter((individual) =>
    individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges?.some(
      (edge: { node: { phoneFrom: string } }) =>
        edge?.node?.phoneFrom?.replace('+', '') ===
        individual?.phones?.primaryPhoneNumber?.replace('+', ''),
    ),
  ).length;
  const totalRespondedPercent = (
    (totalResponded / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  return [
    {
      label: 'Undelivered Messages',
      count: undeliveredMessages,
      percent: parseFloat(undeliveredPercent),
    },
    {
      label: 'Read Not Responded',
      count: readNotResponded,
      percent: parseFloat(readNotRespondedPercent),
    },
    {
      label: 'Unread Not Responded',
      count: unreadNotResponded,
      percent: parseFloat(unreadNotRespondedPercent),
    },
    {
      label: 'Total Not Responded',
      count: totalNotResponded,
      percent: parseFloat(totalNotRespondedPercent),
    },
    {
      label: 'Total Responded',
      count: totalResponded,
      percent: parseFloat(totalRespondedPercent),
    },
  ];
};

export const calculateCandidateStatistics = (allIndividualsForCurrentJob: PersonNode[]) => {
  const onlyAddedNoConversation = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'ONLY_ADDED_NO_CONVERSATION',
  ).length;
  const onlyAddedNoConversationPercent = (
    (onlyAddedNoConversation / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const conversationStartedNoResponse = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
  ).length;
  const conversationStartedNoResponsePercent = (
    (conversationStartedNoResponse / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const sharedJdNoResponse = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'SHARED_JD_HAS_NOT_RESPONDED',
  ).length;
  const sharedJdNoResponsePercent = (
    (sharedJdNoResponse / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const refusesToRelocate = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'CANDIDATE_REFUSES_TO_RELOCATE',
  ).length;
  const refusesToRelocatePercent = (
    (refusesToRelocate / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const stoppedRespondingQuestions = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'STOPPED_RESPONDING_ON_QUESTIONS',
  ).length;
  const stoppedRespondingQuestionsPercent = (
    (stoppedRespondingQuestions / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const salaryOutOfRange = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'CANDIDATE_SALARY_OUT_OF_RANGE',
  ).length;
  const salaryOutOfRangePercent = (
    (salaryOutOfRange / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const keenToChat = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'CANDIDATE_IS_KEEN_TO_CHAT',
  ).length;
  const keenToChatPercent = (
    (keenToChat / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const followedUpForChat = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
  ).length;
  const followedUpForChatPercent = (
    (followedUpForChat / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const reluctantCompensation = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
  ).length;
  const reluctantCompensationPercent = (
    (reluctantCompensation / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const closedToBeContacted = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.candConversationStatus ===
      'CONVERSATION_CLOSED_TO_BE_CONTACTED',
  ).length;
  const closedToBeContactedPercent = (
    (closedToBeContacted / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  return [
    {
      label: 'No Conversation',
      count: onlyAddedNoConversation,
      percent: parseFloat(onlyAddedNoConversationPercent),
    },
    {
      label: 'Started, No Response',
      count: conversationStartedNoResponse,
      percent: parseFloat(conversationStartedNoResponsePercent),
    },
    {
      label: 'Shared JD, No Response',
      count: sharedJdNoResponse,
      percent: parseFloat(sharedJdNoResponsePercent),
    },
    {
      label: 'Refuses Relocation',
      count: refusesToRelocate,
      percent: parseFloat(refusesToRelocatePercent),
    },
    {
      label: 'Stopped Responding',
      count: stoppedRespondingQuestions,
      percent: parseFloat(stoppedRespondingQuestionsPercent),
    },
    {
      label: 'Salary Out of Range',
      count: salaryOutOfRange,
      percent: parseFloat(salaryOutOfRangePercent),
    },
    {
      label: 'Keen to Chat',
      count: keenToChat,
      percent: parseFloat(keenToChatPercent),
    },
    {
      label: 'Followed Up',
      count: followedUpForChat,
      percent: parseFloat(followedUpForChatPercent),
    },
    {
      label: 'Reluctant on Compensation',
      count: reluctantCompensation,
      percent: parseFloat(reluctantCompensationPercent),
    },
    {
      label: 'Closed to Contact',
      count: closedToBeContacted,
      percent: parseFloat(closedToBeContactedPercent),
    },
  ];
};

export const calculateStatusStatistics = (allIndividualsForCurrentJob: PersonNode[]) => {
  const screeningState = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.status === 'SCREENING',
  ).length;
  const screeningPercent = (
    (screeningState / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const unresponsive = allIndividualsForCurrentJob?.filter(
    (individual) => individual?.candidates?.edges[0]?.node?.status === null,
  ).length;
  const unresponsivePercent = (
    (unresponsive / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const notInterested = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.status === 'NOT_INTERESTED',
  ).length;
  const notInterestedPercent = (
    (notInterested / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const notFit = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.status === 'NOT_FIT',
  ).length;
  const notFitPercent = (
    (notFit / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  const recruiterInterviews = allIndividualsForCurrentJob?.filter(
    (individual) =>
      individual?.candidates?.edges[0]?.node?.status === 'RECRUITER_INTERVIEW',
  ).length;
  const recruiterInterviewsPercent = (
    (recruiterInterviews / allIndividualsForCurrentJob.length) *
    100
  ).toFixed(1);

  return [
    {
      label: 'Screening',
      count: screeningState,
      percent: parseFloat(screeningPercent),
    },
    {
      label: 'Unresponsive',
      count: unresponsive,
      percent: parseFloat(unresponsivePercent),
    },
    {
      label: 'Not Interested',
      count: notInterested,
      percent: parseFloat(notInterestedPercent),
    },
    { 
      label: 'Not Fit', 
      count: notFit, 
      percent: parseFloat(notFitPercent) 
    },
    {
      label: 'Recruiter Interviews',
      count: recruiterInterviews,
      percent: parseFloat(recruiterInterviewsPercent),
    },
  ];
}; 