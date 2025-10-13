import { useSelectedRecordId } from '@/action-menu/actions/record-actions/single-record/hooks/useSelectedRecordId';
import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { useDeleteFavorite } from '@/favorites/hooks/useDeleteFavorite';
import { useFavorites } from '@/favorites/hooks/useFavorites';
import { isDefined } from 'twenty-shared';

export const useRemoveFromFavoritesSingleRecordAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const recordId = useSelectedRecordId();

    const { sortedFavorites: favorites } = useFavorites();

    const { deleteFavorite } = useDeleteFavorite();

    const foundFavorite = favorites?.find(
      (favorite) => favorite.recordId === recordId,
    );

    const isFavorite = !!foundFavorite;

    const shouldBeRegistered =
      isDefined(objectMetadataItem) &&
      isDefined(recordId) &&
      !objectMetadataItem.isRemote &&
      isFavorite;

    const onClick = () => {
      if (!shouldBeRegistered || !foundFavorite) {
        return;
      }

      deleteFavorite(foundFavorite.id);
    };

    return {
      shouldBeRegistered,
      onClick,
    };
  };
