import { isNonEmptyString } from '@sniptt/guards';
import { OUTREACH_CONVERSATION_STAGE_LABELS } from 'twenty-shared/arx';
import { getLogoUrlFromDomainName } from 'twenty-shared/utils';
import {
  IconArrowRight,
  IconBrandLinkedin,
  IconBriefcase,
  IconBuildingSkyscraper,
  IconCalendar,
  IconClock,
  IconMap,
  IconMessage,
  IconMessageCircle,
  IconProgressCheck,
  IconSettingsAutomation,
  IconSparkles,
  IconUser,
} from 'twenty-ui/icon';

import {
  OutreachLinkCell,
  OutreachRecordChipCell,
  OutreachRelativeDateCell,
  OutreachTagCell,
  OutreachTextCell,
} from '@/outreach-home/components/record-table/OutreachRecordTableCells';
import { type OutreachRecordCard } from '@/outreach-home/components/record-table/OutreachRecordCardList';
import { type OutreachRecordTableColumn } from '@/outreach-home/components/record-table/OutreachRecordTable';
import {
  OUTREACH_STAGE_LABELS,
  WORKFLOW_RUN_STATUS_LABELS,
} from '@/outreach-home/constants/outreach-stages';
import {
  type OutreachCompanyRow,
  type OutreachPersonRow,
} from '@/outreach-home/types/outreach-home.types';
import {
  getOutreachConversationStageTagColor,
  getOutreachStageTagColor,
  getWorkflowRunStatusTagColor,
} from '@/outreach-home/utils/outreachTagColors';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// messagesExchanged is a "[time] Sender: text" transcript, one line per message
const getTranscriptLines = (person: OutreachPersonRow): string[] =>
  (person.messagesExchanged ?? '')
    .split('\n')
    .filter((line) => line.trim().length > 0);

const getLatestMessage = (person: OutreachPersonRow): string => {
  if (isNonEmptyString(person.lastInboundCopy)) {
    return person.lastInboundCopy;
  }

  const lastLine = getTranscriptLines(person).at(-1) ?? '';

  return lastLine.replace(/^\[[^\]]*\]\s*/, '');
};

const getConversationStageLabel = (person: OutreachPersonRow) => {
  const conversationStage = person.outreachConversationStage;

  if (!isNonEmptyString(conversationStage) || conversationStage === 'NONE') {
    return '';
  }

  return (
    OUTREACH_CONVERSATION_STAGE_LABELS[
      conversationStage as keyof typeof OUTREACH_CONVERSATION_STAGE_LABELS
    ] ?? conversationStage
  );
};

const getStageLabel = (person: OutreachPersonRow) =>
  OUTREACH_STAGE_LABELS[person.stage] ?? person.stage;

const getRunStatusLabel = (person: OutreachPersonRow) =>
  isNonEmptyString(person.workflowRunStatus)
    ? (WORKFLOW_RUN_STATUS_LABELS[person.workflowRunStatus] ??
      person.workflowRunStatus)
    : '';

export const getOutreachPeopleTableColumns = ({
  companiesByWorkingSetId,
  onOpenPerson,
}: {
  companiesByWorkingSetId: Record<string, OutreachCompanyRow>;
  onOpenPerson: (person: OutreachPersonRow) => void;
}): OutreachRecordTableColumn<OutreachPersonRow>[] => [
  {
    id: 'name',
    label: 'Name',
    Icon: IconUser,
    width: 200,
    sortValue: (person) => person.name,
    render: (person) => (
      <OutreachRecordChipCell
        name={person.name}
        avatarType="rounded"
        onClick={() => onOpenPerson(person)}
      />
    ),
  },
  {
    id: 'title',
    label: 'Job title',
    Icon: IconBriefcase,
    width: 180,
    sortValue: (person) => person.title,
    render: (person) => <OutreachTextCell value={person.title} />,
  },
  {
    id: 'company',
    label: 'Company',
    Icon: IconBuildingSkyscraper,
    width: 180,
    sortValue: (person) => person.companyName,
    render: (person) =>
      isNonEmptyString(person.companyName) ? (
        <OutreachRecordChipCell
          name={person.companyName}
          avatarType="squared"
          avatarUrl={getLogoUrlFromDomainName(
            companiesByWorkingSetId[person.companyId]?.domain,
            REACT_APP_SERVER_BASE_URL,
          )}
        />
      ) : null,
  },
  {
    id: 'location',
    label: 'Location',
    Icon: IconMap,
    width: 170,
    sortValue: (person) => person.locationName,
    render: (person) => <OutreachTextCell value={person.locationName} />,
  },
  {
    id: 'stage',
    label: 'Stage',
    Icon: IconProgressCheck,
    width: 170,
    sortValue: getStageLabel,
    render: (person) => (
      <OutreachTagCell
        label={getStageLabel(person)}
        color={getOutreachStageTagColor(person.stage)}
      />
    ),
  },
  {
    id: 'intent',
    label: 'Intent',
    Icon: IconSparkles,
    width: 170,
    sortValue: getConversationStageLabel,
    render: (person) => (
      <OutreachTagCell
        label={getConversationStageLabel(person)}
        color={getOutreachConversationStageTagColor(
          person.outreachConversationStage,
        )}
      />
    ),
  },
  {
    id: 'runStatus',
    label: 'Run status',
    Icon: IconSettingsAutomation,
    width: 130,
    sortValue: getRunStatusLabel,
    render: (person) => (
      <OutreachTagCell
        label={getRunStatusLabel(person)}
        color={getWorkflowRunStatusTagColor(person.workflowRunStatus)}
      />
    ),
  },
  {
    id: 'next',
    label: 'Next',
    Icon: IconArrowRight,
    width: 170,
    sortValue: (person) => person.nextStepLabel,
    render: (person) => (
      <OutreachTextCell value={person.nextStepLabel} isMuted />
    ),
  },
  {
    id: 'messages',
    label: 'Messages',
    Icon: IconMessage,
    width: 100,
    sortValue: (person) => getTranscriptLines(person).length,
    render: (person) => {
      const messageCount = getTranscriptLines(person).length;

      return messageCount > 0 ? (
        <OutreachTextCell value={String(messageCount)} />
      ) : null;
    },
  },
  {
    id: 'latestMessage',
    label: 'Latest message',
    Icon: IconMessageCircle,
    width: 240,
    sortValue: getLatestMessage,
    render: (person) => (
      <OutreachTextCell value={getLatestMessage(person)} isMuted />
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    Icon: IconBrandLinkedin,
    width: 150,
    render: (person) => <OutreachLinkCell url={person.linkedinUrl} />,
  },
  {
    id: 'createdAt',
    label: 'Added',
    Icon: IconCalendar,
    width: 130,
    sortValue: (person) => person.createdAt,
    render: (person) => <OutreachRelativeDateCell value={person.createdAt} />,
  },
  {
    id: 'updatedAt',
    label: 'Last update',
    Icon: IconClock,
    width: 130,
    sortValue: (person) => person.updatedAt,
    render: (person) => <OutreachRelativeDateCell value={person.updatedAt} />,
  },
];

// Phone card: who, where they work, and where the sequence stands
export const getOutreachPersonMobileCard = (
  person: OutreachPersonRow,
): OutreachRecordCard => {
  const intentLabel = getConversationStageLabel(person);
  const latestMessage = getLatestMessage(person);
  const footerText = isNonEmptyString(person.nextStepLabel)
    ? `Next: ${person.nextStepLabel}`
    : latestMessage;

  return {
    title: person.name,
    avatarType: 'rounded',
    subtitle: [person.title, person.companyName]
      .filter((part) => isNonEmptyString(part))
      .join(' · '),
    status: (
      <OutreachTagCell
        label={getStageLabel(person)}
        color={getOutreachStageTagColor(person.stage)}
      />
    ),
    footer:
      isNonEmptyString(intentLabel) || isNonEmptyString(footerText) ? (
        <>
          {isNonEmptyString(intentLabel) && (
            <OutreachTagCell
              label={intentLabel}
              color={getOutreachConversationStageTagColor(
                person.outreachConversationStage,
              )}
            />
          )}
          {isNonEmptyString(footerText) && (
            <OutreachTextCell value={footerText} isMuted />
          )}
        </>
      ) : undefined,
  };
};
