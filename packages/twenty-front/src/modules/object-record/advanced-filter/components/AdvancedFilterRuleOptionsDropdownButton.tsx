import { IconButton } from 'twenty-ui';
import { IconDotsVertical } from 'twenty-ui/icons';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';

type AdvancedFilterRuleOptionsDropdownButtonProps = {
  dropdownId: string;
};

export const AdvancedFilterRuleOptionsDropdownButton = ({
  dropdownId,
}: AdvancedFilterRuleOptionsDropdownButtonProps) => {
  const { toggleDropdown } = useDropdown(dropdownId);

  const handleClick = () => {
    toggleDropdown();
  };

  return (
    <IconButton
      aria-label="Filter rule options"
      variant="tertiary"
      Icon={IconDotsVertical}
      onClick={handleClick}
    />
  );
};
