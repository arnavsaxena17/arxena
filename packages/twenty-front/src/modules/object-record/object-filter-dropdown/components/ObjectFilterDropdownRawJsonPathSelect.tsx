import { useApplyObjectFilterDropdownRawJsonPath } from '@/object-record/object-filter-dropdown/hooks/useApplyObjectFilterDropdownRawJsonPath';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { DropdownMenuInnerSelect } from '@/ui/layout/dropdown/components/DropdownMenuInnerSelect';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { t } from '@lingui/core/macro';
import { useMemo } from 'react';
import { getKnownRawJsonPathKeysForField, isDefined } from 'twenty-shared/utils';
import { type SelectOption } from 'twenty-ui/input';

const OBJECT_FILTER_DROPDOWN_RAW_JSON_PATH_DROPDOWN_ID =
  'object-filter-dropdown-raw-json-path-dropdown';

const WHOLE_FIELD_OPTION_VALUE = '__whole_field__';

export const ObjectFilterDropdownRawJsonPathSelect = () => {
  const fieldMetadataItemUsedInDropdown = useAtomComponentSelectorValue(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const subFieldNameUsedInDropdown = useAtomComponentStateValue(
    subFieldNameUsedInDropdownComponentState,
  );

  const { applyObjectFilterDropdownRawJsonPath } =
    useApplyObjectFilterDropdownRawJsonPath();

  const knownPathKeys = useMemo(
    () =>
      getKnownRawJsonPathKeysForField(
        fieldMetadataItemUsedInDropdown?.name ?? '',
      ) ?? [],
    [fieldMetadataItemUsedInDropdown?.name],
  );

  const options = useMemo(() => {
    const pathOptions: SelectOption[] = knownPathKeys.map((pathKey) => ({
      label: pathKey,
      value: pathKey,
    }));

    return [
      {
        label: t`Entire JSON field`,
        value: WHOLE_FIELD_OPTION_VALUE,
      },
      ...pathOptions,
    ];
  }, [knownPathKeys]);

  const selectedOption =
    options.find((option) =>
      isDefined(subFieldNameUsedInDropdown)
        ? option.value === subFieldNameUsedInDropdown
        : option.value === WHOLE_FIELD_OPTION_VALUE,
    ) ?? options[0];

  const handlePathChange = (newPathOption: SelectOption) => {
    if (newPathOption.value === WHOLE_FIELD_OPTION_VALUE) {
      applyObjectFilterDropdownRawJsonPath(null);
      return;
    }

    applyObjectFilterDropdownRawJsonPath(newPathOption.value);
  };

  if (!isDefined(fieldMetadataItemUsedInDropdown)) {
    return null;
  }

  return (
    <DropdownMenuInnerSelect
      dropdownId={OBJECT_FILTER_DROPDOWN_RAW_JSON_PATH_DROPDOWN_ID}
      selectedOption={selectedOption}
      onChange={handlePathChange}
      options={options}
      widthInPixels={GenericDropdownContentWidth.ExtraLarge}
    />
  );
};
