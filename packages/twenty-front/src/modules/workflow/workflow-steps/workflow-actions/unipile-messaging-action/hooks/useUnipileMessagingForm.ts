import { useState } from 'react';
import { type JsonValue } from 'type-fest';
import { useDebouncedCallback } from 'use-debounce';

type UseUnipileMessagingFormParams<TFormData extends Record<string, JsonValue>> =
  {
    initialFormData: TFormData;
    onSave: (formData: TFormData) => void;
    readonly: boolean;
  };

export const useUnipileMessagingForm = <
  TFormData extends Record<string, JsonValue>,
>({
  initialFormData,
  onSave,
  readonly,
}: UseUnipileMessagingFormParams<TFormData>) => {
  const [formData, setFormData] = useState<TFormData>(initialFormData);

  const saveAction = useDebouncedCallback((nextFormData: TFormData) => {
    if (readonly) {
      return;
    }

    onSave(nextFormData);
  }, 1_000);

  const handleFieldChange = (
    fieldName: keyof TFormData,
    updatedValue: JsonValue,
  ) => {
    const newFormData = {
      ...formData,
      [fieldName]: updatedValue,
    } as TFormData;

    setFormData(newFormData);
    saveAction(newFormData);
  };

  return {
    formData,
    handleFieldChange,
    saveAction,
  };
};
