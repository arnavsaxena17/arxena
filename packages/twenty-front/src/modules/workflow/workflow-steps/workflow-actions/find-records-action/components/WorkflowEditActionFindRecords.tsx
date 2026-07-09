import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { isNumber } from '@sniptt/guards';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared';
import { HorizontalSeparator, useIcons } from 'twenty-ui';
import { JsonValue } from 'type-fest';
import { useDebouncedCallback } from 'use-debounce';

import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { FormNumberFieldInput } from '@/object-record/record-field/form-types/components/FormNumberFieldInput';
import { RecordFilterGroupsComponentInstanceContext } from '@/object-record/record-filter-group/states/context/RecordFilterGroupsComponentInstanceContext';
import { RecordFiltersComponentInstanceContext } from '@/object-record/record-filter/states/context/RecordFiltersComponentInstanceContext';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { SelectControl } from '@/ui/input/components/SelectControl';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { WorkflowFindRecordsAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepHeader } from '@/workflow/workflow-steps/components/WorkflowStepHeader';
import { WorkflowFindRecordsFilters } from '@/workflow/workflow-steps/workflow-actions/find-records-action/components/WorkflowFindRecordsFilters';
import { WorkflowFindRecordsFiltersEffect } from '@/workflow/workflow-steps/workflow-actions/find-records-action/components/WorkflowFindRecordsFiltersEffect';
import { WorkflowFindRecordsSorts } from '@/workflow/workflow-steps/workflow-actions/find-records-action/components/WorkflowFindRecordsSorts';
import { WorkflowObjectDropdownContent } from '@/workflow/workflow-steps/workflow-actions/find-records-action/components/WorkflowObjectDropdownContent';
import {
  parseWorkflowFindRecordsFilter,
  parseWorkflowFindRecordsOrderBy,
  serializeWorkflowFindRecordsFilter,
  serializeWorkflowFindRecordsOrderBy,
  WorkflowFindRecordsFilter,
  WorkflowFindRecordsOrderBy,
  WorkflowFindRecordsRecordSort,
} from '@/workflow/workflow-steps/workflow-actions/find-records-action/utils/workflowFindRecordsFilterUtils';
import { getActionIcon } from '@/workflow/workflow-steps/workflow-actions/utils/getActionIcon';
import { useTheme } from '@emotion/react';
import { ADVANCED_FILTER_DROPDOWN_ID } from '@/views/constants/AdvancedFilterDropdownId';

const QUERY_MAX_RECORDS = 60;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.light};
  display: block;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledRecordTypeSelectContainer = styled.div<{ fullWidth?: boolean }>`
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};
`;

type WorkflowEditActionFindRecordsProps = {
  action: WorkflowFindRecordsAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowFindRecordsAction) => void;
      };
};

type FindRecordsFormData = {
  objectNameSingular: string;
  filter?: WorkflowFindRecordsFilter;
  orderBy?: WorkflowFindRecordsOrderBy;
  limit?: number;
  offset?: number;
};

export const WorkflowEditActionFindRecords = ({
  action,
  actionOptions,
}: WorkflowEditActionFindRecordsProps) => {
  const { t } = useLingui();
  const theme = useTheme();
  const { getIcon } = useIcons();
  const filterValueDependencies = useFilterValueDependencies();

  const dropdownId = 'workflow-edit-action-record-find-records-object-name';
  const { closeDropdown } = useCloseDropdown();
  const { objectMetadataItems } = useFilteredObjectMetadataItems();

  const initialObjectMetadataItem = objectMetadataItems.find(
    (item) => item.nameSingular === action.settings.input.objectName,
  );

  const [formData, setFormData] = useState<FindRecordsFormData>(() => ({
    objectNameSingular: action.settings.input.objectName,
    limit:
      isNumber(action.settings.input.limit) &&
      action.settings.input.limit > QUERY_MAX_RECORDS
        ? QUERY_MAX_RECORDS
        : (action.settings.input.limit ?? 1),
    offset: Math.max(0, Math.floor(action.settings.input.offset ?? 0)),
    filter: parseWorkflowFindRecordsFilter(
      action.settings.input.filter,
      initialObjectMetadataItem,
    ),
    orderBy: action.settings.input.orderBy as WorkflowFindRecordsOrderBy,
  }));

  const [limitError, setLimitError] = useState<string | undefined>(undefined);
  const [offsetError, setOffsetError] = useState<string | undefined>(undefined);
  const isFormDisabled = actionOptions.readonly ?? false;
  const instanceId = `workflow-edit-action-record-find-records-${action.id}-${formData.objectNameSingular}`;

  const selectedObjectMetadataItem = objectMetadataItems.find(
    (item) => item.nameSingular === formData.objectNameSingular,
  );

  const selectedOption = selectedObjectMetadataItem
    ? {
        label: selectedObjectMetadataItem.labelPlural,
        value: selectedObjectMetadataItem.nameSingular,
        Icon: getIcon(selectedObjectMetadataItem.icon),
      }
    : { label: t`Select an option`, value: '' };

  const saveAction = useDebouncedCallback((nextFormData: FindRecordsFormData) => {
    if (actionOptions.readonly === true || !isDefined(selectedObjectMetadataItem)) {
      return;
    }

    const {
      objectNameSingular: updatedObjectName,
      limit: updatedLimit,
      offset: updatedOffset,
      filter: updatedFilter,
      orderBy: updatedOrderBy,
    } = nextFormData;

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          objectName: updatedObjectName,
          limit: updatedLimit ?? 1,
          offset: Math.max(0, Math.floor(updatedOffset ?? 0)),
          filter: serializeWorkflowFindRecordsFilter({
            filter: updatedFilter,
            filterValueDependencies,
            objectMetadataItem: selectedObjectMetadataItem,
          }),
          orderBy: updatedOrderBy
            ? (serializeWorkflowFindRecordsOrderBy({
                recordSorts: updatedOrderBy.recordSorts ?? [],
                objectMetadataItem: selectedObjectMetadataItem,
              }) as Record<string, JsonValue>)
            : undefined,
        },
      },
    });
  }, 1_000);

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  const handleOptionClick = (value: string) => {
    if (actionOptions.readonly === true) {
      return;
    }

    const newFormData: FindRecordsFormData = {
      objectNameSingular: value,
      limit: 1,
      offset: 0,
    };

    setFormData(newFormData);
    saveAction(newFormData);
    closeDropdown(dropdownId);
  };

  const headerTitle = isDefined(action.name) ? action.name : `Search Records`;
  const headerIcon = getActionIcon(action.type);

  return (
    <>
      <WorkflowStepHeader
        onTitleChange={(newName: string) => {
          if (actionOptions.readonly === true) {
            return;
          }

          actionOptions.onActionUpdate({
            ...action,
            name: newName,
          });
        }}
        Icon={getIcon(headerIcon)}
        iconColor={theme.font.color.tertiary}
        initialTitle={headerTitle}
        headerType="Action"
        disabled={isFormDisabled}
      />
      <WorkflowStepBody>
        <StyledRecordTypeSelectContainer fullWidth>
          <StyledLabel>{t`Object`}</StyledLabel>
          <Dropdown
            dropdownId={dropdownId}
            dropdownHotkeyScope={{ scope: ADVANCED_FILTER_DROPDOWN_ID }}
            dropdownPlacement="bottom-start"
            clickableComponent={
              <SelectControl
                isDisabled={isFormDisabled}
                selectedOption={selectedOption}
              />
            }
            dropdownComponents={
              !isFormDisabled && (
                <WorkflowObjectDropdownContent
                  dropdownId={dropdownId}
                  dropdownHotkeyScope={{ scope: ADVANCED_FILTER_DROPDOWN_ID }}
                  onOptionClick={handleOptionClick}
                />
              )
            }
            dropdownOffset={{ y: 4 }}
          />
        </StyledRecordTypeSelectContainer>

        <HorizontalSeparator noMargin />

        {isDefined(selectedObjectMetadataItem) && (
          <div>
            <InputLabel>{t`Filter`}</InputLabel>
            <RecordIndexContextProvider
              value={{
                indexIdentifierUrl: () => '',
                onIndexRecordsLoaded: () => {},
                objectNamePlural: selectedObjectMetadataItem.namePlural,
                objectNameSingular: selectedObjectMetadataItem.nameSingular,
                objectMetadataItem: selectedObjectMetadataItem,
                recordIndexId: instanceId,
              }}
            >
              <RecordFilterGroupsComponentInstanceContext.Provider
                value={{ instanceId }}
              >
                <RecordFiltersComponentInstanceContext.Provider
                  value={{ instanceId }}
                >
                  <WorkflowFindRecordsFilters
                    objectMetadataItem={selectedObjectMetadataItem}
                    onChange={(filter: WorkflowFindRecordsFilter) => {
                      if (isFormDisabled === true) {
                        return;
                      }

                      const newFormData: FindRecordsFormData = {
                        ...formData,
                        filter,
                      };

                      setFormData(newFormData);
                      saveAction(newFormData);
                    }}
                    readonly={isFormDisabled}
                  />
                  <WorkflowFindRecordsFiltersEffect
                    defaultValue={formData.filter}
                  />
                </RecordFiltersComponentInstanceContext.Provider>
              </RecordFilterGroupsComponentInstanceContext.Provider>
            </RecordIndexContextProvider>
          </div>
        )}

        {isDefined(selectedObjectMetadataItem) && (
          <div>
            <InputLabel>{t`Sort`}</InputLabel>
            <WorkflowFindRecordsSorts
              recordSorts={
                formData.orderBy?.recordSorts ??
                parseWorkflowFindRecordsOrderBy(
                  action.settings.input.orderBy as Record<string, unknown>,
                )
              }
              objectMetadataItem={selectedObjectMetadataItem}
              onChange={(sorts: WorkflowFindRecordsRecordSort[]) => {
                if (isFormDisabled === true) {
                  return;
                }

                const newFormData: FindRecordsFormData = {
                  ...formData,
                  orderBy: serializeWorkflowFindRecordsOrderBy({
                    recordSorts: sorts,
                    objectMetadataItem: selectedObjectMetadataItem,
                  }),
                };

                setFormData(newFormData);
                saveAction(newFormData);
              }}
              readonly={isFormDisabled}
            />
          </div>
        )}

        <FormNumberFieldInput
          label={t`Limit`}
          defaultValue={formData.limit}
          placeholder={t`Enter limit`}
          readonly={isFormDisabled}
          hint={t`This action can return up to ${QUERY_MAX_RECORDS.toLocaleString()} records.`}
          error={limitError}
          onChange={(limit) => {
            if (isFormDisabled === true || !isNumber(limit)) {
              return;
            }

            const normalizedLimit = Math.floor(limit);

            if (normalizedLimit <= 0) {
              setLimitError(t`Limit must be greater than 0.`);
              return;
            }

            const cappedLimit = Math.min(normalizedLimit, QUERY_MAX_RECORDS);

            setLimitError(
              normalizedLimit > QUERY_MAX_RECORDS
                ? t`Limit cannot exceed ${QUERY_MAX_RECORDS.toLocaleString()} records.`
                : undefined,
            );

            const newFormData: FindRecordsFormData = {
              ...formData,
              limit: cappedLimit,
            };

            setFormData(newFormData);
            saveAction(newFormData);
          }}
        />

        <FormNumberFieldInput
          label={t`Offset`}
          defaultValue={formData.offset}
          placeholder={t`Enter offset`}
          readonly={isFormDisabled}
          hint={t`Number of records to skip. Combine with Limit to page through results.`}
          error={offsetError}
          onChange={(offset) => {
            if (isFormDisabled === true || !isNumber(offset)) {
              return;
            }

            const normalizedOffset = Math.floor(offset);

            if (normalizedOffset < 0) {
              setOffsetError(t`Offset cannot be negative.`);
              return;
            }

            setOffsetError(undefined);

            const newFormData: FindRecordsFormData = {
              ...formData,
              offset: normalizedOffset,
            };

            setFormData(newFormData);
            saveAction(newFormData);
          }}
        />
      </WorkflowStepBody>
    </>
  );
};
