import { useNavigate, useLocation } from 'react-router-dom';
import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';
import { IconDotsVertical, IconTrash } from 'twenty-ui';
import { useArxEnrichCreationModal } from '@/arx-enrich/hooks/useArxEnrichCreationModal';

import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { PageHotkeyScope } from '@/types/PageHotkeyScope';
import { IconButton } from '@/ui/input/button/components/IconButton';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { MenuItem } from '@/ui/navigation/menu-item/components/MenuItem';
import { navigationMemorizedUrlState } from '@/ui/navigation/states/navigationMemorizedUrlState';

import { Dropdown } from '../../dropdown/components/Dropdown';
import { DropdownMenu } from '../../dropdown/components/DropdownMenu';
import { Icon24Hours } from '@tabler/icons-react';

const StyledContainer = styled.div`
  z-index: 1;
`;



export const ShowPageMoreButton = ({ recordId, objectNameSingular }: { recordId: string; objectNameSingular: string }) => {
  const { closeDropdown, toggleDropdown } = useDropdown('more-show-page');
  const navigationMemorizedUrl = useRecoilValue(navigationMemorizedUrlState);
  const navigate = useNavigate();

  const { deleteOneRecord } = useDeleteOneRecord({
    objectNameSingular,
  });

  const handleDelete = () => {
    deleteOneRecord(recordId);
    closeDropdown();
    navigate(navigationMemorizedUrl, { replace: true });
  };


  console.log('navigationMemorizedUrl', navigationMemorizedUrl);
  console.log('navigationMemorizedUrlState', navigationMemorizedUrlState);
  console.log('useLocation', useLocation());

  const locationName = useLocation().pathname

  
  const { openModal } = useArxEnrichCreationModal();

  const handleModal = () => {
    console.log("Truing top open modeal")
    openModal();
    // closeDropdown();
  };




  return (
    <StyledContainer>
      <Dropdown
        dropdownId="more-show-page"
        clickableComponent={<IconButton Icon={IconDotsVertical} size="medium" dataTestId="more-showpage-button" accent="default" variant="secondary" onClick={toggleDropdown} />}
        dropdownComponents={
          <DropdownMenu>
            <DropdownMenuItemsContainer>
              <MenuItem onClick={handleDelete} accent="danger" LeftIcon={IconTrash} text="Delete" />
              { objectNameSingular.toLowerCase().includes('candidate') && locationName.includes("objects") ? <MenuItem onClick={handleModal} accent="default" LeftIcon={Icon24Hours} text="Enrich" /> : null }
            </DropdownMenuItemsContainer>
          </DropdownMenu>
        }
        dropdownHotkeyScope={{
          scope: PageHotkeyScope.ShowPage,
        }}
      />
    </StyledContainer>
  );
};
