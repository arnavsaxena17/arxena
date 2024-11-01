import styled from '@emotion/styled';
import { IconCheckbox, IconNotes, IconPlus, IconScan } from 'twenty-ui';

import { useOpenCreateActivityDrawer } from '@/activities/hooks/useOpenCreateActivityDrawer';
import { ActivityType } from '@/activities/types/Activity';
import { ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { useInterviewCreationModal } from '@/ai-interview/interview-creation/hooks/useInterviewCreationModal';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { PageHotkeyScope } from '@/types/PageHotkeyScope';
import { IconButton } from '@/ui/input/button/components/IconButton';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { SHOW_PAGE_ADD_BUTTON_DROPDOWN_ID } from '@/ui/layout/show-page/constants/ShowPageAddButtonDropdownId';
import { MenuItem } from '@/ui/navigation/menu-item/components/MenuItem';
import { Dropdown } from '../../dropdown/components/Dropdown';
import { DropdownMenu } from '../../dropdown/components/DropdownMenu';

const StyledContainer = styled.div`
  z-index: 1;
`;


export const ShowPageAddButton = ({ activityTargetObject }: { activityTargetObject: ActivityTargetableObject }) => {
  const { closeDropdown, toggleDropdown } = useDropdown('add-show-page');
  const openCreateActivity = useOpenCreateActivityDrawer();

  const handleSelect = (type: ActivityType) => {
    openCreateActivity({
      type,
      targetableObjects: [activityTargetObject],
    });

    closeDropdown();
  };

  const { openModal } = useInterviewCreationModal();

  const handleModal = () => {
    openModal();
    closeDropdown();
  };

  const isAIInterviewEnabled = [CoreObjectNameSingular.Job, CoreObjectNameSingular.Candidate, CoreObjectNameSingular.Person].includes(activityTargetObject.targetObjectNameSingular as CoreObjectNameSingular);

  const menuItems = [
    {
      text: 'Note',
      icon: IconNotes,
      onClick: () => handleSelect('Note'),
    },
    {
      text: 'Task',
      icon: IconCheckbox,
      onClick: () => handleSelect('Task'),
    },
    ...(isAIInterviewEnabled
      ? [
          {
            text: 'AI Interview',
            icon: IconScan,
            onClick: () => handleModal(),
          },
        ]
      : []),
  ];

  return (
    <StyledContainer>
      <Dropdown
        dropdownId={SHOW_PAGE_ADD_BUTTON_DROPDOWN_ID}
        clickableComponent={<IconButton Icon={IconPlus} size="medium" dataTestId="add-showpage-button" accent="default" variant="secondary" onClick={toggleDropdown} />}
        dropdownComponents={
          <DropdownMenu>
            <DropdownMenuItemsContainer>
              {menuItems.map(item => (
                <MenuItem key={item.text} onClick={item.onClick} accent="default" LeftIcon={item.icon} text={item.text} />
              ))}
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
