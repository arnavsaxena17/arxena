import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { Tag } from 'twenty-ui/data-display';
import { Checkbox } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachSetupSectionCard } from '@/outreach-home/components/OutreachSetupSectionCard';
import { useOutreachAssignment } from '@/outreach-home/hooks/useOutreachAssignment';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { type OutreachAssignmentPolicy } from '@/outreach-home/utils/outreach-assignment-api';
import { Select } from '@/ui/input/components/Select';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const POLICY_OPTIONS: Array<{
  value: OutreachAssignmentPolicy;
  label: string;
}> = [
  { value: 'least_loaded', label: 'Least loaded member' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'warm_suggest', label: 'Warm overlap (mutuals, school, employer)' },
  { value: 'manual_only', label: 'Manual only (assign yourself)' },
];

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin: 0;
`;

const StyledFieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledMemberRow = styled.label`
  align-items: center;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledMemberName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  min-width: 0;
`;

const StyledMemberMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  white-space: nowrap;
`;

const StyledMemberList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

export const OutreachSetupTeamSendingSection = () => {
  const { projectId } = useAtomStateValue(outreachContextState);
  const { members, config, pinActive, pinInDraft, isWorking, saveConfig } =
    useOutreachAssignment(projectId);

  if (!isNonEmptyString(projectId) || config === null) {
    return null;
  }

  const participantIds = config.participantMemberIds;
  const isParticipating = (memberId: string, eligible: boolean) =>
    participantIds.length === 0 ? eligible : participantIds.includes(memberId);

  const toggleMember = (memberId: string) => {
    const current =
      participantIds.length === 0
        ? members.filter((member) => member.eligible).map((member) => member.memberId)
        : participantIds;
    const next = current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId];

    void saveConfig({ participantMemberIds: next });
  };

  const pinStatus = pinActive ? (
    <Tag color="green" text="Sender pinning on" weight="regular" />
  ) : pinInDraft ? (
    <Tag color="orange" text="Pinning is in a draft: activate it" weight="regular" />
  ) : (
    <Tag color="gray" text="Sender pinning off" weight="regular" />
  );

  return (
    <OutreachSetupSectionCard
      title="Team sending"
      description="Decide which workspace members work this list. Each person is pinned to one member, and every message, email and reply stays on that member's account."
      headerAction={pinStatus}
    >
      {!pinActive && (
        <StyledMuted>
          {pinInDraft
            ? 'The workflow draft has sender pinning. Activate it to start sending from each owner.'
            : 'Turn on "Pin outreach sender by warm overlap" in the sequencer workflow\'s Edit Workflow options. Until then everything sends from the first member.'}
        </StyledMuted>
      )}
      <StyledFieldStack>
        <StyledFieldLabel>Assign new people by</StyledFieldLabel>
        <Select<OutreachAssignmentPolicy>
          dropdownId="outreach-setup-assignment-policy-select"
          value={config.policy}
          disabled={isWorking}
          onChange={(policy) => {
            void saveConfig({ policy });
          }}
          options={POLICY_OPTIONS}
          fullWidth
          selectSizeVariant="small"
          needIconCheck={false}
        />
      </StyledFieldStack>
      <StyledFieldStack>
        <StyledFieldLabel>Members on this list</StyledFieldLabel>
        <StyledMemberList>
          {members.map((member) => (
            <StyledMemberRow key={member.memberId}>
              <Checkbox
                checked={isParticipating(member.memberId, member.eligible)}
                disabled={isWorking || !member.hasLinkedinSeat}
                onChange={() => toggleMember(member.memberId)}
              />
              <StyledMemberName>
                {member.name}
                {isNonEmptyString(member.userEmail) ? ` · ${member.userEmail}` : ''}
              </StyledMemberName>
              <StyledMemberMeta>
                {member.hasLinkedinSeat ? 'LinkedIn connected' : 'No LinkedIn seat'}
                {' · '}
                {member.activeCandidates} active
              </StyledMemberMeta>
            </StyledMemberRow>
          ))}
        </StyledMemberList>
      </StyledFieldStack>
      {config.policy === 'warm_suggest' && (
        <StyledMuted>
          Warm overlap compares each member&apos;s mutual connections, school and
          employers with the prospect. Suggestions wait for you to confirm them
          in the People tab.
        </StyledMuted>
      )}
    </OutreachSetupSectionCard>
  );
};
