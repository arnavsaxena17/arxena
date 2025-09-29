import styled from '@emotion/styled';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx-ugnis';

import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import { readFileAsync } from '@/spreadsheet-import/utils/readFilesAsync';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { MainButton } from 'twenty-ui';

// Helper function to read file as text
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// Helper function to convert JSON data to workbook format
const convertJsonToWorkbook = (jsonData: any): XLSX.WorkBook => {
  // Extract applications array from the JSON data
  const applications = jsonData.applications || [];
  
  if (applications.length === 0) {
    // Return empty workbook if no applications
    return {
      SheetNames: ['Candidates'],
      Sheets: {
        Candidates: XLSX.utils.aoa_to_sheet([['No data found']])
      }
    };
  }

  // Extract headers from the first application
  const firstApplication = applications[0];
  const headers = Object.keys(firstApplication);
  
  // Create data array with headers as first row
  const data = [headers];
  
  // Add each application as a row
  applications.forEach((application: any) => {
    const row = headers.map(header => {
      const value = application[header];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
    data.push(row);
  });

  // Create worksheet from the data
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  return {
    SheetNames: ['Candidates'],
    Sheets: {
      Candidates: worksheet
    }
  };
};

const StyledContainer = styled.div`
  align-items: center;
  background: ${({ theme }) => `
    repeating-linear-gradient(
      0deg,
      ${theme.font.color.primary},
      ${theme.font.color.primary} 10px,
      transparent 10px,
      transparent 20px,
      ${theme.font.color.primary} 20px
    ),
    repeating-linear-gradient(
      90deg,
      ${theme.font.color.primary},
      ${theme.font.color.primary} 10px,
      transparent 10px,
      transparent 20px,
      ${theme.font.color.primary} 20px
    ),
    repeating-linear-gradient(
      180deg,
      ${theme.font.color.primary},
      ${theme.font.color.primary} 10px,
      transparent 10px,
      transparent 20px,
      ${theme.font.color.primary} 20px
    ),
    repeating-linear-gradient(
      270deg,
      ${theme.font.color.primary},
      ${theme.font.color.primary} 10px,
      transparent 10px,
      transparent 20px,
      ${theme.font.color.primary} 20px
    );
  `};
  background-position:
    0 0,
    0 0,
    100% 0,
    0 100%;
  background-repeat: no-repeat;
  background-size:
    2px 100%,
    100% 2px,
    2px 100%,
    100% 2px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  position: relative;
`;

const StyledOverlay = styled.div`
  background: ${({ theme }) => theme.background.transparent.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  bottom: 0px;
  left: 0px;
  position: absolute;
  right: 0px;
  top: 0px;
`;

const StyledText = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  text-align: center;
  padding: 16px;
`;

type DropZoneProps = {
  onContinue: (data: XLSX.WorkBook, file: File) => void;
  isLoading: boolean;
};

export const DropZone = ({ onContinue, isLoading }: DropZoneProps) => {
  const { maxFileSize, dateFormat, parseRaw } = useSpreadsheetImportInternal();

  const [loading, setLoading] = useState(false);

  const { enqueueSnackBar } = useSnackBar();

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    noKeyboard: true,
    maxFiles: 1,
    maxSize: maxFileSize,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
    },
    onDropRejected: (fileRejections) => {
      setLoading(false);
      fileRejections.forEach((fileRejection) => {
        enqueueSnackBar(`${fileRejection.file.name} upload rejected`, {
          detailedMessage: fileRejection.errors[0].message,
          variant: SnackBarVariant.Error,
        });
      });
    },
    onDropAccepted: async ([file]) => {
      setLoading(true);
      
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        // Handle JSON files
        const text = await readFileAsText(file);
        const jsonData = JSON.parse(text);
        
        // Convert JSON to workbook format for compatibility
        const workbook = convertJsonToWorkbook(jsonData);
        setLoading(false);
        onContinue(workbook, file);
      } else {
        // Handle Excel/CSV files
        const arrayBuffer = await readFileAsync(file);
        const workbook = XLSX.read(arrayBuffer, {
          cellDates: true,
          codepage: 65001, // UTF-8 codepage
          dateNF: dateFormat,
          raw: parseRaw,
          dense: true,
        });
        setLoading(false);
        onContinue(workbook, file);
      }
    },
  });

  return (
    <StyledContainer
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...getRootProps()}
    >
      {isDragActive && <StyledOverlay />}
      <input
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...getInputProps()}
      />
      {isDragActive ? (
        <StyledText>Drop file here...</StyledText>
      ) : loading || isLoading ? (
        <StyledText>Processing...</StyledText>
      ) : (
        <>
          <StyledText>Upload .xlsx, .xls, .csv or .json file</StyledText>
          <MainButton onClick={open} title="Select file" />
        </>
      )}
    </StyledContainer>
  );
};
