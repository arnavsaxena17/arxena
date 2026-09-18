import { isDefined } from 'twenty-shared/utils';

import { type CommandMenuItemOverrides } from 'src/engine/metadata-modules/command-menu-item/entities/command-menu-item.entity';
import { type FlatCommandMenuItem } from 'src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatEntityToCreateDeleteUpdate } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-to-create-delete-update.type';

const getEffectiveIsPinned = (
  flatCommandMenuItem: FlatCommandMenuItem,
): boolean =>
  flatCommandMenuItem.overrides?.isPinned ?? flatCommandMenuItem.isPinned;

const clearIsPinnedOverride = (
  overrides: CommandMenuItemOverrides | null | undefined,
): CommandMenuItemOverrides | null => {
  if (!isDefined(overrides) || !('isPinned' in overrides)) {
    return overrides ?? null;
  }

  const { isPinned: _removedIsPinned, ...remainingOverrides } = overrides;

  return Object.keys(remainingOverrides).length > 0 ? remainingOverrides : null;
};

// Heals workspace command-menu isPinned drift vs Twenty Standard / ARX seeds.
// Clears overrides.isPinned so the effective value matches the seed.
export const buildCommandMenuItemIsPinnedSyncOperations = ({
  existingFlatCommandMenuItemMaps,
  standardFlatCommandMenuItemMaps,
  now,
}: {
  existingFlatCommandMenuItemMaps: FlatEntityMaps<FlatCommandMenuItem>;
  standardFlatCommandMenuItemMaps: FlatEntityMaps<FlatCommandMenuItem>;
  now: string;
}): FlatEntityToCreateDeleteUpdate<'commandMenuItem'> => {
  const flatEntityToUpdate = Object.values(
    standardFlatCommandMenuItemMaps.byUniversalIdentifier,
  )
    .filter(isDefined)
    .map((standardItem) => {
      const existingItem =
        existingFlatCommandMenuItemMaps.byUniversalIdentifier[
          standardItem.universalIdentifier
        ];

      if (!isDefined(existingItem)) {
        return undefined;
      }

      const effectiveIsPinned = getEffectiveIsPinned(existingItem);
      const hasIsPinnedOverride = isDefined(existingItem.overrides?.isPinned);

      if (
        effectiveIsPinned === standardItem.isPinned &&
        existingItem.isPinned === standardItem.isPinned &&
        hasIsPinnedOverride === false
      ) {
        return undefined;
      }

      return {
        ...existingItem,
        isPinned: standardItem.isPinned,
        overrides: clearIsPinnedOverride(existingItem.overrides),
        updatedAt: now,
      };
    })
    .filter(isDefined);

  return {
    flatEntityToCreate: [],
    flatEntityToDelete: [],
    flatEntityToUpdate,
  };
};
