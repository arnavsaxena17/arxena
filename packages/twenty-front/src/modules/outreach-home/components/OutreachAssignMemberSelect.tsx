import { isNonEmptyString } from '@sniptt/guards';
import { useMemo } from 'react';

import { type OutreachAssignmentMember } from '@/outreach-home/utils/outreach-assignment-api';
import { Select } from '@/ui/input/components/Select';

const SPLIT_BALANCED_VALUE = '__split_balanced__';
const SPLIT_ROUND_ROBIN_VALUE = '__split_round_robin__';

type OutreachAssignMemberSelectProps = {
  members: OutreachAssignmentMember[];
  selectedCount: number;
  disabled?: boolean;
  onAssign: (memberId: string) => void;
  onSplit: (mode: 'balanced' | 'round_robin') => void;
};

// One control for the bulk bar: pick a member to give the selection to, or
// split the selection across everyone on the list.
export const OutreachAssignMemberSelect = ({
  members,
  selectedCount,
  disabled = false,
  onAssign,
  onSplit,
}: OutreachAssignMemberSelectProps) => {
  const options = useMemo(
    () => [
      ...members.map((member) => ({
        value: member.memberId,
        label: `Assign to ${member.name}`,
      })),
      { value: SPLIT_BALANCED_VALUE, label: 'Split evenly by workload' },
      { value: SPLIT_ROUND_ROBIN_VALUE, label: 'Split round robin' },
    ],
    [members],
  );

  if (members.length === 0) {
    return null;
  }

  return (
    <Select<string>
      dropdownId="outreach-assign-member-select"
      disabled={disabled || selectedCount === 0}
      emptyOption={{
        value: '',
        label:
          selectedCount > 0 ? `Assign owner (${selectedCount})` : 'Assign owner',
      }}
      value=""
      onChange={(value) => {
        if (!isNonEmptyString(value)) {
          return;
        }

        if (value === SPLIT_BALANCED_VALUE) {
          onSplit('balanced');
        } else if (value === SPLIT_ROUND_ROBIN_VALUE) {
          onSplit('round_robin');
        } else {
          onAssign(value);
        }
      }}
      options={options}
      selectSizeVariant="small"
      dropdownWidthAuto
      needIconCheck={false}
    />
  );
};
