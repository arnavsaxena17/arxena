import styled from '@emotion/styled';
import { IconPlus } from 'twenty-ui';
import { mockedTasks } from '~/testing/mock-data/activities';
import { useOpenCreateActivityDrawer } from '@/activities/hooks/useOpenCreateActivityDrawer';
import { useRecoilState, useRecoilValue } from 'recoil';

import { NoteList } from '@/activities/notes/components/NoteList';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';

import { useNotes } from '@/activities/notes/hooks/useNotes';
import { ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { Button } from '@/ui/input/button/components/Button';
import AnimatedPlaceholder from '@/ui/layout/animated-placeholder/components/AnimatedPlaceholder';
import {
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from '@/ui/layout/animated-placeholder/components/EmptyPlaceholderStyled';

const StyledNotesContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: auto;
`;

import { useLocation } from 'react-router-dom';

const useShouldShowPlusButton = () => {
  const location = useLocation();
  // return !location.pathname.includes('chats');
  return true;
};

export const Notes = ({
  targetableObject,
}: {
  targetableObject: ActivityTargetableObject;
}) => {
  const { notes } = useNotes(targetableObject);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const openCreateActivity = useOpenCreateActivityDrawer();
  console.log("This is the targetableObject::", targetableObject);
  if (notes?.length === 0) {
    return (
      <AnimatedPlaceholderEmptyContainer>
        <AnimatedPlaceholder type="noNote" />
        <AnimatedPlaceholderEmptyTextContainer>
          <AnimatedPlaceholderEmptyTitle>
        No notes
          </AnimatedPlaceholderEmptyTitle>
          <AnimatedPlaceholderEmptySubTitle>
        There are no associated notes with this record.
          </AnimatedPlaceholderEmptySubTitle>
        </AnimatedPlaceholderEmptyTextContainer>
        {
          <Button
        Icon={IconPlus}
        title="New note"
        variant="secondary"
        onClick={() =>
          openCreateActivity({
            type: 'Note',
            targetableObjects: [targetableObject || {"id":"79c22a03-8c19-4fd2-a24b-d63dd8ef3d53", "targetObjectNameSingular":"candidate",  "assigneeId":currentWorkspaceMember}],
          })
        }
          />
        }
      </AnimatedPlaceholderEmptyContainer>
    );
  }


  return (
    <StyledNotesContainer>
      <NoteList
      title="All"
      notes={notes ?? []}
      button={
        
        <Button
          Icon={IconPlus}
          size="small"
          variant="secondary"
          title="Add note"
          onClick={() =>
          openCreateActivity({
            type: 'Note',
            targetableObjects: [targetableObject || {"id":"79c22a03-8c19-4fd2-a24b-d63dd8ef3d53", "targetObjectNameSingular":"candidate", "assigneeId":currentWorkspaceMember}],
          })
          }
        ></Button>
        
      }
      />
    </StyledNotesContainer>
  );
};
