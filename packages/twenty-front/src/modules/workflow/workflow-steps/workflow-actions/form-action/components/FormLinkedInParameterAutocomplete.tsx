import { FormFieldInputContainer } from '@/object-record/record-field/ui/form-types/components/FormFieldInputContainer';
import { type VariablePickerComponent } from '@/object-record/record-field/ui/form-types/types/VariablePickerComponent';
import { Select } from '@/ui/input/components/Select';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useLinkedInSearchParameters } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/hooks/useLinkedInSearchParameters';
import { t } from '@lingui/core/macro';
import { useId, useMemo, useState } from 'react';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type LinkedInParameterType } from 'twenty-shared/workflow';
import { type SelectOption } from 'twenty-ui/input';
import { useDebouncedCallback } from 'use-debounce';

type FormLinkedInParameterAutocompleteProps = {
  label: string;
  defaultValue: string | undefined;
  onChange: (value: unknown) => void;
  parameterType: LinkedInParameterType;
  readonly?: boolean;
  VariablePicker?: VariablePickerComponent;
};

export const FormLinkedInParameterAutocomplete = ({
  label,
  defaultValue,
  onChange,
  parameterType,
  readonly,
}: FormLinkedInParameterAutocompleteProps) => {
  const instanceId = useId();
  const { searchParameters } = useLinkedInSearchParameters();
  const [options, setOptions] = useState<SelectOption<string>[]>([]);

  const emptyOption: SelectOption<string> = useMemo(
    () => ({
      label: t`Search a value`,
      value: '',
    }),
    [],
  );

  const mergedOptions = useMemo(() => {
    const selected = isNonEmptyString(defaultValue)
      ? [{ label: defaultValue, value: defaultValue }]
      : [];
    const fetched = options.filter((option) => option.value !== defaultValue);

    return [emptyOption, ...selected, ...fetched];
  }, [defaultValue, emptyOption, options]);

  const loadOptions = useDebouncedCallback(async (keywords: string) => {
    try {
      const items = await searchParameters({
        type: parameterType,
        keywords,
      });
      setOptions(
        items.map((item) => ({
          label: item.title,
          value: item.title,
        })),
      );
    } catch {
      setOptions([]);
    }
  }, 300);

  return (
    <FormFieldInputContainer>
      <Select
        dropdownId={`${instanceId}-linkedin-parameter`}
        label={label}
        fullWidth
        withSearchInput
        disableClientFilter
        disabled={readonly}
        emptyOption={emptyOption}
        options={mergedOptions}
        value={isDefined(defaultValue) ? defaultValue : ''}
        dropdownWidth={GenericDropdownContentWidth.ExtraLarge}
        onDropdownOpen={() => {
          void loadOptions('');
        }}
        onSearchChange={(keywords) => {
          void loadOptions(keywords);
        }}
        onChange={(value) => {
          onChange(value || '');
        }}
      />
    </FormFieldInputContainer>
  );
};
