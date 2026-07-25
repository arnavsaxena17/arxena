import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

export const BulkMessageModal = () => {
  const setIsBulkMessageModalOpen = useSetAtomState(isBulkMessageModalOpenState);

  return (
    <div>
      Bulk messaging UI is not yet migrated to the new modal system.
      <button type="button" onClick={() => setIsBulkMessageModalOpen(false)}>
        Close
      </button>
    </div>
  );
};
