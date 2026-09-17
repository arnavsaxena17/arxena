import { type FocusEventHandler, useEffect, useRef, useState } from 'react';
import { Key } from 'ts-key-enum';

import {
  TextInput,
  type TextInputComponentProps,
} from '@/ui/input/components/TextInput';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { isDefined } from 'twenty-shared/utils';

export type SettingsTextInputProps = TextInputComponentProps & {
  instanceId: string;
  disableHotkeys?: boolean;
  onInputEnter?: () => void;
  dataTestId?: string;
  autoFocusOnMount?: boolean;
  autoSelectOnMount?: boolean;
};

export const SettingsTextInput = ({
  instanceId,
  onFocus,
  onBlur,
  onInputEnter,
  disableHotkeys = false,
  autoFocusOnMount,
  autoSelectOnMount,
  dataTestId,
  ...props
}: SettingsTextInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (autoFocusOnMount === true) {
      inputRef.current?.focus();
      setIsFocused(true);
    }
  }, [autoFocusOnMount]);

  useEffect(() => {
    if (autoSelectOnMount === true) {
      inputRef.current?.select();
    }
  }, [autoSelectOnMount]);

  const handleFocus: FocusEventHandler<HTMLInputElement> = (event) => {
    onFocus?.(event);
    setIsFocused(true);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    onBlur?.(event);
    setIsFocused(false);
  };

  const handleEscape = () => {
    if (!isFocused) {
      return;
    }
    if (isDefined(inputRef) && 'current' in inputRef) {
      inputRef.current?.blur();
      setIsFocused(false);
    }
  };

  const handleEnter = () => {
    if (!isFocused) {
      return;
    }
    onInputEnter?.();
    if (isDefined(inputRef) && 'current' in inputRef) {
      setIsFocused(false);
    }
  };

  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: handleEscape,
    focusId: instanceId,
    dependencies: [handleEscape],
    options: {
      preventDefault: false,
    },
  });

  useHotkeysOnFocusedElement({
    keys: [Key.Enter],
    callback: handleEnter,
    focusId: instanceId,
    dependencies: [handleEnter],
    options: {
      preventDefault: false,
    },
  });

  return (
    <TextInput
      ref={inputRef}
      fullWidth
      // oxlint-disable-next-line react/jsx-props-no-spreading
      {...props}
      dataTestId={dataTestId}
      focusId={instanceId}
      disableHotkeys={disableHotkeys}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};
