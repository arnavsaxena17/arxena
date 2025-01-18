import { useCallback, useEffect } from 'react';
import { useRecoilValue } from 'recoil';

import { useColumnDefinitionsFromFieldMetadata } from '@/object-metadata/hooks/useColumnDefinitionsFromFieldMetadata';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useRecordActionBar } from '@/object-record/record-action-bar/hooks/useRecordActionBar';
import { useHandleToggleColumnFilter } from '@/object-record/record-index/hooks/useHandleToggleColumnFilter';
import { useHandleToggleColumnSort } from '@/object-record/record-index/hooks/useHandleToggleColumnSort';
import { useRecordTable } from '@/object-record/record-table/hooks/useRecordTable';
import { useSetRecordCountInCurrentView } from '@/views/hooks/useSetRecordCountInCurrentView';

type RecordIndexTableContainerEffectProps = {
  objectNameSingular: string;
  recordTableId: string;
  viewBarId: string;
};

export const RecordIndexTableContainerEffect = ({
  objectNameSingular,
  recordTableId,
  viewBarId,
}: RecordIndexTableContainerEffectProps) => {
  const {
    setAvailableTableColumns,
    setOnEntityCountChange,
    resetTableRowSelection,
    selectedRowIdsSelector,
    setOnToggleColumnFilter,
    setOnToggleColumnSort,
  } = useRecordTable({
    recordTableId: recordTableId ?? '', // Add fallback
  });

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: objectNameSingular ?? '', // Add fallback
  });

  if (!objectMetadataItem) {
    console.warn('Object metadata item is not available');
    return null;
  }
  
  

  const { columnDefinitions } =
    useColumnDefinitionsFromFieldMetadata(objectMetadataItem);

  console.log("These are the column definitions:", columnDefinitions)


  const { setRecordCountInCurrentView } =
    useSetRecordCountInCurrentView(viewBarId);


  const selectedRowIds = useRecoilValue(selectedRowIdsSelector());

  const { setContextMenuEntries, setActionBarEntries } = useRecordActionBar({
    objectMetadataItem,
    selectedRecordIds: selectedRowIds,
    callback: resetTableRowSelection,
  });
  const handleToggleColumnFilter = useHandleToggleColumnFilter({
    objectNameSingular,
    viewBarId,
  });

  const handleToggleColumnSort = useHandleToggleColumnSort({
    objectNameSingular,
    viewBarId,
  });



  const onToggleColumnFilter = useCallback(
    (fieldMetadataId: string) => handleToggleColumnFilter(fieldMetadataId),
    [handleToggleColumnFilter]
  );

  const onToggleColumnSort = useCallback(
    (fieldMetadataId: string) => handleToggleColumnSort(fieldMetadataId),
    [handleToggleColumnSort]
  );

  const onEntityCountChange = useCallback(
    (entityCount: number) => setRecordCountInCurrentView(entityCount),
    [setRecordCountInCurrentView]
  );


  useEffect(() => {

    if (!columnDefinitions) {
      console.warn('Column definitions are not available');
      return;
    }

    setAvailableTableColumns(columnDefinitions);
    setOnToggleColumnFilter(() => onToggleColumnFilter);
    setOnToggleColumnSort(() => onToggleColumnSort);
    setOnEntityCountChange(() => onEntityCountChange);
}, [
    columnDefinitions,
    setAvailableTableColumns,
    setOnToggleColumnFilter,
    onToggleColumnFilter,
    setOnToggleColumnSort,
    onToggleColumnSort,
    setOnEntityCountChange,
    onEntityCountChange
]);




const handleEntriesUpdate = useCallback(() => {
  if (setActionBarEntries && setContextMenuEntries) {
      setActionBarEntries();
      setContextMenuEntries();
  }
}, [setActionBarEntries, setContextMenuEntries]);

useEffect(() => {
  handleEntriesUpdate();
}, [handleEntriesUpdate, selectedRowIds]);


  
  return <></>;
};
