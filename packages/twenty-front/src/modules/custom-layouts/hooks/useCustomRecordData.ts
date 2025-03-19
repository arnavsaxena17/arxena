// Create a custom hook to provide merged record data to components
export const useCustomRecordData = (
  recordIndexId: string,
  mergedData: any[],
) => {
  // Create a mapping of record IDs to record data
  const recordMap = mergedData.reduce((acc, record) => {
    acc[record.id] = record;
    return acc;
  }, {});

  // Provide a function to get a record by ID
  const getRecordById = (id: string) => {
    return recordMap[id] || null;
  };

  // Provide a function to get all records
  const getAllRecords = () => {
    return mergedData;
  };

  return {
    getRecordById,
    getAllRecords,
  };
};

export default useCustomRecordData;
