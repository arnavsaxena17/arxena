import { currentWorkspaceMemberState } from "@/auth/states/currentWorkspaceMemberState";
import { CoreObjectNameSingular } from "@/object-metadata/types/CoreObjectNameSingular";
import { useFindManyRecords } from "@/object-record/hooks/useFindManyRecords";
import { useRecoilValue } from "recoil";

export const useChats = () => {
  //   const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const { records: tasks } = useFindManyRecords({
    objectNameSingular: CoreObjectNameSingular.whatsappMessage,
  });
  return { records: tasks };
};
