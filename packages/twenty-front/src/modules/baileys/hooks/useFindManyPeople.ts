import { CoreObjectNameSingular } from "@/object-metadata/types/CoreObjectNameSingular";
import { useFindManyRecords } from "@/object-record/hooks/useFindManyRecords";

export const useFindManyPeople = () => {
  const { records: tasks } = useFindManyRecords({
    objectNameSingular: CoreObjectNameSingular.Person,
  });
  return { records: tasks };
};
