import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { type StepOutputSchemaV2 } from '@/workflow/workflow-variables/types/StepOutputSchemaV2';
import { collectLeafFieldsFromOutputSchema } from '@/workflow/workflow-variables/utils/collectLeafFieldsFromOutputSchema';
import { getVariableTemplateFromPath } from '@/workflow/workflow-variables/utils/getVariableTemplateFromPath';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { IconX, useIcons } from 'twenty-ui/icon';
import { OverflowingTextWithTooltip } from 'twenty-ui/surfaces';
import { MenuItem, MenuItemSelect } from 'twenty-ui/navigation';

type WorkflowVariablesDropdownStepsProps = {
  dropdownId: string;
  steps: StepOutputSchemaV2[];
  onSelect: (value: string) => void;
  onSelectVariable?: (rawVariableName: string) => void;
};

export const WorkflowVariablesDropdownSteps = ({
  dropdownId,
  steps,
  onSelect,
  onSelectVariable,
}: WorkflowVariablesDropdownStepsProps) => {
  const { getIcon } = useIcons();
  const [searchInputValue, setSearchInputValue] = useState('');

  const { closeDropdown } = useCloseDropdown();

  const normalizedSearch = searchInputValue.toLowerCase();

  const availableSteps = steps.filter((step) =>
    normalizedSearch ? step.name.toLowerCase().includes(normalizedSearch) : true,
  );

  const matchingFields =
    normalizedSearch && onSelectVariable
      ? steps.flatMap((step) =>
          collectLeafFieldsFromOutputSchema({
            outputSchema: step.outputSchema,
            stepName: step.name,
          })
            .filter((field) =>
              field.label.toLowerCase().includes(normalizedSearch),
            )
            .map((field) => ({
              ...field,
              step,
              rawVariableName: getVariableTemplateFromPath({
                stepId: step.id,
                path: field.path,
              }),
            })),
        )
      : [];

  const hasResults = availableSteps.length > 0 || matchingFields.length > 0;

  return (
    <DropdownContent widthInPixels={GenericDropdownContentWidth.ExtraLarge}>
      <DropdownMenuHeader
        StartComponent={
          <DropdownMenuHeaderLeftComponent
            onClick={() => closeDropdown(dropdownId)}
            Icon={IconX}
          />
        }
      >
        <OverflowingTextWithTooltip text={t`Select Step`} />
      </DropdownMenuHeader>
      <DropdownMenuSearchInput
        autoFocus
        value={searchInputValue}
        onChange={(event) => setSearchInputValue(event.target.value)}
      />
      <DropdownMenuSeparator />
      <DropdownMenuItemsContainer hasMaxHeight>
        {hasResults ? (
          <>
            {availableSteps.map((item) => (
              <MenuItemSelect
                key={`step-${item.id}`}
                selected={false}
                focused={false}
                onClick={() => onSelect(item.id)}
                text={item.name}
                tooltip={item.name}
                LeftIcon={item.icon ? getIcon(item.icon) : undefined}
                hasSubMenu
              />
            ))}
            {matchingFields.length > 0 && availableSteps.length > 0 && (
              <DropdownMenuSeparator />
            )}
            {matchingFields.map((field) => (
              <MenuItemSelect
                key={`field-${field.rawVariableName}`}
                selected={false}
                focused={false}
                onClick={() => onSelectVariable?.(field.rawVariableName)}
                text={field.label}
                tooltip={field.pathLabel}
                contextualText={field.step.name}
                LeftIcon={
                  field.icon ? getIcon(field.icon) : getIcon(field.step.icon)
                }
                hasSubMenu={false}
              />
            ))}
          </>
        ) : (
          <MenuItem
            key="no-steps"
            onClick={() => {}}
            text={t`No variables available`}
            LeftIcon={undefined}
            hasSubMenu={false}
          />
        )}
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
