import { Trans } from '@lingui/react/macro';
import { useId } from 'react';
import {
  IconFileText,
  IconSparkles,
  IconVideo,
  MenuItem,
} from 'twenty-ui';

import { useArxUploadJDModal } from '@/arx-jd-upload/hooks/useArxUploadJDModal';
import { DROPDOWN_OFFSET_Y } from '@/dropdown/constants/DropdownOffsetY';
import { DROPDOWN_WIDTH } from '@/dropdown/constants/DropdownWidth';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { StyledHeaderDropdownButton } from '@/ui/layout/dropdown/components/StyledHeaderDropdownButton';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import {
  IconFileDescription,
} from '@tabler/icons-react';

// Define your specific actions here
const handleCreateEnrichments = () => {
  console.log('Action: Create Enrichments');
  // TODO: Implement action
};

const handleUploadCV = () => {
  console.log('Action: Upload CV');
  // TODO: Implement action
};

const handleCreateVideoInterview = () => {
  console.log('Action: Create Video Interview');
  // TODO: Implement action
};

export const ChatOptionsDropdownButton = () => {
  const dropdownId = useId(); // Generate a unique ID
  const { isDropdownOpen } = useDropdown(dropdownId);
  const { openUploadJDModal } = useArxUploadJDModal();

  const handleUploadJD = () => {
    openUploadJDModal();
  };

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownHotkeyScope={{ scope: 'ChatOptionsDropdown' }} // Placeholder scope
      dropdownMenuWidth={DROPDOWN_WIDTH}
      dropdownOffset={{ y: DROPDOWN_OFFSET_Y }}
      clickableComponent={
        <StyledHeaderDropdownButton isUnfolded={isDropdownOpen}>
          <Trans>Options</Trans>
        </StyledHeaderDropdownButton>
      }
      dropdownComponents={
        <>
          <MenuItem
            onClick={handleCreateEnrichments}
            text={<Trans>Create Enrichments</Trans>}
            LeftIcon={IconSparkles}
          />
          <MenuItem
            onClick={handleUploadJD}
            text={<Trans>Upload JD</Trans>}
            LeftIcon={IconFileDescription}
          />
          <MenuItem
            onClick={handleUploadCV}
            text={<Trans>Upload CV</Trans>}
            LeftIcon={IconFileText}
          />
          <MenuItem
            onClick={handleCreateVideoInterview}
            text={<Trans>Create Video Interview</Trans>}
            LeftIcon={IconVideo}
          />
        </>
      }
    />
  );
}; 