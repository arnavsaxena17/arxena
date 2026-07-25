import { IconButton } from 'twenty-ui/input';
import { IconX } from 'twenty-ui/icon';
import { enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { Modal, ModalContent, ModalHeader } from 'twenty-ui/surfaces';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useEffect, useMemo } from 'react';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import { selectedConversationStatusState } from '../states/states';

const StyledStatsContainer = styled.div`
  height: 500px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${themeCssVariables.spacing[3]};
  margin-bottom: ${themeCssVariables.spacing[3]};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: ${themeCssVariables.spacing[2]};
  }
`;

const StyledStatItem = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  padding: ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.sm};
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid ${themeCssVariables.border.color.light};

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    border-color: ${themeCssVariables.border.color.medium};
  }

  strong {
    display: block;
    margin-bottom: ${themeCssVariables.spacing[1]};
    color: ${themeCssVariables.font.color.primary};
    font-size: ${themeCssVariables.font.size.sm};
    font-weight: ${themeCssVariables.font.weight.semiBold};
  }

  .count {
    color: ${themeCssVariables.font.color.secondary};
    font-size: ${themeCssVariables.font.size.sm};
    font-weight: ${themeCssVariables.font.weight.medium};
  }
`;

const StyledHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StyledTitle = styled.div`
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledTabContent = styled.div`
  height: 500px;
  overflow-y: auto;
`;

const StyledEnrichmentStatsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  height: 600px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledEnrichmentSection = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[3]};
  border: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledEnrichmentTitle = styled.h3`
  margin: 0 0 ${themeCssVariables.spacing[3]} 0;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledEnrichmentFieldStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledEnrichmentFieldItem = styled.div`
  background-color: ${themeCssVariables.background.primary};
  padding: ${themeCssVariables.spacing[3]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.light};
  transition: all 0.2s ease;

  strong {
    display: block;
    margin-bottom: ${themeCssVariables.spacing[2]};
    color: ${themeCssVariables.font.color.primary};
    font-size: ${themeCssVariables.font.size.sm};
    font-weight: ${themeCssVariables.font.weight.semiBold};
  }

  .field-value {
    color: ${themeCssVariables.font.color.secondary};
    font-size: ${themeCssVariables.font.size.sm};
  }
`;

const StyledValueRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.xs};
  border: 1px solid ${themeCssVariables.border.color.light};
  
  .value-text {
    flex: 1;
    margin-right: ${themeCssVariables.spacing[2]};
    word-break: break-word;
    font-size: ${themeCssVariables.font.size.sm};
    color: ${themeCssVariables.font.color.primary};
  }
  
  .value-count {
    font-weight: ${themeCssVariables.font.weight.semiBold};
    color: ${themeCssVariables.color.blue};
    background-color: ${themeCssVariables.background.primary};
    padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1.5]};
    border-radius: ${themeCssVariables.border.radius.xs};
    min-width: 32px;
    text-align: center;
    font-size: ${themeCssVariables.font.size.sm};
  }
`;

type ProjectStatisticsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  processedData: any[];
};

type CandidateStatus = {
  label: string;
  status: string;
};

const candidateStatuses: CandidateStatus[] = [
  {
    label: 'No Conversation',
    status: 'ONLY_ADDED_NO_CONVERSATION',
  },
  {
    label: 'Started, No Response',
    status: 'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
  },
  {
    label: 'Declined Opportunity',
    status: 'CANDIDATE_DECLINED_OPPORTUNITY',
  },
  {
    label: 'Shared JD, No Response',
    status: 'SHARED_JD_HAS_NOT_RESPONDED',
  },
  {
    label: 'Refuses Relocation',
    status: 'CANDIDATE_REFUSES_TO_RELOCATE',
  },
  {
    label: 'Stopped Responding',
    status: 'STOPPED_RESPONDING_ON_QUESTIONS',
  },
  {
    label: 'Salary Out of Range',
    status: 'CANDIDATE_SALARY_OUT_OF_RANGE',
  },
  {
    label: 'Keen to Chat',
    status: 'CANDIDATE_IS_KEEN_TO_CHAT',
  },
  {
    label: 'Followed Up',
    status: 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
  },
  {
    label: 'Reluctant on Compensation',
    status: 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
  },
  {
    label: 'Closed to Contact',
    status: 'CONVERSATION_CLOSED_TO_BE_CONTACTED',
  },
];

export const ProjectStatisticsModal = ({ isOpen, onClose, processedData }: ProjectStatisticsModalProps) => {
  const setSelectedStatus = useSetAtomState(selectedConversationStatusState);
  const customEnrichments = useAtomStateValue(enrichmentsState);
  const sampleEnrichments = useAtomStateValue(sampleEnrichmentsState);
  const [activeTabId, setActiveTabId] = useAtomComponentState(
    activeTabIdComponentState,
    'job-statistics-modal',
  );
  
  // Reset to first tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTabId('conversation-status');
    }
  }, [isOpen, setActiveTabId]);

  // Merge enrichments and get enrichment field statistics
  const enrichmentStats = useMemo(() => {
    const allAiFilters = [...customEnrichments, ...sampleEnrichments].reduce<any[]>((acc, current) => {
      const exists = acc.find(item => item.modelName === current.modelName);
      if (!exists) {
        return [...acc, current];
      }
      return acc;
    }, []);

    // Get all possible field names from processed data
    const availableFieldNames = new Set<string>();
    if (processedData.length > 0) {
      processedData.forEach(candidate => {
        Object.keys(candidate).forEach(key => availableFieldNames.add(key));
      });
    }

    const stats: Record<string, any> = {};

    allAiFilters.forEach(aiFilter => {
      if (aiFilter.fields) {
        aiFilter.fields.forEach((field: any) => {
          if (availableFieldNames.has(field.name)) {
            const fieldValues = processedData
              .map(candidate => candidate[field.name])
              .filter(value => value !== null && value !== undefined && value !== '');

            if (fieldValues.length > 0) {
              // Count frequency of each value
              const valueCounts: Record<string, number> = {};
              fieldValues.forEach(value => {
                const stringValue = String(value);
                valueCounts[stringValue] = (valueCounts[stringValue] || 0) + 1;
              });

              // Sort by count (descending) then by value (ascending)
              const sortedValueCounts = Object.entries(valueCounts)
                .sort(([, a], [, b]) => b - a || String(a).localeCompare(String(b)));

              stats[field.name] = {
                enrichmentName: aiFilter.modelName,
                fieldName: field.name,
                fieldType: field.type,
                totalCount: fieldValues.length,
                uniqueValues: Object.keys(valueCounts).length,
                valueCounts: sortedValueCounts,
                topValues: sortedValueCounts.slice(0, 10) // Show top 10 most frequent values
              };
            }
          }
        });
      }
    });

    return stats;
  }, [customEnrichments, sampleEnrichments, processedData]);

  if (!isOpen) return null;

  const handleStatusClick = (status: string | null) => {
    setSelectedStatus(status);
    onClose();
  };

  const tabs = [
    {
      id: 'conversation-status',
      title: 'Conversation Status',
    },
    {
      id: 'enrichment-fields',
      title: 'Enrichment Fields',
    },
  ];

  const renderConversationStatusTab = () => (
    <StyledStatsContainer>
      <StyledStatsRow>
        <StyledStatItem onClick={() => handleStatusClick(null)}>
          <strong>Total Candidates</strong>
          <div className="count">{processedData.length}</div>
        </StyledStatItem>
      </StyledStatsRow>
      <StyledStatsRow>
        <StyledStatItem onClick={() => handleStatusClick('ONLY_ADDED_NO_CONVERSATION')}>
          <strong>No Conversation</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'ONLY_ADDED_NO_CONVERSATION').length} candidates</div>
        </StyledStatItem>
        <StyledStatItem onClick={() => handleStatusClick('CONVERSATION_STARTED_HAS_NOT_RESPONDED')}>
          <strong>Started, No Response</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CONVERSATION_STARTED_HAS_NOT_RESPONDED').length} candidates</div>
        </StyledStatItem>
        <StyledStatItem onClick={() => handleStatusClick('SHARED_JD_HAS_NOT_RESPONDED')}>
          <strong>Shared JD, No Response</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'SHARED_JD_HAS_NOT_RESPONDED').length} candidates</div>
        </StyledStatItem>
      </StyledStatsRow>
      <StyledStatsRow>
        <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_REFUSES_TO_RELOCATE')}>
          <strong>Refuses Relocation</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CANDIDATE_REFUSES_TO_RELOCATE').length} candidates</div>
        </StyledStatItem>
        <StyledStatItem onClick={() => handleStatusClick('STOPPED_RESPONDING_ON_QUESTIONS')}>
          <strong>Stopped Responding</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'STOPPED_RESPONDING_ON_QUESTIONS').length} candidates</div>
        </StyledStatItem>
        <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_SALARY_OUT_OF_RANGE')}>
          <strong>Salary Out of Range</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CANDIDATE_SALARY_OUT_OF_RANGE').length} candidates</div>
        </StyledStatItem>
      </StyledStatsRow>
      <StyledStatsRow>
        <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_IS_KEEN_TO_CHAT')}>
          <strong>Keen to Chat</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CANDIDATE_IS_KEEN_TO_CHAT').length} candidates</div>
        </StyledStatItem>
        <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT')}>
          <strong>Followed Up</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT').length} candidates</div>
        </StyledStatItem>
        <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION')}>
          <strong>Reluctant on Compensation</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION').length} candidates</div>
        </StyledStatItem>
      </StyledStatsRow>
      <StyledStatsRow>
        <StyledStatItem onClick={() => handleStatusClick('CONVERSATION_CLOSED_TO_BE_CONTACTED')}>
          <strong>Closed to Contact</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CONVERSATION_CLOSED_TO_BE_CONTACTED').length} candidates</div>
        </StyledStatItem>
        <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_DECLINED_OPPORTUNITY')}>
          <strong>Declined Opportunity</strong>
          <div className="count">{processedData.filter(record => record.candConversationStatus === 'CANDIDATE_DECLINED_OPPORTUNITY').length} candidates</div>
        </StyledStatItem>
      </StyledStatsRow>
    </StyledStatsContainer>
  );

  const renderEnrichmentFieldsTab = () => (
    <StyledEnrichmentStatsContainer>
      {Object.keys(enrichmentStats).length === 0 ? (
        <StyledEnrichmentSection>
          <StyledEnrichmentTitle>No Enrichment Data Available</StyledEnrichmentTitle>
          <p>No enrichment fields with data found for this job.</p>
        </StyledEnrichmentSection>
      ) : (
        Object.entries(enrichmentStats).map(([fieldName, stats]) => (
          <StyledEnrichmentSection key={fieldName}>
            <StyledEnrichmentTitle>
              {stats.enrichmentName} - {stats.fieldName}
            </StyledEnrichmentTitle>
            <StyledEnrichmentFieldStats>
              <StyledEnrichmentFieldItem>
                <strong>Total Records</strong>
                <div className="field-value">{stats.totalCount} candidates</div>
              </StyledEnrichmentFieldItem>
              {/* <StyledEnrichmentFieldItem>
                <strong>Unique Values</strong>
                <div className="field-value">{stats.uniqueValues} distinct values</div>
              </StyledEnrichmentFieldItem> */}
              {/* <StyledEnrichmentFieldItem>
                <strong>Field Type</strong>
                <div className="field-value">{stats.fieldType}</div>
              </StyledEnrichmentFieldItem> */}
              <StyledEnrichmentFieldItem>
                <strong>Value Distribution (Top 10)</strong>
                <div className="field-value">
                  {stats.topValues.map(([value, count]: [string, number], index: number) => (
                    <StyledValueRow key={index}>
                      <span className="value-text">
                        {String(value).length > 50 ? `${String(value).substring(0, 50)}...` : String(value)}
                      </span>
                      <span className="value-count">
                        {count}
                      </span>
                    </StyledValueRow>
                  ))}
                </div>
              </StyledEnrichmentFieldItem>
            </StyledEnrichmentFieldStats>
          </StyledEnrichmentSection>
        ))
      )}
    </StyledEnrichmentStatsContainer>
  );

  return (
    <Modal isOpen={isOpen} size="large" padding="medium">
      <ModalHeader>
        <StyledHeaderContainer>
          <StyledTitle>Project Statistics</StyledTitle>
          <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
        </StyledHeaderContainer>
      </ModalHeader>
      <ModalContent>
        <TabList
          componentInstanceId="job-statistics-modal"
          tabs={tabs}
          behaveAsLinks={false}
        />
        <StyledTabContent>
          {activeTabId === 'conversation-status' && renderConversationStatusTab()}
          {activeTabId === 'enrichment-fields' && renderEnrichmentFieldsTab()}
        </StyledTabContent>
      </ModalContent>
    </Modal>
  );
}; 