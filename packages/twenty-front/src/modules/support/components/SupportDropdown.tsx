import { SupportButton } from '@/support/components/SupportButton';
import { useSupportChat } from '@/support/hooks/useSupportChat';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { IconHelpCircle, IconMessage, MenuItem } from 'twenty-ui';

export const SupportDropdown = () => {
  const dropdownId = `support-field-active-action-dropdown`;

  const { closeDropdown } = useDropdown(dropdownId);
  const { openSupportChat } = useSupportChat();

  const handleTalkToUs = () => {
    openSupportChat();
    closeDropdown();
  };

  const handleUserGuide = () => {
    window.open('https://arxena.com/user-guide', '_blank');
    closeDropdown();
  };

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownPlacement="top-start"
      dropdownOffset={{ x: 0, y: -28 }}
      clickableComponent={<SupportButton />}
      dropdownMenuWidth={160}
      dropdownComponents={
        <DropdownMenuItemsContainer>
          <MenuItem
            text="Talk to us"
            LeftIcon={IconMessage}
            onClick={handleTalkToUs}
          />
          <MenuItem
            text="Documentation"
            LeftIcon={IconHelpCircle}
            onClick={handleUserGuide}
          />
        </DropdownMenuItemsContainer>
      }
      dropdownHotkeyScope={{ scope: dropdownId }}
    />
  );
};
