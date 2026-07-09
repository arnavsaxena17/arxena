import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import { IconUserCircle } from 'twenty-ui';

import { FormFieldPlaceholder } from '@/object-record/record-field/form-types/components/FormFieldPlaceholder';
import { VariableChipStandalone } from '@/object-record/record-field/form-types/components/VariableChipStandalone';

const StyledTriggerLabel = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  flex: 1;
  gap: ${({ theme }) => theme.spacing(1)};
  margin: ${({ theme }) => theme.spacing(2)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledPlaceholderContainer = styled.div`
  margin: ${({ theme }) => theme.spacing(2)};
`;

type FormWorkspaceMemberFilterValueInputTriggerProps = {
  isVariableValue: boolean;
  defaultValue?: string | null;
  isCurrentWorkspaceMemberSelected: boolean;
  triggerDisplayText: string | null;
  readonly?: boolean;
  onUnlinkVariable: () => void;
};

export const FormWorkspaceMemberFilterValueInputTrigger = ({
  isVariableValue,
  defaultValue,
  isCurrentWorkspaceMemberSelected,
  triggerDisplayText,
  readonly,
  onUnlinkVariable,
}: FormWorkspaceMemberFilterValueInputTriggerProps) => {
  if (isVariableValue) {
    return (
      <VariableChipStandalone
        rawVariableName={defaultValue ?? ''}
        onRemove={readonly ? undefined : onUnlinkVariable}
        isFullRecord
      />
    );
  }

  if (isDefined(triggerDisplayText)) {
    return (
      <StyledTriggerLabel>
        {isCurrentWorkspaceMemberSelected && <IconUserCircle size={12} />}
        {triggerDisplayText}
      </StyledTriggerLabel>
    );
  }

  return (
    <StyledPlaceholderContainer>
      <FormFieldPlaceholder>{t`Select`}</FormFieldPlaceholder>
    </StyledPlaceholderContainer>
  );
};
