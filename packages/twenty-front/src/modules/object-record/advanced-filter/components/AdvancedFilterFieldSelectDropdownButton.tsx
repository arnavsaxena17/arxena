import { AdvancedFilterFieldSelectDropdownButtonClickableSelect } from '@/object-record/advanced-filter/components/AdvancedFilterFieldSelectDropdownButtonClickableSelect';
import { AdvancedFilterFieldSelectDropdownContent } from '@/object-record/advanced-filter/components/AdvancedFilterFieldSelectDropdownContent';
import { DEFAULT_ADVANCED_FILTER_DROPDOWN_OFFSET } from '@/object-record/advanced-filter/constants/DefaultAdvancedFilterDropdownOffset';
import { useAdvancedFilterFieldSelectDropdown } from '@/object-record/advanced-filter/hooks/useAdvancedFilterFieldSelectDropdown';

import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import styled from '@emotion/styled';
import { ADVANCED_FILTER_DROPDOWN_ID } from '@/views/constants/AdvancedFilterDropdownId';

const StyledContainer = styled.div`
  flex: 2;
`;

type AdvancedFilterFieldSelectDropdownButtonProps = {
  recordFilterId: string;
};

export const AdvancedFilterFieldSelectDropdownButton = ({
  recordFilterId,
}: AdvancedFilterFieldSelectDropdownButtonProps) => {
  const { advancedFilterFieldSelectDropdownId } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  return (
    <StyledContainer>
      <Dropdown
        dropdownId={advancedFilterFieldSelectDropdownId}
        dropdownHotkeyScope={{ scope: ADVANCED_FILTER_DROPDOWN_ID }}
        clickableComponent={
          <AdvancedFilterFieldSelectDropdownButtonClickableSelect
            recordFilterId={recordFilterId}
          />
        }
        dropdownComponents={
          <AdvancedFilterFieldSelectDropdownContent
            recordFilterId={recordFilterId}
          />
        }
        dropdownOffset={DEFAULT_ADVANCED_FILTER_DROPDOWN_OFFSET}
        dropdownPlacement="bottom-start"
      />
    </StyledContainer>
  );
};
