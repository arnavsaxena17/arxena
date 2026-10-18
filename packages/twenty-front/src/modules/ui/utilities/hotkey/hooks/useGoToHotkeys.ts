import { type Keys } from 'react-hotkeys-hook/dist/types';
import { useNavigate } from 'react-router-dom';

import { useGlobalHotkeysSequence } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeysSequence';

type GoToHotkeysProps = {
  key: Keys;
  location: string;
  preNavigateFunction?: () => void;
};

export const useGoToHotkeys = ({
  key,
  location,
  preNavigateFunction,
}: GoToHotkeysProps) => {
  const navigate = useNavigate();

  useGlobalHotkeysSequence(
    'g',
    key,
    () => {
      preNavigateFunction?.();
      navigate(location);
    },
    {
      // navigation must not fire while the user is typing in an input
      enableOnContentEditable: false,
      enableOnFormTags: false,
      preventDefault: true,
    },
    [navigate],
  );
};
