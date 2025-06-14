import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import {
  IconCalendar,
  IconComment,
  OverflowingTextWithTooltip,
} from 'twenty-ui';

import { ActivityTargetsInlineCell } from '@/activities/inline-cell/components/ActivityTargetsInlineCell';
import { Activity } from '@/activities/types/Activity';

import { getActivitySummary } from '@/activities/utils/getActivitySummary';
import { Checkbox, CheckboxShape } from '@ui/input';


import { Task } from '@/activities/types/Task';
  // import { useCompleteTask } from '../hooks/useCompleteTask';
import { useOpenActivityRightDrawer } from '@/activities/hooks/useOpenActivityRightDrawer';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';

const StyledContainer = styled.div`
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  cursor: pointer;
  display: inline-flex;
  height: ${({ theme }) => theme.spacing(12)};
  min-width: calc(100% - ${({ theme }) => theme.spacing(8)});
  padding: 0 ${({ theme }) => theme.spacing(4)};

  &:last-child {
    border-bottom: 0;
  }
`;

const StyledTaskBody = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
`;

const StyledTaskTitle = styled.div<{
  completed: boolean;
}>`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: 0 ${({ theme }) => theme.spacing(2)};
  text-decoration: ${({ completed }) => (completed ? 'line-through' : 'none')};
`;

const StyledCommentIcon = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.light};
  display: flex;
  margin-left: ${({ theme }) => theme.spacing(2)};
`;

const StyledDueDate = styled.div<{
  isPast: boolean;
}>`
  align-items: center;
  color: ${({ theme, isPast }) =>
    isPast ? theme.font.color.danger : theme.font.color.secondary};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding-left: ${({ theme }) => theme.spacing(2)};
  white-space: nowrap;
`;

const StyledRightSideContainer = styled.div`
  display: flex;
`;

const StyledPlaceholder = styled.div`
  color: ${({ theme }) => theme.font.color.light};
`;

const StyledLeftSideContainer = styled.div`
  display: flex;
`;

const StyledCheckboxContainer = styled.div`
  display: flex;
`;

export const ChatRow = ({ task }: { task: Activity }) => {
  const theme = useTheme();
  const openActivityRightDrawer = useOpenActivityRightDrawer({objectNameSingular: CoreObjectNameSingular.Chat});

  const body = getActivitySummary(task.body);
  // const { completeTask } = useCompleteTask(task as unknown as Task);

  return (
    <StyledContainer
      onClick={() => {
        openActivityRightDrawer(task.id);
      }}
    >
      <StyledLeftSideContainer>
        <StyledCheckboxContainer
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Checkbox
            checked={false}
            shape={CheckboxShape.Rounded}
            // onCheckedChange={completeTask}
          />
        </StyledCheckboxContainer>
        <StyledTaskTitle completed={false}>
          {task.title || <StyledPlaceholder>Chat title</StyledPlaceholder>}
        </StyledTaskTitle>
        <StyledTaskBody>
          <OverflowingTextWithTooltip text={body} />
          {false && (
            <StyledCommentIcon>
              <IconComment size={theme.icon.size.md} />
            </StyledCommentIcon>
          )}
        </StyledTaskBody>
      </StyledLeftSideContainer>
      <StyledRightSideContainer>
        <ActivityTargetsInlineCell
          activity={task as Task}
          showLabel={false}
          maxWidth={200}
          readonly
          activityObjectNameSingular={CoreObjectNameSingular.Task}
        />
        <StyledDueDate
          isPast={
            false
          }
        >
          <IconCalendar size={theme.icon.size.md} />
          {/* {false && beautifyExactDate(task.dueAt)} */}
        </StyledDueDate>
      </StyledRightSideContainer>
    </StyledContainer>
  );
};
