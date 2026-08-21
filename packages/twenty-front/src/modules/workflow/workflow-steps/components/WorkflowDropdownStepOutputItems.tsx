import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';

import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useObjectMetadataSelectHelpers } from '@/object-metadata/hooks/useObjectMetadataSelectHelpers';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useApplyStepFilterFieldFromVariable } from '@/workflow/workflow-steps/filters/hooks/useApplyStepFilterFieldFromVariable';
import { useVariableDropdown } from '@/workflow/workflow-variables/hooks/useVariableDropdown';
import { isRecordOutputSchemaV2 } from '@/workflow/workflow-variables/types/guards/isRecordOutputSchemaV2';
import { type StepOutputSchemaV2 } from '@/workflow/workflow-variables/types/StepOutputSchemaV2';
import { getCurrentSubStepFromPath } from '@/workflow/workflow-variables/utils/getCurrentSubStepFromPath';
import { getStepHeaderLabel } from '@/workflow/workflow-variables/utils/getStepHeaderLabel';
import { getStepItemIcon } from '@/workflow/workflow-variables/utils/getStepItemIcon';
import { getVariableTemplateFromPath } from '@/workflow/workflow-variables/utils/getVariableTemplateFromPath';
import { searchVariableThroughOutputSchemaV2 } from '@/workflow/workflow-variables/utils/searchVariableThroughOutputSchemaV2';
import { useLingui } from '@lingui/react/macro';
import type { StepFilter } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { extractRawVariableNamePart } from 'twenty-shared/workflow';
import { IconChevronLeft, useIcons } from 'twenty-ui/icon';
import { OverflowingTextWithTooltip } from 'twenty-ui/surfaces';
import { MenuItemSelect } from 'twenty-ui/navigation';

type WorkflowDropdownStepOutputItemsProps = {
  stepFilter: StepFilter;
  step: StepOutputSchemaV2;
  onSelect: () => void;
  onBack: () => void;
};

export const WorkflowDropdownStepOutputItems = ({
  stepFilter,
  step,
  onSelect,
  onBack,
}: WorkflowDropdownStepOutputItemsProps) => {
  const { t } = useLingui();
  const { getIcon } = useIcons();
  const { getSelectIconPropsFromObjectMetadataItem } =
    useObjectMetadataSelectHelpers();

  const { applyStepFilterFieldFromVariable } =
    useApplyStepFilterFieldFromVariable();
  const { objectMetadataItems } = useObjectMetadataItems();

  const updateStepFilter = ({
    rawVariableName,
    isFullRecord,
  }: {
    rawVariableName: string;
    isFullRecord: boolean;
  }) => {
    applyStepFilterFieldFromVariable({
      stepFilter,
      rawVariableName,
      isFullRecord,
      stepType: step.type,
    });
  };

  const handleStepFilterFieldSelect = (key: string) => {
    updateStepFilter({
      rawVariableName: key,
      isFullRecord: false,
    });
    onSelect();
  };

  const selectedFieldStepId = extractRawVariableNamePart({
    rawVariableName: stepFilter.stepOutputKey,
    part: 'stepId',
  });
  const initialPath =
    selectedFieldStepId === step.id && stepFilter.stepOutputKey
      ? stepFilter.stepOutputKey
          .replace(/^\{\{|\}\}$/g, '')
          .split('.')
          .slice(1, -1)
      : [];

  const {
    searchInputValue,
    setSearchInputValue,
    handleSelectField,
    goBack,
    filteredOptions,
    currentPath,
  } = useVariableDropdown({
    step,
    onSelect: handleStepFilterFieldSelect,
    onBack,
    initialPath,
  });

  const getDisplayedSubStepObject = () => {
    const currentSubStep = getCurrentSubStepFromPath(step, currentPath);

    if (!isRecordOutputSchemaV2(currentSubStep)) {
      return;
    }

    return currentSubStep.object;
  };

  const handleSelectObject = () => {
    const currentSubStep = getCurrentSubStepFromPath(step, currentPath);

    if (!isRecordOutputSchemaV2(currentSubStep)) {
      return;
    }

    updateStepFilter({
      rawVariableName: getVariableTemplateFromPath({
        stepId: step.id,
        path: [...currentPath, currentSubStep.object.fieldIdName ?? 'id'],
      }),
      isFullRecord: true,
    });
    onSelect();
  };

  const displayedSubStepObject = getDisplayedSubStepObject();

  const subStepObjectMetadataItem = isDefined(
    displayedSubStepObject?.objectMetadataId,
  )
    ? objectMetadataItems.find(
        (item) => item.id === displayedSubStepObject?.objectMetadataId,
      )
    : undefined;

  const shouldDisplaySubStepObject = searchInputValue
    ? isDefined(subStepObjectMetadataItem) &&
      subStepObjectMetadataItem.labelSingular
        .toLowerCase()
        .includes(searchInputValue.toLowerCase())
    : isDefined(displayedSubStepObject);

  const objectLabel = subStepObjectMetadataItem?.labelSingular;

  const subStepObjectIconProps = isDefined(subStepObjectMetadataItem)
    ? getSelectIconPropsFromObjectMetadataItem(subStepObjectMetadataItem)
    : undefined;

  return (
    <DropdownContent widthInPixels={GenericDropdownContentWidth.ExtraLarge}>
      <DropdownMenuHeader
        StartComponent={
          <DropdownMenuHeaderLeftComponent
            onClick={goBack}
            Icon={IconChevronLeft}
          />
        }
      >
        <OverflowingTextWithTooltip
          text={getStepHeaderLabel(step, currentPath)}
        />
      </DropdownMenuHeader>
      <DropdownMenuSearchInput
        autoFocus
        value={searchInputValue}
        onChange={(event) => setSearchInputValue(event.target.value)}
      />
      <DropdownMenuSeparator />
      <DropdownMenuItemsContainer hasMaxHeight>
        {shouldDisplaySubStepObject && (
          <MenuItemSelect
            selected={false}
            focused={false}
            onClick={handleSelectObject}
            text={objectLabel || ''}
            hasSubMenu={false}
            LeftIcon={subStepObjectIconProps?.Icon}
            leftIconColor={subStepObjectIconProps?.iconThemeColor}
            contextualText={t`Pick a ${objectLabel} record`}
          />
        )}
        {filteredOptions.length > 0 && shouldDisplaySubStepObject && (
          <DropdownMenuSeparator />
        )}
        {filteredOptions.map(([key, subStep]) => {
          if (!isDefined(subStep)) {
            return null;
          }

          const rawVariableName = getVariableTemplateFromPath({
            stepId: step.id,
            path: [...currentPath, key],
          });
          const { variablePathLabel } = searchVariableThroughOutputSchemaV2({
            stepOutputSchema: step,
            stepType: step.type,
            rawVariableName,
            isFullRecord: false,
          });

          return (
            <MenuItemSelect
              key={key}
              selected={false}
              focused={false}
              onClick={() => handleSelectField(key)}
              text={subStep.label || key}
              hasSubMenu={!subStep.isLeaf}
              tooltip={variablePathLabel}
              LeftIcon={
                subStep.icon
                  ? getIcon(subStep.icon)
                  : getIcon(
                      getStepItemIcon({
                        itemType: subStep.type,
                      }),
                    )
              }
              contextualText={
                subStep.isLeaf ? subStep?.value?.toString() : undefined
              }
            />
          );
        })}
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
