import React, { useEffect } from 'react';
import { useRecordContext } from './RecordContext';
import { useProcessData } from './useProcessData';

export default function RecordProviderContainer({ children, record }: any) {
  const processedData = useProcessData(record);
  const { setColumns, setData } = useRecordContext();
  console.log('columns', processedData?.columnsForDisplayingRecords);
  useEffect(() => {
    if (processedData?.columnsForDisplayingRecords) {
      setColumns(processedData.columnsForDisplayingRecords);
    }
  }, []);
  return <>{children}</>;
}
