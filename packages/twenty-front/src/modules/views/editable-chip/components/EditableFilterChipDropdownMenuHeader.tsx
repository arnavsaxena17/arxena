import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { isNonEmptyString } from '@sniptt/guards';
import { IconX } from 'twenty-ui/icon';

export const EditableFilterChipDropdownMenuHeader = () => {
  const fieldMetadataItemUsedInDropdown = useAtomComponentSelectorValue(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const subFieldNameUsedInDropdown = useAtomComponentStateValue(
    subFieldNameUsedInDropdownComponentState,
  );

  const { closeDropdown } = useCloseDropdown();

  const handleBackButtonClick = () => {
    closeDropdown();
  };

  const headerLabel =
    isNonEmptyString(subFieldNameUsedInDropdown) &&
    isNonEmptyString(fieldMetadataItemUsedInDropdown?.label)
      ? `${fieldMetadataItemUsedInDropdown.label} / ${subFieldNameUsedInDropdown}`
      : fieldMetadataItemUsedInDropdown?.label;

  return (
    <DropdownMenuHeader
      StartComponent={
        <DropdownMenuHeaderLeftComponent
          onClick={handleBackButtonClick}
          Icon={IconX}
        />
      }
    >
      {headerLabel}
    </DropdownMenuHeader>
  );
};
