import { ViewSort } from '@/views/types/ViewSort';

export const combinedViewSorts = (
  viewSort?: ViewSort[],
  toUpsertViewSorts?: ViewSort[],
  toDeleteViewSortIds?: string[],
): ViewSort[] => {
  // Add default values for parameters
  const safeViewSort = viewSort || [];
  const safeToUpsertViewSorts = toUpsertViewSorts || [];
  const safeToDeleteViewSortIds = toDeleteViewSortIds || [];

  const toCreateViewSorts = safeToUpsertViewSorts.filter(
    (toUpsertViewSort) =>
      !safeViewSort.some((viewSort) => viewSort.id === toUpsertViewSort.id),
  );

  const toUpdateViewSorts = safeToUpsertViewSorts.filter((toUpsertViewSort) =>
    safeViewSort.some((viewSort) => viewSort.id === toUpsertViewSort.id),
  );

  const combinedViewSorts = safeViewSort
    .filter((viewSort) => !safeToDeleteViewSortIds.includes(viewSort.id))
    .map((viewSort) => {
      const toUpdateViewSort = toUpdateViewSorts.find(
        (toUpdateViewSort) => toUpdateViewSort.id === viewSort.id,
      );

      return toUpdateViewSort ?? viewSort;
    })
    .concat(toCreateViewSorts);

  return Object.values(
    combinedViewSorts.reduce(
      (acc, obj) => ({ ...acc, [obj.fieldMetadataId]: obj }),
      {},
    ),
  );
};