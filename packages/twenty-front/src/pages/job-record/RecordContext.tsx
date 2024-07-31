import React, { createContext, useContext, useState, ReactNode } from 'react';

// interface Column {
//   id: string;
//   label: string;
//   // Add other properties as needed
// }

interface RecordContextType {
  columns: any[];
  setColumns: React.Dispatch<React.SetStateAction<any[]>>;
  data: any[]; // Replace 'any' with a more specific type if possible
  setData: React.Dispatch<React.SetStateAction<any[]>>;
}

const RecordContext = createContext<RecordContextType | undefined>(undefined);

export const RecordProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [columns, setColumns] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);

  return <RecordContext.Provider value={{ columns, setColumns, data, setData }}>{children}</RecordContext.Provider>;
};

export const useRecordContext = () => {
  const context = useContext(RecordContext);
  if (context === undefined) {
    throw new Error('useRecordContext must be used within a RecordProvider');
  }
  return context;
};
