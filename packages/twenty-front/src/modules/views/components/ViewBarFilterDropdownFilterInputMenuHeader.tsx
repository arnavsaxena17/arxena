import { useResetFilterDropdown } from '@/object-record/object-filter-dropdown/hooks/useResetFilterDropdown';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { isNonEmptyString } from '@sniptt/guards';
import { IconChevronLeft } from 'twenty-ui/icon';

export const ViewBarFilterDropdownFilterInputMenuHeader = () => {
  const fieldMetadataItemUsedInDropdown = useAtomComponentSelectorValue(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const subFieldNameUsedInDropdown = useAtomComponentStateValue(
    subFieldNameUsedInDropdownComponentState,
  );

  const { resetFilterDropdown } = useResetFilterDropdown();

  const handleBackButtonClick = () => {
    resetFilterDropdown();
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
          Icon={IconChevronLeft}
        />
      }
    >
      {headerLabel}
    </DropdownMenuHeader>
  );
};
