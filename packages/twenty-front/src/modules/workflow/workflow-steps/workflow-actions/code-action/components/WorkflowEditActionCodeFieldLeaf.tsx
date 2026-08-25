import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { FormArrayFieldInput } from '@/object-record/record-field/ui/form-types/components/FormArrayFieldInput';
import { FormBooleanFieldInput } from '@/object-record/record-field/ui/form-types/components/FormBooleanFieldInput';
import { FormMultiRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormMultiRecordPicker';
import { FormLinkedInParameterAutocomplete } from '@/workflow/workflow-steps/workflow-actions/form-action/components/FormLinkedInParameterAutocomplete';
import { FormNumberFieldInput } from '@/object-record/record-field/ui/form-types/components/FormNumberFieldInput';
import { FormSelectFieldInput } from '@/object-record/record-field/ui/form-types/components/FormSelectFieldInput';
import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type VariablePickerComponent } from '@/object-record/record-field/ui/form-types/types/VariablePickerComponent';
import { type FieldArrayValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { isStandaloneVariableString } from '@/workflow/utils/isStandaloneVariableString';
import { getWorkflowCodeFieldsEnumSelectOptions } from '@/workflow/workflow-steps/workflow-actions/code-action/utils/getWorkflowCodeFieldsEnumSelectOptions';
import { getWorkflowCodeFieldsLeafKind } from '@/workflow/workflow-steps/workflow-actions/code-action/utils/getWorkflowCodeFieldsLeafKind';
import { t } from '@lingui/core/macro';
import {
  isBoolean,
  isNonEmptyArray,
  isNonEmptyString,
  isNull,
  isNumber,
  isString,
} from '@sniptt/guards';
import { isDefined, isPlainObject } from 'twenty-shared/utils';
import { type InputSchemaProperty } from 'twenty-shared/workflow';

const RECORD_PICKER_OBJECT_NAME_BY_ID_LABEL: Record<string, string> = {
  'Project ID': 'project',
  'Company ID': 'company',
};

type WorkflowEditActionCodeFieldLeafProps = {
  label: string;
  inputValue: unknown;
  schemaProperty?: InputSchemaProperty;
  readonly?: boolean;
  onChange: (value: unknown) => void;
  VariablePicker?: VariablePickerComponent;
};

export const WorkflowEditActionCodeFieldLeaf = ({
  label,
  inputValue,
  schemaProperty,
  readonly,
  onChange,
  VariablePicker,
}: WorkflowEditActionCodeFieldLeafProps) => {
  const { objectMetadataItems } = useObjectMetadataItems();

  const leafKind = getWorkflowCodeFieldsLeafKind(schemaProperty);
  const recordNameSingularFromIdLabel =
    leafKind === 'text'
      ? RECORD_PICKER_OBJECT_NAME_BY_ID_LABEL[label]
      : undefined;
  const isRecordIdTextField = isNonEmptyString(recordNameSingularFromIdLabel);

  if (
    leafKind === 'record' ||
    leafKind === 'record-array' ||
    isRecordIdTextField
  ) {
    const objectUniversalIdentifier =
      schemaProperty?.objectUniversalIdentifier ??
      schemaProperty?.items?.objectUniversalIdentifier;
    const objectNameSingular =
      schemaProperty?.objectNameSingular ??
      schemaProperty?.items?.objectNameSingular ??
      recordNameSingularFromIdLabel;

    const recordObjectMetadataItem = objectMetadataItems.find(
      (objectMetadataItem) =>
        (isNonEmptyString(objectUniversalIdentifier) &&
          objectMetadataItem.universalIdentifier ===
            objectUniversalIdentifier) ||
        (isNonEmptyString(objectNameSingular) &&
          objectMetadataItem.nameSingular === objectNameSingular),
    );

    if (isDefined(recordObjectMetadataItem)) {
      if (leafKind === 'record' || isRecordIdTextField) {
        return (
          <FormSingleRecordPicker
            label={label}
            defaultValue={isNonEmptyString(inputValue) ? inputValue : undefined}
            onChange={onChange}
            objectNameSingulars={[recordObjectMetadataItem.nameSingular]}
            disabled={readonly}
            VariablePicker={VariablePicker}
            shouldDisplayRecordFieldsInVariablePicker={true}
          />
        );
      }

      return (
        <FormMultiRecordPicker
          label={label}
          defaultValue={
            Array.isArray(inputValue) ||
            isString(inputValue) ||
            isNull(inputValue)
              ? inputValue
              : undefined
          }
          onChange={onChange}
          objectNameSingular={recordObjectMetadataItem.nameSingular}
          readonly={readonly}
          VariablePicker={VariablePicker}
        />
      );
    }
  }

  if (leafKind === 'json') {
    const jsonDefaultValue = isStandaloneVariableString(inputValue)
      ? inputValue
      : Array.isArray(inputValue) || isPlainObject(inputValue)
        ? JSON.stringify(inputValue, null, 2)
        : isDefined(inputValue)
          ? `${inputValue}`
          : '';

    return (
      <FormTextFieldInput
        label={label}
        placeholder={t`Paste a JSON array`}
        defaultValue={jsonDefaultValue}
        readonly={readonly}
        onChange={(value) => {
          if (isStandaloneVariableString(value)) {
            onChange(value);

            return;
          }

          const trimmed = value.trim();

          if (trimmed === '') {
            onChange([]);

            return;
          }

          try {
            onChange(JSON.parse(trimmed));
          } catch {
            onChange(value);
          }
        }}
        VariablePicker={VariablePicker}
        multiline={schemaProperty?.multiline !== false}
      />
    );
  }

  if (leafKind === 'array') {
    return (
      <FormArrayFieldInput
        label={label}
        defaultValue={
          Array.isArray(inputValue) || isStandaloneVariableString(inputValue)
            ? (inputValue as FieldArrayValue | string)
            : undefined
        }
        onChange={onChange}
        readonly={readonly}
        VariablePicker={VariablePicker}
      />
    );
  }

  if (leafKind === 'boolean') {
    return (
      <FormBooleanFieldInput
        label={label}
        defaultValue={
          isBoolean(inputValue) || isStandaloneVariableString(inputValue)
            ? inputValue
            : undefined
        }
        readonly={readonly}
        onChange={onChange}
        VariablePicker={VariablePicker}
      />
    );
  }

  if (leafKind === 'linkedin-parameter' && isDefined(schemaProperty?.linkedinParameterType)) {
    return (
      <FormLinkedInParameterAutocomplete
        label={label}
        defaultValue={isNonEmptyString(inputValue) ? inputValue : undefined}
        onChange={onChange}
        parameterType={schemaProperty.linkedinParameterType}
        readonly={readonly}
        VariablePicker={VariablePicker}
      />
    );
  }

  if (leafKind === 'number') {
    return (
      <FormNumberFieldInput
        label={label}
        defaultValue={
          isNumber(inputValue) || isString(inputValue) ? inputValue : undefined
        }
        readonly={readonly}
        onChange={onChange}
        VariablePicker={VariablePicker}
      />
    );
  }

  if (leafKind === 'enum' && isDefined(schemaProperty)) {
    const enumOptions = getWorkflowCodeFieldsEnumSelectOptions(schemaProperty);

    if (isNonEmptyArray(enumOptions)) {
      return (
        <FormSelectFieldInput
          label={label}
          defaultValue={
            !isDefined(inputValue)
              ? undefined
              : isString(inputValue)
                ? inputValue
                : String(inputValue)
          }
          readonly={readonly}
          onChange={onChange}
          VariablePicker={VariablePicker}
          options={enumOptions}
        />
      );
    }
  }

  return (
    <FormTextFieldInput
      label={label}
      placeholder={t`Enter value`}
      defaultValue={isDefined(inputValue) ? `${inputValue}` : ''}
      readonly={readonly}
      onChange={onChange}
      VariablePicker={VariablePicker}
      multiline={schemaProperty?.multiline === true}
    />
  );
};
