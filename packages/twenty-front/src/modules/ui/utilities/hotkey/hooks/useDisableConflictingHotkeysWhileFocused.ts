import { type FocusEventHandler, useCallback } from 'react';

import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';

// Page go-to sequences (`g` then …) call preventDefault; disable them while typing.
export const useDisableConflictingHotkeysWhileFocused = (focusId: string) => {
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

  const onFocus = useCallback<FocusEventHandler<HTMLElement>>(() => {
    pushFocusItemToFocusStack({
      focusId,
      component: {
        type: FocusComponentType.TEXT_INPUT,
        instanceId: focusId,
      },
      globalHotkeysConfig: {
        enableGlobalHotkeysConflictingWithKeyboard: false,
      },
    });
  }, [focusId, pushFocusItemToFocusStack]);

  const onBlur = useCallback<FocusEventHandler<HTMLElement>>(
    (event) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return;
      }

      removeFocusItemFromFocusStackById({ focusId });
    },
    [focusId, removeFocusItemFromFocusStackById],
  );

  return { onFocus, onBlur };
};
