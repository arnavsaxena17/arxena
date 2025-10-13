import { useSelectedRecordId } from '@/action-menu/actions/record-actions/single-record/hooks/useSelectedRecordId';
import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { useCreateFavorite } from '@/favorites/hooks/useCreateFavorite';
import { useFavorites } from '@/favorites/hooks/useFavorites';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { isNull } from '@sniptt/guards';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useAddToFavoritesSingleRecordAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const recordId = useSelectedRecordId();

    const { sortedFavorites: favorites } = useFavorites();

    const { createFavorite } = useCreateFavorite();

    const selectedRecord = useRecoilValue(recordStoreFamilyState(recordId || '00000000-0000-0000-0000-000000000000'));

    const foundFavorite = favorites?.find(
      (favorite) => favorite.recordId === recordId,
    );

    const isFavorite = !!foundFavorite;

    const shouldBeRegistered =
      isDefined(objectMetadataItem) &&
      isDefined(recordId) &&
      isDefined(selectedRecord) &&
      !objectMetadataItem.isRemote &&
      !isFavorite &&
      isNull(selectedRecord.deletedAt);

    const onClick = () => {
      if (!shouldBeRegistered || !recordId || !selectedRecord) {
        return;
      }

      createFavorite(selectedRecord, objectMetadataItem.nameSingular);
    };

    return {
      shouldBeRegistered,
      onClick,
    };
  };
