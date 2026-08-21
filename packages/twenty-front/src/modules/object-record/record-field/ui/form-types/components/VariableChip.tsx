import { BaseChip } from '@/object-record/record-field/ui/form-types/components/BaseChip';
import { useSearchVariable } from '@/workflow/workflow-variables/hooks/useSearchVariable';
import { useLingui } from '@lingui/react/macro';
import { useContext, useId } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { extractRawVariableNamePart } from 'twenty-shared/workflow';
import { IconAlertTriangle } from 'twenty-ui/icon';
import { AppTooltip, TooltipDelay } from 'twenty-ui/surfaces';
import { ThemeContext } from 'twenty-ui/theme-constants';

type VariableChipProps = {
  rawVariableName: string;
  onRemove?: () => void;
  isFullRecord?: boolean;
};

export const VariableChip = ({
  rawVariableName,
  onRemove,
  isFullRecord = false,
}: VariableChipProps) => {
  const { t } = useLingui();
  const { theme } = useContext(ThemeContext);
  const chipId = `variable-chip-${useId().replaceAll(':', '')}`;

  const { variableLabel, variablePathLabel } = useSearchVariable({
    stepId: extractRawVariableNamePart({
      rawVariableName,
      part: 'stepId',
    }),
    rawVariableName,
    isFullRecord,
  });

  const isVariableNotFound = !isDefined(variableLabel);
  const label = isVariableNotFound ? t`Not Found` : variableLabel;
  const title = isVariableNotFound ? t`Variable not found` : variablePathLabel;

  return (
    <>
      <BaseChip
        chipId={chipId}
        label={label}
        ariaLabel={title}
        onRemove={onRemove}
        removeAriaLabel={t`Remove variable`}
        danger={isVariableNotFound}
        leftIcon={
          isVariableNotFound ? (
            <IconAlertTriangle
              size={theme.icon.size.sm}
              stroke={theme.icon.stroke.sm}
              color={theme.color.red}
            />
          ) : undefined
        }
      />
      <AppTooltip
        anchorSelect={`#${chipId}`}
        content={title}
        noArrow
        place="top"
        positionStrategy="fixed"
        delay={TooltipDelay.shortDelay}
      />
    </>
  );
};
