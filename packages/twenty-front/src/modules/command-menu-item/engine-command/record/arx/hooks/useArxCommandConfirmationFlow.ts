import { useUnmountCommand } from '@/command-menu-item/engine-command/hooks/useUnmountEngineCommand';
import { CommandComponentInstanceContext } from '@/command-menu-item/engine-command/states/contexts/CommandComponentInstanceContext';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useCallback, useEffect, useState } from 'react';

export const useArxCommandConfirmationFlow = (modalInstanceId: string) => {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const { openModal } = useModal();
  const unmountCommand = useUnmountCommand();
  const commandMenuItemId = useAvailableComponentInstanceIdOrThrow(
    CommandComponentInstanceContext,
  );

  useEffect(() => {
    openModal(modalInstanceId);
  }, [modalInstanceId, openModal]);

  const handleCancel = useCallback(() => {
    unmountCommand(commandMenuItemId);
  }, [commandMenuItemId, unmountCommand]);

  const handleConfirm = useCallback(() => {
    setIsConfirmed(true);
  }, []);

  return {
    isConfirmed,
    handleCancel,
    handleConfirm,
    commandMenuItemId,
  };
};
