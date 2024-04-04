import { IconArchiveOff, IconDotsVertical, IconTrash } from 'twenty-ui';

import { LightIconButton } from '@/ui/input/button/components/LightIconButton';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownMenu } from '@/ui/layout/dropdown/components/DropdownMenu';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { MenuItem } from '@/ui/navigation/menu-item/components/MenuItem';

type SettingsObjectFieldInactiveActionDropdownProps = {
  isCustomField?: boolean;
  isRelationType?: boolean;
  onActivate: () => void;
  onErase: () => void;
  scopeKey: string;
};

export const SettingsObjectFieldInactiveActionDropdown = ({
  onActivate,
  scopeKey,
  onErase,
  isCustomField,
  isRelationType,
}: SettingsObjectFieldInactiveActionDropdownProps) => {
  const dropdownId = `${scopeKey}-settings-field-disabled-action-dropdown`;

  const { closeDropdown } = useDropdown(dropdownId);

  const handleActivate = () => {
    onActivate();
    closeDropdown();
  };

  const handleErase = () => {
    onErase();
    closeDropdown();
  };

  const isErasable = isCustomField && !isRelationType;

  return (
    <Dropdown
      dropdownId={dropdownId}
      clickableComponent={
        <LightIconButton Icon={IconDotsVertical} accent="tertiary" />
      }
      dropdownComponents={
        <DropdownMenu width="160px">
          <DropdownMenuItemsContainer>
            <MenuItem
              text="Activate"
              LeftIcon={IconArchiveOff}
              onClick={handleActivate}
            />
            {isErasable && (
              <MenuItem
                text="Erase"
                accent="danger"
                LeftIcon={IconTrash}
                onClick={handleErase}
              />
            )}
          </DropdownMenuItemsContainer>
        </DropdownMenu>
      }
      dropdownHotkeyScope={{
        scope: dropdownId,
      }}
    />
  );
};
