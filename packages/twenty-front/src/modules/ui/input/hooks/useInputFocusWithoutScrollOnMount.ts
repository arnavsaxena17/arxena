import { useEffect, useRef } from 'react';
import { isDefined } from 'twenty-shared';

export const useInputFocusWithoutScrollOnMount = (shouldFocus = true) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDefined(inputRef.current) && shouldFocus) {
      inputRef.current.focus({ preventScroll: true });
    }
  });

  return { inputRef };
};
