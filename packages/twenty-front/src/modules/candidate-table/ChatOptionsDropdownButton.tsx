import { Trans } from '@lingui/react/macro';
import { useId } from 'react';
import { IconFileText, IconSparkles } from 'twenty-ui/icon';
import { MenuItem } from 'twenty-ui/navigation';

import { useArxEnrichCreationModal } from '@/arx-ai-filtering/hooks/useArxEnrichCreationModal';
import { useArxUploadJDModal } from '@/arx-jd-upload/hooks/useArxUploadJDModal';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { StyledHeaderDropdownButton } from '@/ui/layout/dropdown/components/StyledHeaderDropdownButton';
import { DROPDOWN_OFFSET_Y } from '@/ui/layout/dropdown/constants/DropdownOffsetY';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

type ChatOptionsDropdownButtonProps = {
  onUploadCV?: () => void;
};

export const ChatOptionsDropdownButton = ({
  onUploadCV,
}: ChatOptionsDropdownButtonProps) => {
  const dropdownId = useId();
  const isDropdownOpen = useAtomComponentStateValue(
    isDropdownOpenComponentState,
    dropdownId,
  );
  const { closeDropdown } = useCloseDropdown();
  const { openUploadJDModal } = useArxUploadJDModal();
  const { openModal: openEnrichmentModal } = useArxEnrichCreationModal();
  const closeOptionsDropdown = () => {
    closeDropdown(dropdownId);
  };

  const handleCreateEnrichments = () => {
    openEnrichmentModal();
    closeOptionsDropdown();
  };

  const handleUploadJD = () => {
    openUploadJDModal();
    closeOptionsDropdown();
  };

  const handleUploadCV = () => {
    onUploadCV?.();
    closeOptionsDropdown();
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
        </DropdownContent>
      }
    />
  );
};
