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
    recordTableId,
  });

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { columnDefinitions } =
    useColumnDefinitionsFromFieldMetadata(objectMetadataItem);

  const { setRecordCountInCurrentView } =
    useSetRecordCountInCurrentView(viewBarId);

  useEffect(() => {
    setAvailableTableColumns(columnDefinitions);
  }, [columnDefinitions, setAvailableTableColumns]);

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
    setAvailableTableColumns(columnDefinitions);
  }, [columnDefinitions, setAvailableTableColumns]);

  // Set toggle filter handler
  useEffect(() => {
    setOnToggleColumnFilter(() => onToggleColumnFilter);
  }, [setOnToggleColumnFilter, onToggleColumnFilter]);

  // Set toggle sort handler 
  useEffect(() => {
    setOnToggleColumnSort(() => onToggleColumnSort);
  }, [setOnToggleColumnSort, onToggleColumnSort]);

  // Set entries
  useEffect(() => {
    if (setActionBarEntries && setContextMenuEntries) {
      setActionBarEntries();
      setContextMenuEntries();
    }
  }, [setActionBarEntries, setContextMenuEntries, selectedRowIds]);

  // Set entity count change handler
  useEffect(() => {
    setOnEntityCountChange(() => onEntityCountChange);
  }, [setOnEntityCountChange, onEntityCountChange]);

  return <></>;
};
