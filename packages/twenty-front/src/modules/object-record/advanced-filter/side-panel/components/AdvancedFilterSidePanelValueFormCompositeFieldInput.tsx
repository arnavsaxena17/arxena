import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { FormCountryMultiSelectInput } from '@/object-record/record-field/form-types/components/FormCountryMultiSelectInput';
import { FormMultiSelectFieldInput } from '@/object-record/record-field/form-types/components/FormMultiSelectFieldInput';
import { FormNumberFieldInput } from '@/object-record/record-field/form-types/components/FormNumberFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/form-types/components/FormTextFieldInput';
import { FormWorkspaceMemberFilterValueInput } from '@/object-record/record-field/form-types/components/FormWorkspaceMemberFilterValueInput';
import { FieldActorSource } from '@/object-record/record-field/types/FieldMetadata';

import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { CURRENCIES } from '@/settings/data-model/constants/Currencies';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useContext } from 'react';
import { type SelectOption } from '@/ui/input/components/Select';
import { type JsonValue } from 'type-fest';

const ACTOR_SOURCE_OPTIONS: SelectOption<string>[] = Object.values(
  FieldActorSource,
).map((source) => ({
  label: source.charAt(0) + source.slice(1).toLowerCase(),
  value: source,
}));

export const AdvancedFilterSidePanelValueFormCompositeFieldInput = ({
  recordFilter,
  onPersist,
  onClear,
}: {
  recordFilter: RecordFilter;
  onPersist: (newValue: JsonValue) => void;
  onClear: () => void;
}) => {
  const { VariablePicker } = useContext(AdvancedFilterContext);

  const subFieldNameUsedInDropdown = useRecoilComponentValueV2(
    subFieldNameUsedInDropdownComponentState,
  );

  const filterType = recordFilter.type;

  const { readonly } = useContext(AdvancedFilterContext);

  return (
    <>
      {filterType === 'ADDRESS' ? (
        subFieldNameUsedInDropdown === 'addressCountry' ? (
          <FormCountryMultiSelectInput
            defaultValue={recordFilter.value}
            onChange={onPersist}
            VariablePicker={VariablePicker}
            readonly={readonly}
          />
        ) : (
          <FormTextFieldInput
            label=""
            placeholder=""
            defaultValue={recordFilter.value}
            onPersist={onPersist}
            VariablePicker={VariablePicker}
            readonly={readonly}
          />
        )
      ) : filterType === 'CURRENCY' ? (
        recordFilter.subFieldName === 'currencyCode' ? (
          <FormMultiSelectFieldInput
            defaultValue={recordFilter.value}
            onPersist={onPersist}
            VariablePicker={VariablePicker}
            options={CURRENCIES}
            readonly={readonly}
          />
        ) : recordFilter.subFieldName === 'amountMicros' ? (
          <FormNumberFieldInput
            label=""
            defaultValue={recordFilter.value}
            onPersist={onPersist}
            VariablePicker={VariablePicker}
            readonly={readonly}
          />
        ) : null
      ) : filterType === 'PHONES' ? (
        recordFilter.subFieldName === 'primaryPhoneNumber' ? (
          <FormNumberFieldInput
            label=""
            defaultValue={recordFilter.value}
            onPersist={onPersist}
            VariablePicker={VariablePicker}
            readonly={readonly}
          />
        ) : (
          <FormTextFieldInput
            label=""
            placeholder=""
            defaultValue={recordFilter.value}
            onPersist={onPersist}
            VariablePicker={VariablePicker}
            readonly={readonly}
          />
        )
      ) : filterType === 'ACTOR' ? (
        recordFilter.subFieldName === 'source' ? (
          <FormMultiSelectFieldInput
            defaultValue={recordFilter.value}
            onPersist={onPersist}
            options={ACTOR_SOURCE_OPTIONS}
            readonly={readonly}
            VariablePicker={VariablePicker}
          />
        ) : recordFilter.subFieldName === 'workspaceMemberId' ? (
          <FormWorkspaceMemberFilterValueInput
            defaultValue={recordFilter.value}
            onChange={onPersist}
            onClear={onClear}
            VariablePicker={VariablePicker}
            readonly={readonly}
          />
        ) : (
          <FormTextFieldInput
            label=""
            placeholder=""
            defaultValue={recordFilter.value}
            onPersist={onPersist}
            VariablePicker={VariablePicker}
            readonly={readonly}
          />
        )
      ) : (
        <FormTextFieldInput
          label=""
          placeholder=""
          defaultValue={recordFilter.value}
          onPersist={onPersist}
          VariablePicker={VariablePicker}
          readonly={readonly}
        />
      )}
    </>
  );
};
