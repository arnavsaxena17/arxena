import { fieldMetadataItemByIdSelector } from '@/object-metadata/states/fieldMetadataItemByIdSelector';
import { formatFieldMetadataItemAsFieldDefinition } from '@/object-metadata/utils/formatFieldMetadataItemAsFieldDefinition';
import { AdvancedFilterSidePanelValueFormCompositeFieldInput } from '@/object-record/advanced-filter/side-panel/components/AdvancedFilterSidePanelValueFormCompositeFieldInput';
import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { getAdvancedFilterObjectFilterDropdownComponentInstanceId } from '@/object-record/advanced-filter/utils/getAdvancedFilterObjectFilterDropdownComponentInstanceId';
import { shouldShowFilterTextInput } from '@/object-record/advanced-filter/utils/shouldShowFilterTextInput';
import { useApplyObjectFilterDropdownFilterValue } from '@/object-record/object-filter-dropdown/hooks/useApplyObjectFilterDropdownFilterValue';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { configurableViewFilterOperands } from '@/object-record/object-filter-dropdown/utils/configurableViewFilterOperands';
import { FormFieldInput } from '@/object-record/record-field/components/FormFieldInput';
import { FormBooleanFieldInput } from '@/object-record/record-field/form-types/components/FormBooleanFieldInput';
import { FormDateFieldInput } from '@/object-record/record-field/form-types/components/FormDateFieldInput';
import { FormDateTimeFieldInput } from '@/object-record/record-field/form-types/components/FormDateTimeFieldInput';
import { FormMultiSelectFieldInput } from '@/object-record/record-field/form-types/components/FormMultiSelectFieldInput';
import { FormRelativeDatePicker } from '@/object-record/record-field/form-types/components/FormRelativeDatePicker';
import { FormSelectFieldInput } from '@/object-record/record-field/form-types/components/FormSelectFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/form-types/components/FormTextFieldInput';
import {
  type FieldMetadata,
  type FieldMultiSelectMetadata,
  type FieldSelectMetadata,
} from '@/object-record/record-field/types/FieldMetadata';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { RecordFilterOperand } from '@/object-record/record-filter/types/RecordFilterOperand';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { stringifyRelativeDateFilter } from '@/views/view-filter-value/utils/stringifyRelativeDateFilter';
import { isObject, isString } from '@sniptt/guards';
import { useContext } from 'react';
import { useRecoilValue } from 'recoil';
import { FieldMetadataType, isDefined, type RelativeDateFilter } from 'twenty-shared';
import { parseBooleanFromStringValue } from 'twenty-shared/workflow';
import { type JsonValue } from 'type-fest';

export const AdvancedFilterSidePanelValueFormInput = ({
  recordFilterId,
}: {
  recordFilterId: string;
}) => {
  const {
    readonly,
    VariablePicker,
    objectMetadataItem,
  } = useContext(AdvancedFilterContext);

  const currentRecordFilters = useRecoilComponentValueV2(
    currentRecordFiltersComponentState,
  );

  const dropdownInstanceId =
    getAdvancedFilterObjectFilterDropdownComponentInstanceId(recordFilterId);

  const subFieldNameUsedInDropdown = useRecoilComponentValueV2(
    subFieldNameUsedInDropdownComponentState,
    dropdownInstanceId,
  );

  const recordFilter = currentRecordFilters.find(
    (recordFilter) => recordFilter.id === recordFilterId,
  );

  const isDisabled = !recordFilter?.fieldMetadataId || !recordFilter.operand;

  const operandHasNoInput =
    (recordFilter &&
      !configurableViewFilterOperands.has(recordFilter.operand)) ??
    true;

  const { applyObjectFilterDropdownFilterValue } =
    useApplyObjectFilterDropdownFilterValue();

  const handlePersist = (newValue: JsonValue) => {
    if (isString(newValue)) {
      applyObjectFilterDropdownFilterValue(newValue);
    } else if (Array.isArray(newValue) || isObject(newValue)) {
      applyObjectFilterDropdownFilterValue(JSON.stringify(newValue));
    } else {
      applyObjectFilterDropdownFilterValue(String(newValue));
    }
  };

  const handleClear = () => {
    applyObjectFilterDropdownFilterValue('');
  };

  const handleRelativeDateFilterChange = (newValue: RelativeDateFilter) => {
    applyObjectFilterDropdownFilterValue(stringifyRelativeDateFilter(newValue));
  };

  const fieldMetadataItemUsedInDropdown = useRecoilComponentValueV2(
    fieldMetadataItemUsedInDropdownComponentSelector,
    dropdownInstanceId,
  );

  const {
    foundFieldMetadataItem: relationTargetFieldMetadataItem,
    foundObjectMetadataItem: relationTargetObjectMetadataItem,
  } = useRecoilValue(
    fieldMetadataItemByIdSelector({
      fieldMetadataItemId: recordFilter?.relationTargetFieldMetadataId ?? '',
    }),
  );

  const fieldMetadataItemForValueInput =
    relationTargetFieldMetadataItem ?? fieldMetadataItemUsedInDropdown;

  const objectMetadataItemForValueInput =
    relationTargetObjectMetadataItem ?? objectMetadataItem;

  const fieldDefinition = fieldMetadataItemForValueInput
    ? formatFieldMetadataItemAsFieldDefinition({
        field: fieldMetadataItemForValueInput,
        objectMetadataItem: objectMetadataItemForValueInput,
      })
    : null;

  if (!isDefined(recordFilter)) {
    return null;
  }

  const isFilterableByTextValue = shouldShowFilterTextInput({
    recordFilter,
    subFieldNameUsedInDropdown,
  });

  const isFilterableBySelectValue =
    recordFilter.type === FieldMetadataType.SELECT;

  const isFilterableByMultiSelectValue =
    recordFilter.type === FieldMetadataType.MULTI_SELECT;

  const isFilterableByDateValue =
    recordFilter.type === FieldMetadataType.DATE ||
    recordFilter.type === FieldMetadataType.DATE_TIME;

  const isRelativeDateFilter =
    isFilterableByDateValue &&
    recordFilter.operand === RecordFilterOperand.IsRelative;

  if (isDisabled || operandHasNoInput) {
    return null;
  }

  if (isRelativeDateFilter) {
    return (
      <FormRelativeDatePicker
        defaultValue={recordFilter.value}
        onChange={handleRelativeDateFilterChange}
        readonly={readonly}
        isDateTimeField={recordFilter.type === FieldMetadataType.DATE_TIME}
      />
    );
  }

  if (isFilterableByTextValue) {
    return (
      <FormTextFieldInput
        label=""
        placeholder=""
        defaultValue={recordFilter.value}
        onPersist={handlePersist}
        readonly={readonly}
        VariablePicker={VariablePicker}
      />
    );
  }

  if (isDefined(subFieldNameUsedInDropdown)) {
    return (
      <AdvancedFilterSidePanelValueFormCompositeFieldInput
        recordFilter={recordFilter}
        onPersist={handlePersist}
        onClear={handleClear}
      />
    );
  }

  if (isFilterableBySelectValue) {
    const metadata = fieldDefinition?.metadata as FieldSelectMetadata | undefined;

    return (
      <FormSelectFieldInput
        label=""
        defaultValue={recordFilter.value}
        onPersist={handlePersist}
        readonly={readonly}
        VariablePicker={VariablePicker}
        options={metadata?.options ?? []}
        placeholder=""
      />
    );
  }

  if (isFilterableByMultiSelectValue) {
    const metadata = fieldDefinition?.metadata as
      | FieldMultiSelectMetadata
      | undefined;

    return (
      <FormMultiSelectFieldInput
        label=""
        defaultValue={recordFilter.value}
        onPersist={handlePersist}
        readonly={readonly}
        VariablePicker={VariablePicker}
        options={metadata?.options ?? []}
      />
    );
  }

  if (recordFilter.type === FieldMetadataType.BOOLEAN) {
    const parsedValue = parseBooleanFromStringValue(recordFilter.value) as
      | boolean
      | undefined
      | string;

    return (
      <FormBooleanFieldInput
        label=""
        defaultValue={parsedValue}
        onPersist={handlePersist}
        readonly={readonly}
        VariablePicker={VariablePicker}
      />
    );
  }

  if (
    recordFilter.type === FieldMetadataType.DATE &&
    recordFilter.operand === RecordFilterOperand.Is
  ) {
    return (
      <FormDateFieldInput
        label=""
        defaultValue={recordFilter.value}
        onPersist={handlePersist}
        readonly={readonly}
        VariablePicker={VariablePicker}
      />
    );
  }

  if (
    recordFilter.type === FieldMetadataType.DATE_TIME &&
    recordFilter.operand === RecordFilterOperand.Is
  ) {
    return (
      <FormDateTimeFieldInput
        label=""
        defaultValue={recordFilter.value}
        onPersist={handlePersist}
        readonly={readonly}
        VariablePicker={VariablePicker}
      />
    );
  }

  const field = {
    type: recordFilter.type as FieldMetadataType,
    label: '',
    metadata: fieldDefinition?.metadata as FieldMetadata,
  };

  return (
    <FormFieldInput
      field={field}
      defaultValue={recordFilter.value}
      onPersist={handlePersist}
      readonly={readonly}
      VariablePicker={isFilterableByDateValue ? undefined : VariablePicker}
    />
  );
};
