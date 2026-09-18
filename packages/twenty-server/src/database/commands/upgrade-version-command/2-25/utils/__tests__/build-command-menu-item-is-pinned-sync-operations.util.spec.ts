import { CommandMenuItemAvailabilityType } from 'src/engine/metadata-modules/command-menu-item/enums/command-menu-item-availability-type.enum';
import { EngineComponentKey } from 'src/engine/metadata-modules/command-menu-item/enums/engine-component-key.enum';
import { type FlatCommandMenuItem } from 'src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { buildCommandMenuItemIsPinnedSyncOperations } from 'src/database/commands/upgrade-version-command/2-25/utils/build-command-menu-item-is-pinned-sync-operations.util';

const NOW = '2026-09-18T00:00:00.000Z';
const UNIVERSAL_IDENTIFIER = '7d45fedf-267c-53b1-844a-4ee59726f87a';

const buildFlatCommandMenuItem = ({
  isPinned,
  overrides = null,
}: {
  isPinned: boolean;
  overrides?: FlatCommandMenuItem['overrides'];
}): FlatCommandMenuItem => ({
  id: 'command-menu-item-id',
  universalIdentifier: UNIVERSAL_IDENTIFIER,
  applicationId: 'application-id',
  applicationUniversalIdentifier: 'application-universal-identifier',
  workspaceId: 'workspace-id',
  workflowVersionId: null,
  frontComponentId: null,
  frontComponentUniversalIdentifier: null,
  engineComponentKey:
    EngineComponentKey.ARX_UPDATE_SNAPSHOT_PROFILES_FROM_JOB_BOARDS,
  label: 'Save Resumes & Contacts from Portals',
  icon: 'IconRefresh',
  shortLabel: 'Save Resumes & Contacts from Portals',
  position: 211,
  isPinned,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  conditionalAvailabilityExpression: null,
  availabilityObjectMetadataId: null,
  availabilityObjectMetadataUniversalIdentifier: null,
  payload: null,
  hotKeys: null,
  pageLayoutId: null,
  pageLayoutUniversalIdentifier: null,
  isActive: true,
  isSystemSideEffect: false,
  overrides,
  universalOverrides: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const buildFlatCommandMenuItemMaps = (
  flatCommandMenuItems: FlatCommandMenuItem[],
): FlatEntityMaps<FlatCommandMenuItem> => ({
  byUniversalIdentifier: Object.fromEntries(
    flatCommandMenuItems.map((flatCommandMenuItem) => [
      flatCommandMenuItem.universalIdentifier,
      flatCommandMenuItem,
    ]),
  ),
  universalIdentifierById: Object.fromEntries(
    flatCommandMenuItems.map((flatCommandMenuItem) => [
      flatCommandMenuItem.id,
      flatCommandMenuItem.universalIdentifier,
    ]),
  ),
  universalIdentifiersByApplicationId: {
    'application-id': flatCommandMenuItems.map(
      (flatCommandMenuItem) => flatCommandMenuItem.universalIdentifier,
    ),
  },
});

describe('buildCommandMenuItemIsPinnedSyncOperations', () => {
  it('updates base isPinned when workspace still has the old pinned value', () => {
    const existingItem = buildFlatCommandMenuItem({ isPinned: true });
    const standardItem = buildFlatCommandMenuItem({ isPinned: false });

    const result = buildCommandMenuItemIsPinnedSyncOperations({
      existingFlatCommandMenuItemMaps: buildFlatCommandMenuItemMaps([
        existingItem,
      ]),
      standardFlatCommandMenuItemMaps: buildFlatCommandMenuItemMaps([
        standardItem,
      ]),
      now: NOW,
    });

    expect(result.flatEntityToUpdate).toHaveLength(1);
    expect(result.flatEntityToUpdate[0]?.isPinned).toBe(false);
    expect(result.flatEntityToUpdate[0]?.overrides).toBeNull();
  });

  it('clears overrides.isPinned so the effective value matches the seed', () => {
    const existingItem = buildFlatCommandMenuItem({
      isPinned: false,
      overrides: { isPinned: true },
    });
    const standardItem = buildFlatCommandMenuItem({ isPinned: false });

    const result = buildCommandMenuItemIsPinnedSyncOperations({
      existingFlatCommandMenuItemMaps: buildFlatCommandMenuItemMaps([
        existingItem,
      ]),
      standardFlatCommandMenuItemMaps: buildFlatCommandMenuItemMaps([
        standardItem,
      ]),
      now: NOW,
    });

    expect(result.flatEntityToUpdate).toHaveLength(1);
    expect(result.flatEntityToUpdate[0]?.isPinned).toBe(false);
    expect(result.flatEntityToUpdate[0]?.overrides).toBeNull();
  });

  it('does nothing when effective isPinned already matches the seed', () => {
    const existingItem = buildFlatCommandMenuItem({ isPinned: false });
    const standardItem = buildFlatCommandMenuItem({ isPinned: false });

    const result = buildCommandMenuItemIsPinnedSyncOperations({
      existingFlatCommandMenuItemMaps: buildFlatCommandMenuItemMaps([
        existingItem,
      ]),
      standardFlatCommandMenuItemMaps: buildFlatCommandMenuItemMaps([
        standardItem,
      ]),
      now: NOW,
    });

    expect(result.flatEntityToUpdate).toHaveLength(0);
  });
});
