import { MenuItem } from 'twenty-ui/navigation';
import { IconFileText, IconSparkles, IconVideo } from 'twenty-ui/icon';
import { Trans } from '@lingui/react/macro';
import { useId } from 'react';

import { useArxUploadJDModal } from '@/arx-jd-upload/hooks/useArxUploadJDModal';
import { DROPDOWN_OFFSET_Y } from '@/ui/layout/dropdown/constants/DropdownOffsetY';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { StyledHeaderDropdownButton } from '@/ui/layout/dropdown/components/StyledHeaderDropdownButton';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

const handleCreateEnrichments = () => {
  console.log('Action: Create Enrichments');
};

const handleUploadCV = () => {
  console.log('Action: Upload CV');
};

const handleCreateVideoInterview = () => {
  console.log('Action: Create Video Interview');
};

export const ChatOptionsDropdownButton = () => {
  const dropdownId = useId();
  const isDropdownOpen = useAtomComponentStateValue(
    isDropdownOpenComponentState,
    dropdownId,
  );
  const { openUploadJDModal } = useArxUploadJDModal();

  const handleUploadJD = () => {
    openUploadJDModal();
  };

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownStrategy="fixed"
      dropdownOffset={{ y: DROPDOWN_OFFSET_Y }}
      clickableComponent={
        <StyledHeaderDropdownButton isUnfolded={isDropdownOpen}>
          <Trans>Options</Trans>
        </StyledHeaderDropdownButton>
      }
      dropdownComponents={
        <DropdownContent widthInPixels={GenericDropdownContentWidth.Medium}>
          <MenuItem
            onClick={handleCreateEnrichments}
            text={<Trans>Create Enrichments</Trans>}
            LeftIcon={IconSparkles}
          />
          <MenuItem
            onClick={handleUploadJD}
            text={<Trans>Upload JD</Trans>}
            LeftIcon={IconFileText}
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
        </DropdownContent>
      }
    />
  );
};
