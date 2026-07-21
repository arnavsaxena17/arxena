import { IconMail, IconPlus, IconTrash } from 'twenty-ui/icons';
import { EmailSequenceEditor } from '@/drip-campaign/components/EmailSequenceEditor';
import {
    activeEmailSequenceState,
    type DripCampaign,
    type EmailSequence
} from '@/drip-campaign/states/dripCampaignModalOpenState';
import styled from '@emotion/styled';
import { IconEdit } from 'twenty-ui/icons';
import { useState } from 'react';
import { useRecoilState } from 'recoil';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StyledSequenceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StyledSequenceItem = styled.div<{ isActive: boolean; isExpanded: boolean }>`
  border: 1px solid ${({ theme, isActive }) => 
    isActive ? theme.color.blue60 : theme.border.color.medium};
  border-radius: 8px;
  padding: 16px;
  background-color: ${({ theme, isActive }) => 
    isActive ? theme.background.transparent.light : theme.background.primary};
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue60};
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledSequenceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const StyledSequenceTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledSequenceActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const StyledActionButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledSequenceDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledDelayInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StyledStatusBadge = styled.div<{ isActive: boolean }>`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ theme, isActive }) => 
    isActive ? theme.color.green20 : theme.color.gray20};
  color: ${({ theme, isActive }) => 
    isActive ? theme.color.green80 : theme.color.gray80};
`;

const StyledAddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 2px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: 8px;
  background: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue60};
    color: ${({ theme }) => theme.color.blue60};
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledExpandButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

interface EmailSequenceManagerProps {
  campaign: DripCampaign;
  onCampaignUpdate: (campaign: DripCampaign) => void;
}

export const EmailSequenceManager: React.FC<EmailSequenceManagerProps> = ({
  campaign,
  onCampaignUpdate
}) => {
  const [activeSequence, setActiveSequence] = useRecoilState(activeEmailSequenceState);
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(new Set());

  const addSequence = () => {
    console.log("This log is missing")

    const newSequence: EmailSequence = {
      id: `sequence_${Date.now()}`,
      name: '',
      subject: '',
      content: '',
      delayDays: 0,
      delayHours: 0,
      delayMinutes: 0,
      order: campaign.emailSequences.length,
      isActive: true,
    };

    const updatedCampaign = {
      ...campaign,
      emailSequences: [...campaign?.emailSequences, newSequence]
    };
    console.log("updatedCampaign", updatedCampaign);
    onCampaignUpdate(updatedCampaign);
    console.log("newSequence", newSequence);
    setActiveSequence(newSequence);
  };

  const deleteSequence = (sequenceId: string) => {
    const updatedSequences = campaign.emailSequences
      .filter(seq => seq.id !== sequenceId)
      .map((seq, index) => ({ ...seq, order: index }));
    
    const updatedCampaign = {
      ...campaign,
      emailSequences: updatedSequences
    };
    onCampaignUpdate(updatedCampaign);
    
    if (activeSequence?.id === sequenceId) {
      setActiveSequence(null);
    }
  };

  const updateSequence = (updatedSequence: EmailSequence) => {
    const updatedSequences = campaign.emailSequences.map(seq =>
      seq.id === updatedSequence.id ? updatedSequence : seq
    );
    
    const updatedCampaign = {
      ...campaign,
      emailSequences: updatedSequences
    };
    onCampaignUpdate(updatedCampaign);
    setActiveSequence(updatedSequence);
  };

  const toggleSequenceExpansion = (sequenceId: string) => {
    const newExpanded = new Set(expandedSequences);
    if (newExpanded.has(sequenceId)) {
      newExpanded.delete(sequenceId);
    } else {
      newExpanded.add(sequenceId);
    }
    setExpandedSequences(newExpanded);
  };

  const formatDelay = (sequence: EmailSequence) => {
    const parts = [];
    if (sequence.delayDays > 0) parts.push(`${sequence.delayDays}d`);
    if (sequence.delayHours > 0) parts.push(`${sequence.delayHours}h`);
    if (sequence.delayMinutes > 0) parts.push(`${sequence.delayMinutes}m`);
    return parts.length > 0 ? parts.join(' ') : 'Immediate';
  };

  const sortedSequences = [...campaign.emailSequences].sort((a, b) => a.order - b.order);

  return (
    <StyledContainer>
      <StyledSequenceList>
        {sortedSequences.map((sequence) => {
          const isExpanded = expandedSequences.has(sequence.id);
          const isActive = activeSequence?.id === sequence.id;
          
          return (
            <StyledSequenceItem 
              key={sequence.id} 
              isActive={isActive}
              isExpanded={isExpanded}
            >
              <StyledSequenceHeader>
                <StyledSequenceTitle>
                  <StyledExpandButton
                    type="button"
                    onClick={() => toggleSequenceExpansion(sequence.id)}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </StyledExpandButton>
                  <IconMail size={16} />
                  {sequence.name || `Sequence ${sequence.order + 1}`}
                  <StyledStatusBadge isActive={sequence.isActive}>
                    {sequence.isActive ? 'Active' : 'Inactive'}
                  </StyledStatusBadge>
                </StyledSequenceTitle>
                <StyledSequenceActions>
                  <StyledActionButton
                    type="button"
                    onClick={() => setActiveSequence(sequence)}
                  >
                    <IconEdit size={16} />
                  </StyledActionButton>
                  <StyledActionButton
                    type="button"
                    onClick={() => deleteSequence(sequence.id)}
                  >
                    <IconTrash size={16} />
                  </StyledActionButton>
                </StyledSequenceActions>
              </StyledSequenceHeader>
              
              {isExpanded && (
                <StyledSequenceDetails>
                  <div><strong>Subject:</strong> {sequence.subject || 'No subject'}</div>
                  <StyledDelayInfo>
                    🕒 <span>Delay: {formatDelay(sequence)}</span>
                  </StyledDelayInfo>
                  <div><strong>Order:</strong> {sequence.order + 1}</div>
                </StyledSequenceDetails>
              )}
            </StyledSequenceItem>
          );
        })}
        
        <StyledAddButton type="button" onClick={addSequence}>
          <IconPlus size={16} />
          Add Email Sequence
        </StyledAddButton>
      </StyledSequenceList>

      {activeSequence && (
        <EmailSequenceEditor
          sequence={activeSequence}
          onUpdate={updateSequence}
          onClose={() => setActiveSequence(null)}
        />
      )}
    </StyledContainer>
  );
};
