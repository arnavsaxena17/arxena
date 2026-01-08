import { tokenPairState } from '@/auth/states/tokenPairState';
import { useNotification } from '@/notification-context/NotificationContextProvider';
import styled from '@emotion/styled';
import { HotTable } from '@handsontable/react-wrapper';
import axios from 'axios';
import Handsontable from 'handsontable';
import { CellChange, ChangeSource } from 'handsontable/common';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, IconDownload, IconPlus, IconUpload, Loader } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledTitle = styled.h1`
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

const StyledButtonGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledTableContainer = styled.div`
  flex: 1;
  overflow: auto;
  position: relative;
  
  .handsontable {
    overflow: visible;
  }
`;

const StyledActionButton = styled.button<{ isLoading?: boolean }>`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: ${({ isLoading }) => (isLoading ? 'not-allowed' : 'pointer')};
  font-size: ${({ theme }) => theme.font.size.sm};
  opacity: ${({ isLoading }) => (isLoading ? 0.6 : 1)};
  
  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.color.blue50};
  }
  
  &:disabled {
    cursor: not-allowed;
  }
`;

type CSVRow = Record<string, string>;

const COLUMNS = [
  'Search Prompt',
  'Query Understanding',
  'Clarifying Questions',
  'Clarifying Answers',
  'Search Strategies',
  'Search Parameters',
  'Search URLs',
  'Search Results Page 1',
  'Page 1 Validation',
  'Page 1 Candidate Scores',
  'Search Results Page 2',
  'Page 2 Validation',
  'Page 2 Candidate Scores',
  'Search Results Page 3',
  'Page 3 Validation',
  'Page 3 Candidate Scores',
  'Search Results Page 4',
  'Page 4 Validation',
  'Page 4 Candidate Scores',
  'Search Results Page 5',
  'Page 5 Validation',
  'Page 5 Candidate Scores',
  'Search Results Page 6',
  'Page 6 Validation',
  'Page 6 Candidate Scores',
  'Search Results Page 7',
  'Page 7 Validation',
  'Page 7 Candidate Scores',
  'All Results',
];

const STORAGE_KEY = 'search-models-data';
const STORAGE_PAGE_DATA_KEY = 'search-models-page-data';

type ProcessingStep = 
  | 'query-understanding'
  | 'strategies'
  | 'parameters'
  | 'search'
  | 'search-page'
  | 'validate-page'
  | 'score-candidates'
  | 'result-validation';

interface ProcessingState {
  row: number;
  column: number;
  step: ProcessingStep;
}

export const SearchModels = () => {
  const tableRef = useRef<any>(null);
  const [data, setData] = useState<CSVRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const tokenPair = useRecoilValue(tokenPairState);
  const { showNotification } = useNotification();
  // Store page data (candidates, cursors) separately for easy access
  const pageDataRef = useRef<Map<string, { candidates: any[]; cursor?: string; hasMore?: boolean }>>(new Map());
  // Track if we're loading from localStorage to avoid saving during initial load
  const isInitialLoadRef = useRef(true);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData) as CSVRow[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setData(parsed);
        }
      }

      const savedPageData = localStorage.getItem(STORAGE_PAGE_DATA_KEY);
      if (savedPageData) {
        const parsed = JSON.parse(savedPageData) as Record<string, { candidates: any[]; cursor?: string; hasMore?: boolean }>;
        if (parsed && typeof parsed === 'object') {
          pageDataRef.current = new Map(Object.entries(parsed));
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    } finally {
      isInitialLoadRef.current = false;
    }
  }, []);

  // Initialize with empty row if no data (after localStorage load)
  useEffect(() => {
    if (!isInitialLoadRef.current && data.length === 0) {
      setData([Object.fromEntries(COLUMNS.map(col => [col, '']))]);
    }
  }, [data.length]);

  // Save data to localStorage whenever it changes (but not during initial load)
  useEffect(() => {
    if (isInitialLoadRef.current) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [data]);

  // Helper function to save pageDataRef to localStorage
  const savePageDataToStorage = useCallback(() => {
    if (isInitialLoadRef.current) return;

    try {
      const pageDataObj = Object.fromEntries(pageDataRef.current);
      localStorage.setItem(STORAGE_PAGE_DATA_KEY, JSON.stringify(pageDataObj));
    } catch (error) {
      console.error('Error saving page data to localStorage:', error);
    }
  }, []);

  const parseCSV = useCallback((csvContent: string): CSVRow[] => {
    const lines = csvContent.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      return [Object.fromEntries(COLUMNS.map(col => [col, '']))];
    }

    // Parse headers
    const headers = lines[0]
      .split(',')
      .map((h) => h.trim().replace(/^"|"$/g, ''));

    // Parse rows
    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return rows.length > 0 ? rows : [Object.fromEntries(COLUMNS.map(col => [col, '']))];
  }, []);

  const parseCSVLine = useCallback((line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }, []);

  const rowToCSVLine = useCallback((row: CSVRow): string => {
    return COLUMNS
      .map((header) => {
        const value = row[header] || '';
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(',');
  }, []);

  const loadCSVData = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        setIsLoading(true);
        const text = await file.text();
        const parsed = parseCSV(text);
        setData(parsed);
        // Clear page data when loading new CSV as row indices may have changed
        pageDataRef.current.clear();
        savePageDataToStorage();
        await showNotification({
          title: 'Loaded',
          body: `Loaded ${parsed.length} rows from CSV`,
          icon: '/favicon.ico'
        });
      } catch (error) {
        console.error('Error loading CSV:', error);
        await showNotification({
          title: 'Load Failed',
          body: 'Failed to parse CSV file',
          icon: '/favicon.ico'
        });
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  }, [parseCSV, showNotification, savePageDataToStorage]);

  const saveCSVData = useCallback(async () => {
    try {
      setIsLoading(true);
      const lines = [COLUMNS.join(',')];
      data.forEach((row) => {
        lines.push(rowToCSVLine(row));
      });
      const csvContent = lines.join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'search-prompts.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      await showNotification({
        title: 'Saved',
        body: 'CSV file downloaded successfully',
        icon: '/favicon.ico'
      });
    } catch (error) {
      console.error('Error saving CSV:', error);
      await showNotification({
        title: 'Save Failed',
        body: 'Failed to save CSV data',
        icon: '/favicon.ico'
      });
    } finally {
      setIsLoading(false);
    }
  }, [data, rowToCSVLine, showNotification]);

  const getStepForColumn = (columnName: string): ProcessingStep | null => {
    if (columnName === 'Query Understanding' || columnName === 'Clarifying Questions') {
      return 'query-understanding';
    }
    if (columnName === 'Search Strategies') {
      return 'strategies';
    }
    if (columnName === 'Search Parameters' || columnName === 'Search URLs') {
      return 'parameters';
    }
    if (columnName.startsWith('Search Results Page')) {
      return 'search-page';
    }
    if (columnName.startsWith('Page ') && columnName.endsWith(' Validation')) {
      return 'validate-page';
    }
    if (columnName.startsWith('Page ') && columnName.endsWith(' Candidate Scores')) {
      return 'score-candidates';
    }
    if (columnName === 'All Results') {
      return 'search';
    }
    return null;
  };

  const processStep = useCallback(async (
    rowIndex: number,
    columnName: string,
    step: ProcessingStep
  ) => {
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;

    const rowData = hot.getDataAtRow(rowIndex);
    const prompt = rowData[0] || ''; // Search Prompt is first column

    if (!prompt.trim()) {
      await showNotification({
        title: 'Error',
        body: 'Search Prompt is required',
        icon: '/favicon.ico'
      });
      return;
    }

    setProcessingState({ row: rowIndex, column: COLUMNS.indexOf(columnName), step });

    try {
      const baseUrl = (process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
      const apiToken = tokenPair?.accessToken?.token;

      if (!apiToken) {
        throw new Error('No API token available');
      }

      let result: any = {};

      // Step 1: Query Understanding
      if (step === 'query-understanding') {
        const response = await axios.post(
          `${baseUrl}/candidate-search/test/understand-query`,
          {
            prompt,
            rawJDText: '',
            isClarificationResponse: false,
          },
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000,
          }
        );

        result.queryUnderstanding = response.data.queryUnderstanding;
        result.clarifyingQuestions = response.data.queryUnderstanding?.clarificationQuestions || [];

        // Update Query Understanding column
        const queryUnderstandingCol = COLUMNS.indexOf('Query Understanding');
        hot.setDataAtCell(rowIndex, queryUnderstandingCol, JSON.stringify(result.queryUnderstanding));

        // Update Clarifying Questions column
        const clarifyingQuestionsCol = COLUMNS.indexOf('Clarifying Questions');
        if (result.clarifyingQuestions.length > 0) {
          hot.setDataAtCell(rowIndex, clarifyingQuestionsCol, result.clarifyingQuestions.join('; '));
        }
      }

      // Step 2: Search Strategies
      if (step === 'strategies') {
        // Get query understanding from row
        const queryUnderstandingCol = COLUMNS.indexOf('Query Understanding');
        const queryUnderstandingStr = hot.getDataAtCell(rowIndex, queryUnderstandingCol);
        let queryUnderstanding = null;
        if (queryUnderstandingStr) {
          try {
            queryUnderstanding = JSON.parse(queryUnderstandingStr as string);
          } catch (e) {
            console.error('Failed to parse query understanding:', e);
          }
        }

        if (!queryUnderstanding) {
          await showNotification({
            title: 'Error',
            body: 'Query Understanding is required. Please run Query Understanding first.',
            icon: '/favicon.ico'
          });
          return;
        }

        const response = await axios.post(
          `${baseUrl}/candidate-search/test/generate-search-strategies`,
          {
            prompt,
            parsedJobDescription: {
              jobTitle: 'Software Engineer',
              company: 'Tech Company',
              location: 'Mumbai',
              industry: 'Technology',
              requiredSkills: [],
              preferredSkills: [],
              experienceLevel: 'mid_level',
              education: [],
              keywords: [],
              responsibilities: [],
              qualifications: [],
              benefits: [],
              employmentType: 'full_time',
              remoteWork: false,
              salaryRange: null,
            },
            searchType: 'classic',
            searchCategory: 'people',
            queryUnderstanding,
          },
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 180000,
          }
        );

        result.searchStrategies = response.data.strategies || [];

        // Update Search Strategies column
        const strategiesCol = COLUMNS.indexOf('Search Strategies');
        hot.setDataAtCell(rowIndex, strategiesCol, JSON.stringify(result.searchStrategies));
      }

      // Step 3: Search Parameters
      if (step === 'parameters') {
        // Get query understanding from row
        const queryUnderstandingCol = COLUMNS.indexOf('Query Understanding');
        const queryUnderstandingStr = hot.getDataAtCell(rowIndex, queryUnderstandingCol);
        let queryUnderstanding = null;
        if (queryUnderstandingStr) {
          try {
            queryUnderstanding = JSON.parse(queryUnderstandingStr as string);
          } catch (e) {
            console.error('Failed to parse query understanding:', e);
          }
        }

        if (!queryUnderstanding) {
          await showNotification({
            title: 'Error',
            body: 'Query Understanding is required. Please run Query Understanding first.',
            icon: '/favicon.ico'
          });
          return;
        }

        const response = await axios.post(
          `${baseUrl}/candidate-search/test/generate-search-parameters`,
          {
            prompt,
            parsedJobDescription: {
              jobTitle: 'Software Engineer',
              company: 'Tech Company',
              location: 'Mumbai',
              industry: 'Technology',
              requiredSkills: [],
              preferredSkills: [],
              experienceLevel: 'mid_level',
              education: [],
              keywords: [],
              responsibilities: [],
              qualifications: [],
              benefits: [],
              employmentType: 'full_time',
              remoteWork: false,
              salaryRange: null,
            },
            searchType: 'classic',
            searchCategory: 'people',
            queryUnderstanding,
          },
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 180000,
          }
        );

        result.searchParameters = response.data.searchParameters;
        result.searchUrls = response.data.searchUrls || [];
        result.searchStrategies = response.data.searchStrategies || [];

        // Update Search Parameters column
        const parametersCol = COLUMNS.indexOf('Search Parameters');
        hot.setDataAtCell(rowIndex, parametersCol, JSON.stringify(result.searchParameters));

        // Update Search URLs column
        const urlsCol = COLUMNS.indexOf('Search URLs');
        if (result.searchUrls.length > 0) {
          hot.setDataAtCell(rowIndex, urlsCol, result.searchUrls.join(', '));
        }

        // Update Search Strategies if provided
        if (result.searchStrategies.length > 0) {
          const strategiesCol = COLUMNS.indexOf('Search Strategies');
          hot.setDataAtCell(rowIndex, strategiesCol, JSON.stringify(result.searchStrategies));
        }
      }

      // Step 4: Execute Single Page Search (Manual Pagination)
      if (step === 'search-page') {
        // Extract page number from column name
        const pageMatch = columnName.match(/Search Results Page (\d+)/);
        if (!pageMatch) {
          throw new Error('Invalid page column name');
        }
        const pageNumber = parseInt(pageMatch[1], 10);

        // Get search parameters from row
        const parametersCol = COLUMNS.indexOf('Search Parameters');
        const parametersStr = hot.getDataAtCell(rowIndex, parametersCol);
        let searchParameters = null;
        if (parametersStr) {
          try {
            searchParameters = JSON.parse(parametersStr as string);
          } catch (e) {
            console.error('Failed to parse search parameters:', e);
          }
        }

        if (!searchParameters) {
          await showNotification({
            title: 'Error',
            body: 'Search Parameters are required. Please run Parameters step first.',
            icon: '/favicon.ico'
          });
          return;
        }

        // Get query understanding
        const queryUnderstandingCol = COLUMNS.indexOf('Query Understanding');
        const queryUnderstandingStr = hot.getDataAtCell(rowIndex, queryUnderstandingCol);
        let queryUnderstanding = null;
        if (queryUnderstandingStr) {
          try {
            queryUnderstanding = JSON.parse(queryUnderstandingStr as string);
          } catch (e) {
            console.error('Failed to parse query understanding:', e);
          }
        }

        // Get cursor from previous page (if not page 1)
        let cursor: string | undefined = undefined;
        if (pageNumber > 1) {
          const prevPageKey = `${rowIndex}-${pageNumber - 1}`;
          const prevPageData = pageDataRef.current.get(prevPageKey);
          cursor = prevPageData?.cursor;
        }

        const response = await axios.post(
          `${baseUrl}/candidate-search/test/execute-search-page`,
          {
            prompt,
            parsedJobDescription: {
              jobTitle: 'Software Engineer',
              company: 'Tech Company',
              location: 'Mumbai',
              industry: 'Technology',
              requiredSkills: [],
              preferredSkills: [],
              experienceLevel: 'mid_level',
              education: [],
              keywords: [],
              responsibilities: [],
              qualifications: [],
              benefits: [],
              employmentType: 'full_time',
              remoteWork: false,
              salaryRange: null,
            },
            searchType: 'classic',
            searchCategory: 'people',
            searchParameters,
            queryUnderstanding,
            page: pageNumber,
            cursor,
          },
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 300000,
          }
        );

        // Update page results column
        const pageCol = COLUMNS.indexOf(`Search Results Page ${pageNumber}`);
        const pageKey = `${rowIndex}-${pageNumber}`;
        
        if (response.data.candidates && response.data.candidates.length > 0) {
          // Store page data in ref for easy access
          pageDataRef.current.set(pageKey, {
            candidates: response.data.candidates,
            cursor: response.data.nextCursor,
            hasMore: response.data.hasMore,
          });
          savePageDataToStorage();
          
          const formatted = response.data.candidates
            .map((c: any, idx: number) => {
              const name = c.name || c.first_name || c.headline || 'Unknown';
              const title = c.headline || c.current_positions?.[0]?.role || c.jobTitle || 'N/A';
              const company = c.current_positions?.[0]?.company || c.company || 'N/A';
              const score = c.relevanceScore ? `${(c.relevanceScore * 100).toFixed(0)}%` : 'N/A';
              const label = c.relevanceLabel || 'N/A';
              return `${idx + 1}. ${name} | ${title} | ${company} | ${score} (${label})`;
            })
            .join('; ');
          hot.setDataAtCell(rowIndex, pageCol, formatted);
        } else {
          hot.setDataAtCell(rowIndex, pageCol, 'No results found');
          pageDataRef.current.set(pageKey, { candidates: [], hasMore: false });
          savePageDataToStorage();
        }
      }

      // Step 5: Validate Page Results
      if (step === 'validate-page') {
        // Extract page number from column name
        const pageMatch = columnName.match(/Page (\d+) Validation/);
        if (!pageMatch) {
          throw new Error('Invalid validation column name');
        }
        const pageNumber = parseInt(pageMatch[1], 10);

        // Get page results from ref
        const pageKey = `${rowIndex}-${pageNumber}`;
        const pageData = pageDataRef.current.get(pageKey);
        const candidates = pageData?.candidates || [];

        if (candidates.length === 0) {
          await showNotification({
            title: 'Error',
            body: `Page ${pageNumber} results are required. Please run Search Page ${pageNumber} first.`,
            icon: '/favicon.ico'
          });
          return;
        }

        // Get query understanding
        const queryUnderstandingCol = COLUMNS.indexOf('Query Understanding');
        const queryUnderstandingStr = hot.getDataAtCell(rowIndex, queryUnderstandingCol);
        let queryUnderstanding = null;
        if (queryUnderstandingStr) {
          try {
            queryUnderstanding = JSON.parse(queryUnderstandingStr as string);
          } catch (e) {
            console.error('Failed to parse query understanding:', e);
          }
        }

        if (!queryUnderstanding) {
          await showNotification({
            title: 'Error',
            body: 'Query Understanding is required. Please run Query Understanding first.',
            icon: '/favicon.ico'
          });
          return;
        }

        const response = await axios.post(
          `${baseUrl}/candidate-search/test/validate-page-results`,
          {
            prompt,
            queryUnderstanding,
            candidates,
            page: pageNumber,
          },
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 180000,
          }
        );

        // Update validation column
        const validationCol = COLUMNS.indexOf(`Page ${pageNumber} Validation`);
        const validation = response.data.validation;
        const formatted = `Quality: ${validation.qualityAssessment}, Relevance: ${(validation.relevanceScore * 100).toFixed(0)}%, Should Continue: ${validation.shouldContinuePagination ? 'Yes' : 'No'}\nReasoning: ${validation.reasoning || 'N/A'}`;
        hot.setDataAtCell(rowIndex, validationCol, formatted);
      }

      // Step 6: Score Candidates for a Page
      if (step === 'score-candidates') {
        // Extract page number from column name
        const pageMatch = columnName.match(/Page (\d+) Candidate Scores/);
        if (!pageMatch) {
          throw new Error('Invalid candidate scores column name');
        }
        const pageNumber = parseInt(pageMatch[1], 10);

        // Get page results from ref
        const pageKey = `${rowIndex}-${pageNumber}`;
        const pageData = pageDataRef.current.get(pageKey);
        const candidates = pageData?.candidates || [];

        if (candidates.length === 0) {
          await showNotification({
            title: 'Error',
            body: `Page ${pageNumber} results are required. Please run Search Page ${pageNumber} first.`,
            icon: '/favicon.ico'
          });
          return;
        }

        // Get query understanding
        const queryUnderstandingCol = COLUMNS.indexOf('Query Understanding');
        const queryUnderstandingStr = hot.getDataAtCell(rowIndex, queryUnderstandingCol);
        let queryUnderstanding = null;
        if (queryUnderstandingStr) {
          try {
            queryUnderstanding = JSON.parse(queryUnderstandingStr as string);
          } catch (e) {
            console.error('Failed to parse query understanding:', e);
          }
        }

        if (!queryUnderstanding) {
          await showNotification({
            title: 'Error',
            body: 'Query Understanding is required. Please run Query Understanding first.',
            icon: '/favicon.ico'
          });
          return;
        }

        const response = await axios.post(
          `${baseUrl}/candidate-search/test/score-candidates`,
          {
            prompt,
            queryUnderstanding,
            candidates,
            parsedJobDescription: {
              jobTitle: 'Software Engineer',
              company: 'Tech Company',
              location: 'Mumbai',
              industry: 'Technology',
              requiredSkills: [],
              preferredSkills: [],
              experienceLevel: 'mid_level',
              education: [],
              keywords: [],
              responsibilities: [],
              qualifications: [],
              benefits: [],
              employmentType: 'full_time',
              remoteWork: false,
              salaryRange: null,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 300000,
          }
        );

        // Update candidate scores column
        const scoresCol = COLUMNS.indexOf(`Page ${pageNumber} Candidate Scores`);
        const scores = response.data.scores || [];
        const formatted = scores
          .map((s: any) => {
            return `${s.candidateName}: ${(s.score.relevanceScore * 100).toFixed(0)}% (${s.score.relevanceLabel})\nReasoning: ${s.score.reasoning}`;
          })
          .join('\n\n');
        hot.setDataAtCell(rowIndex, scoresCol, formatted);
      }

      // Step 7: Execute All Results (Legacy - for backward compatibility)
      if (step === 'search') {
        // This is kept for the "All Results" column but can be removed if not needed
        await showNotification({
          title: 'Info',
          body: 'Please use individual page searches instead. Use "Search Results Page 1" to start.',
          icon: '/favicon.ico'
        });
      }

      await showNotification({
        title: 'Success',
        body: `${step} completed successfully`,
        icon: '/favicon.ico'
      });
    } catch (error: any) {
      console.error(`Error processing ${step}:`, error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      await showNotification({
        title: 'Error',
        body: `Failed to process ${step}: ${errorMessage}`,
        icon: '/favicon.ico'
      });
    } finally {
      setProcessingState(null);
    }
  }, [tokenPair, showNotification, savePageDataToStorage]);

  const createCellRenderer = useCallback((columnName: string) => {
    return (
      instance: Handsontable.Core,
      td: HTMLTableCellElement,
      row: number,
      col: number,
      prop: string | number,
      value: any,
      cellProperties: Handsontable.CellProperties
    ) => {
      // Clear cell
      td.innerHTML = '';
      td.style.position = 'relative';
      td.style.padding = '4px';

      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '4px';
      container.style.width = '100%';
      container.style.minHeight = '60px';

      // Value display area
      const valueArea = document.createElement('div');
      valueArea.style.flex = '1';
      valueArea.style.overflow = 'auto';
      valueArea.style.wordBreak = 'break-word';
      valueArea.style.fontSize = '11px';
      valueArea.style.maxHeight = '100px';
      valueArea.style.color = value ? 'inherit' : '#999';
      valueArea.textContent = value || (columnName === 'Search Prompt' ? 'Enter search prompt...' : '');
      container.appendChild(valueArea);

      // Action button (if applicable)
      const step = getStepForColumn(columnName);
      if (step) {
        const isProcessing = processingState?.row === row && processingState?.column === col && processingState?.step === step;
        
        // Get descriptive button text based on step type
        let buttonText = '⏳ Processing...';
        if (!isProcessing) {
          if (step === 'search-page') {
            const pageMatch = columnName.match(/Search Results Page (\d+)/);
            buttonText = pageMatch ? `▶ Fetch Page ${pageMatch[1]}` : '▶ Fetch Page';
          } else if (step === 'validate-page') {
            const pageMatch = columnName.match(/Page (\d+) Validation/);
            buttonText = pageMatch ? `▶ Validate Page ${pageMatch[1]}` : '▶ Validate Page';
          } else if (step === 'score-candidates') {
            const pageMatch = columnName.match(/Page (\d+) Candidate Scores/);
            buttonText = pageMatch ? `▶ Score Page ${pageMatch[1]} Candidates` : '▶ Score Candidates';
          } else {
            buttonText = `▶ Run ${step.replace(/-/g, ' ')}`;
          }
        }
        
        const button = document.createElement('button');
        button.textContent = buttonText;
        button.style.padding = '4px 8px';
        button.style.fontSize = '10px';
        button.style.cursor = isProcessing ? 'not-allowed' : 'pointer';
        button.style.opacity = isProcessing ? '0.6' : '1';
        button.style.backgroundColor = isProcessing ? '#ccc' : '#2563eb';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.width = '100%';
        button.disabled = isProcessing;
        button.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!isProcessing) {
            processStep(row, columnName, step);
          }
        };
        container.appendChild(button);
      }

      td.appendChild(container);
      return td;
    };
  }, [processingState, processStep]);

  const columns = useMemo(() => {
    return COLUMNS.map((colName, index) => ({
      data: index, // Use numeric index since data is array of arrays
      title: colName,
      width: colName === 'Search Prompt' ? 300 
        : colName.startsWith('Search Results Page') ? 250 
        : colName.includes('Validation') ? 200
        : colName.includes('Candidate Scores') ? 300
        : 200,
      renderer: createCellRenderer(colName),
      readOnly: colName !== 'Search Prompt' && colName !== 'Clarifying Answers', // Only allow editing prompt and answers
      wordWrap: true,
    }));
  }, [createCellRenderer]);

  const afterChangeHandler = useCallback((changes: CellChange[] | null, source: ChangeSource) => {
    if (!changes || source === 'loadData') return;

    const hot = tableRef.current?.hotInstance;
    if (!hot) return;

    // Update data state - convert array of arrays back to CSVRow[]
    const newData: CSVRow[] = [];
    const rowCount = hot.countRows();
    for (let i = 0; i < rowCount; i++) {
      const row: CSVRow = {};
      COLUMNS.forEach((col, colIndex) => {
        row[col] = String(hot.getDataAtCell(i, colIndex) || '');
      });
      newData.push(row);
    }
    setData(newData);
  }, []);

  // Convert CSVRow[] to array of arrays for Handsontable
  const tableData = useMemo(() => {
    return data.map(row => COLUMNS.map(col => row[col] || ''));
  }, [data]);

  if (isLoading && data.length === 0) {
    return (
      <StyledContainer>
        <Loader />
        <span>Loading CSV data...</span>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>Search Models Testing</StyledTitle>
        <StyledButtonGroup>
          <Button
            Icon={IconDownload}
            title="Save CSV"
            onClick={saveCSVData}
            disabled={isLoading}
          />
          <Button
            Icon={IconUpload}
            title="Load CSV"
            onClick={loadCSVData}
            disabled={isLoading}
          />
          <Button
            Icon={IconPlus}
            title="Add Row"
            onClick={() => {
              const hot = tableRef.current?.hotInstance;
              if (hot) {
                const newRow: CSVRow = Object.fromEntries(COLUMNS.map(col => [col, '']));
                setData([...data, newRow]);
                // Trigger re-render by updating table data
                setTimeout(() => {
                  hot.render();
                }, 0);
              }
            }}
          />
        </StyledButtonGroup>
      </StyledHeader>

      <StyledTableContainer>
        <HotTable
          ref={tableRef}
          data={tableData}
          columns={columns}
          colHeaders={true}
          rowHeaders={true}
          height="100%"
          width="100%"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          readOnly={false}
          afterChange={afterChangeHandler}
          manualRowResize={true}
          manualColumnResize={true}
          contextMenu={true}
          allowInsertRow={true}
          allowRemoveRow={true}
        />
      </StyledTableContainer>
    </StyledContainer>
  );
};

