import { Chat } from '@/activities/chats/types/Chat';
import { ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { getActivityTargetObjectFieldIdName } from '@/activities/utils/getActivityTargetObjectFieldIdName';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';

// do we need to test this?
export const useChats = (targetableObject: ActivityTargetableObject) => {
  const targetableObjectFieldIdName = getActivityTargetObjectFieldIdName({
    nameSingular: targetableObject.targetObjectNameSingular,
  });

  console.log('This is the objectNameSingular:', targetableObjectFieldIdName);
  console.log('This is the targetableObject:', targetableObject);
  console.log('This is the targetableObject:', CoreObjectNameSingular);
  const { records: chats } = useFindManyRecords({
    objectNameSingular: CoreObjectNameSingular.Chat,
    orderBy: {
      createdAt: 'DescNullsFirst',
    },
  });

  return {
    chats: chats as Chat[],
  };
};
