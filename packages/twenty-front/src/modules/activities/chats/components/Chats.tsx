import { useChats } from '@/activities/chats/hooks/useChats';
import { ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
export const Chats = ({
  targetableObject,
}: {
  targetableObject: ActivityTargetableObject;
}) => {
  const { chats } = useChats(targetableObject);
  console.log('This is the chats', chats);
  return JSON.stringify(chats);
};
