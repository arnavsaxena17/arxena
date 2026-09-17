import { useEffect } from 'react';

import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';

// For custom modals / HOT menus that stay open while typing in nested inputs.
export const useDisableConflictingHotkeysWhileActive = ({
  focusId,
  isActive,
  componentType = FocusComponentType.MODAL,
}: {
  focusId: string;
  isActive: boolean;
  componentType?: FocusComponentType;
}) => {
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

  useEffect(() => {
    if (!isActive) {
      return;
    }

    pushFocusItemToFocusStack({
      focusId,
      component: {
        type: componentType,
        instanceId: focusId,
      },
      globalHotkeysConfig: {
        enableGlobalHotkeysConflictingWithKeyboard: false,
      },
    });

    return () => {
      removeFocusItemFromFocusStackById({ focusId });
    };
  }, [
    componentType,
    focusId,
    isActive,
    pushFocusItemToFocusStack,
    removeFocusItemFromFocusStackById,
  ]);
};
