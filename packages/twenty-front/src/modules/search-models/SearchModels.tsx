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
import { Button, IconCopy, IconDownload, IconPlus, IconUpload, Loader } from 'twenty-ui';

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
  align-items: center;
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:hover {
    border-color: ${({ theme }) => theme.border.color.strong};
  }
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
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

const StyledModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const StyledModalContent = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(4)};
  max-width: 800px;
  max-height: 80vh;
  width: 90%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const StyledModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.font.size.xl};
  cursor: pointer;
  color: ${({ theme }) => theme.font.color.secondary};
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledModalBody = styled.div`
  flex: 1;
  overflow: auto;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  min-height: 300px;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledPre = styled.pre`
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0;
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  max-height: 60vh;
  overflow: auto;
`;

const StyledJsonViewer = styled.div`
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.6;
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  max-height: 60vh;
  overflow: auto;
  
  .json-key {
    color: ${({ theme }) => theme.color.blue || '#2563eb'};
    font-weight: ${({ theme }) => theme.font.weight.medium};
  }
  
  .json-string {
    color: ${({ theme }) => theme.font.color.primary || '#000'};
  }
  .json-number {
    color: ${({ theme }) => theme.font.color.primary || '#000'};
  }
  
  .json-boolean {
    color: ${({ theme }) => theme.font.color.primary || '#000'};
    font-weight: ${({ theme }) => theme.font.weight.semiBold};
  }
  
  .json-null {
    color: ${({ theme }) => theme.font.color.primary || '#000'};
    font-style: italic;
  }
  
  .json-bracket {
    color: ${({ theme }) => theme.font.color.primary};
    font-weight: ${({ theme }) => theme.font.weight.semiBold};
  }
`;

const StyledJsonNode = styled.div`
  user-select: none;
`;

const StyledJsonLine = styled.div<{ indent?: number }>`
  display: flex;
  align-items: flex-start;
  padding-left: ${({ indent = 0 }) => `${indent * 20}px`};
  min-height: 20px;
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};
  
  &:hover {
    background-color: ${({ theme, onClick }) => (onClick ? theme.background.tertiary : 'transparent')};
  }
`;

const StyledToggleButton = styled.span`
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  text-align: center;
  line-height: 16px;
  font-size: 12px;
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  user-select: none;
  
  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledJsonContent = styled.div<{ isCollapsed: boolean }>`
  display: ${({ isCollapsed }) => (isCollapsed ? 'none' : 'block')};
`;

const StyledModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
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

const DEFAULT_SEARCH_PROMPTS = [
  'Find business development managers in the SaaS/cloud infrastructure space in Bangalore with experience selling to enterprise clients',
  'Give me regional sales heads from logistics and supply chain companies in Delhi NCR preferably with 3PL background',
  'Who are the key account managers handling modern trade in FMCG companies across Maharashtra',
  'Find sales directors from medical devices companies in Pune specializing in cardiology or orthopedic products',
  'Give me channel partners managers from telecom equipment vendors in Gujarat with B2B focus',
  'Who are the finance controllers of mid-sized pharma companies in Hyderabad with US GAAP experience',
  'Find treasury managers from large manufacturing companies in Chennai preferably automotive sector',
  'Give me financial planning and analysis heads from e-commerce unicorns in Bangalore under 45 years',
  'Who are the internal audit heads of listed NBFCs in Mumbai with Big 4 background',
  'Find cost accountants from steel or metals companies in Odisha or Jharkhand',
  'Give me VP Engineering from fintech startups in Bangalore with payments or lending platform experience',
  'Who are the lead architects working on AWS/Azure cloud migrations in Mumbai from BFSI companies',
  'Find ML/AI engineers from product companies in Hyderabad working on computer vision applications',
  'Give me engineering managers from EV companies in Pune or Bangalore with battery technology expertise',
  'Who are the DevOps leads from Series B+ startups across India with Kubernetes experience',
  'Find plant heads from chemical manufacturing companies in Gujarat with ISO certifications',
  'Who are the supply chain directors of large retail chains in India with omnichannel experience',
  'Give me warehouse managers from e-commerce companies in NCR with automation implementation background',
  'Find operations heads from quick commerce startups in Bangalore preferably dark store experience',
  'Who are the procurement managers of large construction companies in Mumbai handling raw materials',
  'Give me CHRO or HR heads from IT services companies in Bangalore with 5000+ employee strength',
  'Find talent acquisition heads from healthcare companies across India preferably hospital chains',
  'Who are the compensation and benefits managers from MNC banks in Mumbai',
  'Give me HR business partners from FMCG companies in Kolkata supporting sales functions',
  'Find learning and development heads from pharma companies in Hyderabad with digital learning expertise',
  'Who are the digital marketing heads from D2C brands in Mumbai with performance marketing background',
  'Find brand managers from personal care companies across India with rural market experience',
  'Give me growth marketing leads from B2B SaaS companies in Bangalore with PLG experience',
  'Who are the corporate communications heads from large conglomerates in Mumbai preferably Tata or Birla group',
  'Find content marketing managers from edtech startups across India with SEO expertise',
  'Give me formulation scientists from generic pharma companies in Ahmedabad with ANDAs filed',
  'Who are the R&D managers from agrochemical companies in Maharashtra working on crop protection',
  'Find materials scientists from automotive OEMs in Chennai working on lightweighting solutions',
  'Give me innovation heads from FMCG companies across India with naturals/ayurvedic focus',
  'Who are the process engineers from specialty chemicals companies in Gujarat with flow chemistry experience',
  'Find general counsels from fintech companies in Bangalore with RBI regulatory experience',
  'Who are the company secretaries of listed mid-cap companies in Mumbai preferably manufacturing sector',
  'Give me compliance heads from pharmaceutical companies across India with USFDA audit experience',
  'Find IP lawyers from product companies in Bangalore with patent prosecution background',
  'Who are the legal managers from real estate developers in NCR with RERA and litigation experience',
  'Give me CEOs or managing directors of PE-backed companies in consumer sector across India',
  'Who are the COOs of logistics companies in Mumbai with last-mile delivery expertise',
  'Find founding team members from Series A startups in Bangalore in B2B marketplace space',
  'Give me board members of listed banks with risk management committee experience',
  'Who are the presidents or business heads of aftermarket divisions in automotive companies in Pune',
  'Find data scientists from healthcare companies across India working on clinical analytics',
  'Who are the product managers from payments companies in Bangalore with UPI product experience',
  'Give me quality assurance heads from medical devices companies in Chennai with FDA and CE mark experience',
  'Find business analysts from consulting firms in Mumbai with financial services practice experience preferably McKinsey or BCG',
  'Who are the sustainability or ESG heads from large manufacturing companies across India preferably cement or metals sector',
];

type SearchType = 'classic' | 'sales_navigator' | 'recruiter';

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

type CellViewModal = {
  row: number;
  col: number;
  columnName: string;
  value: string;
  isEditable: boolean;
} | null;

type JsonValueProps = {
  value: any;
  keyName?: string;
  indent?: number;
  path?: string;
  collapsedPaths: Set<string>;
  togglePath: (path: string) => void;
};

const JsonValue = ({ 
  value, 
  keyName, 
  indent = 0, 
  path = '',
  collapsedPaths,
  togglePath 
}: JsonValueProps): JSX.Element => {
  const currentPath = path;
  const isCollapsed = collapsedPaths.has(currentPath);
  const isCollapsible = (typeof value === 'object' && value !== null) && 
    (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);

  if (value === null) {
    return (
      <StyledJsonLine indent={indent}>
        {keyName && <span className="json-key">"{keyName}"</span>}
        {keyName && <span>: </span>}
        <span className="json-null">null</span>
      </StyledJsonLine>
    );
  }

  if (typeof value === 'string') {
    return (
      <StyledJsonLine indent={indent}>
        {keyName && <span className="json-key">"{keyName}"</span>}
        {keyName && <span>: </span>}
        <span className="json-string">"{value}"</span>
      </StyledJsonLine>
    );
  }

  if (typeof value === 'number') {
    return (
      <StyledJsonLine indent={indent}>
        {keyName && <span className="json-key">"{keyName}"</span>}
        {keyName && <span>: </span>}
        <span className="json-number">{value}</span>
      </StyledJsonLine>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <StyledJsonLine indent={indent}>
        {keyName && <span className="json-key">"{keyName}"</span>}
        {keyName && <span>: </span>}
        <span className="json-boolean">{String(value)}</span>
      </StyledJsonLine>
    );
  }

  if (Array.isArray(value)) {
    const isEmpty = value.length === 0;
    return (
      <StyledJsonNode>
        <StyledJsonLine 
          indent={indent} 
          onClick={isCollapsible ? () => togglePath(currentPath) : undefined}
        >
          {isCollapsible && (
            <StyledToggleButton onClick={(e) => { e.stopPropagation(); togglePath(currentPath); }}>
              {isCollapsed ? '▶' : '▼'}
            </StyledToggleButton>
          )}
          {!isCollapsible && <span style={{ width: '16px', display: 'inline-block' }} />}
          {keyName && <span className="json-key">"{keyName}"</span>}
          {keyName && <span>: </span>}
          <span className="json-bracket">[</span>
          {isEmpty && <span className="json-bracket">]</span>}
          {!isEmpty && isCollapsed && <span style={{ color: '#999' }}> // {value.length} items</span>}
        </StyledJsonLine>
        {!isCollapsed && (
          <StyledJsonContent isCollapsed={false}>
            {value.map((item, index) => (
              <div key={index}>
                <JsonValue
                  value={item}
                  indent={indent + 1}
                  path={`${currentPath}[${index}]`}
                  collapsedPaths={collapsedPaths}
                  togglePath={togglePath}
                />
                {index < value.length - 1 && (
                  <StyledJsonLine indent={0}>
                    <span>,</span>
                  </StyledJsonLine>
                )}
              </div>
            ))}
            <StyledJsonLine indent={indent}>
              <span className="json-bracket">]</span>
            </StyledJsonLine>
          </StyledJsonContent>
        )}
      </StyledJsonNode>
    );
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;
    return (
      <StyledJsonNode>
        <StyledJsonLine 
          indent={indent} 
          onClick={isCollapsible ? () => togglePath(currentPath) : undefined}
        >
          {isCollapsible && (
            <StyledToggleButton onClick={(e) => { e.stopPropagation(); togglePath(currentPath); }}>
              {isCollapsed ? '▶' : '▼'}
            </StyledToggleButton>
          )}
          {!isCollapsible && <span style={{ width: '16px', display: 'inline-block' }} />}
          {keyName && <span className="json-key">"{keyName}"</span>}
          {keyName && <span>: </span>}
          <span className="json-bracket">{'{'}</span>
          {isEmpty && <span className="json-bracket">{'}'}</span>}
          {!isEmpty && isCollapsed && <span style={{ color: '#999' }}> // {keys.length} properties</span>}
        </StyledJsonLine>
        {!isCollapsed && (
          <StyledJsonContent isCollapsed={false}>
            {keys.map((key, index) => (
              <div key={key}>
                <JsonValue
                  value={value[key]}
                  keyName={key}
                  indent={indent + 1}
                  path={currentPath ? `${currentPath}.${key}` : key}
                  collapsedPaths={collapsedPaths}
                  togglePath={togglePath}
                />
                {index < keys.length - 1 && (
                  <StyledJsonLine indent={0}>
                    <span>,</span>
                  </StyledJsonLine>
                )}
              </div>
            ))}
            <StyledJsonLine indent={indent}>
              <span className="json-bracket">{'}'}</span>
            </StyledJsonLine>
          </StyledJsonContent>
        )}
      </StyledJsonNode>
    );
  }

  return <StyledJsonLine indent={indent}>{String(value)}</StyledJsonLine>;
};

type CollapsibleJsonViewerProps = {
  jsonString: string;
};

const CollapsibleJsonViewer = ({ jsonString }: CollapsibleJsonViewerProps) => {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  
  const togglePath = useCallback((path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  try {
    const parsed = JSON.parse(jsonString.trim());
    return (
      <StyledJsonViewer>
        <JsonValue
          value={parsed}
          indent={0}
          path="root"
          collapsedPaths={collapsedPaths}
          togglePath={togglePath}
        />
      </StyledJsonViewer>
    );
  } catch {
    return <StyledPre>{jsonString}</StyledPre>;
  }
};

export const SearchModels = () => {
  const tableRef = useRef<any>(null);
  const [data, setData] = useState<CSVRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const [searchType, setSearchType] = useState<SearchType>('classic');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [cellViewModal, setCellViewModal] = useState<CellViewModal>(null);
  const [editedValue, setEditedValue] = useState('');
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
          // Normalize data to ensure all rows have all columns
          const normalizedData = parsed.map(row => {
            const normalizedRow: CSVRow = {};
            COLUMNS.forEach(col => {
              normalizedRow[col] = row[col] || '';
            });
            return normalizedRow;
          });
          setData(normalizedData);
          setDataLoaded(true);
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
      // Mark initial load as complete after a short delay to ensure table is ready
      setTimeout(() => {
        isInitialLoadRef.current = false;
        setDataLoaded(true);
      }, 200);
    }
  }, []);

  // Initialize with default prompts if no data (after localStorage load)
  useEffect(() => {
    if (!isInitialLoadRef.current && data.length === 0) {
      const defaultData = DEFAULT_SEARCH_PROMPTS.map(prompt => {
        const row: CSVRow = Object.fromEntries(COLUMNS.map(col => [col, '']));
        row['Search Prompt'] = prompt;
        return row;
      });
      setData(defaultData);
    }
  }, [data.length]);

  // Update table once after initial load from localStorage completes
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    
    const timeoutId = setTimeout(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot || data.length === 0) return;

      // Force update the table with loaded data
      const currentTableData = hot.getData();
      const expectedTableData = data.map(row => COLUMNS.map(col => row[col] || ''));
      
      // Only update if data is different
      const dataChanged = JSON.stringify(currentTableData) !== JSON.stringify(expectedTableData);
      if (dataChanged) {
        hot.loadData(expectedTableData);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [data, isInitialLoadRef.current]);

  // Save data to localStorage whenever it changes (but not during initial load)
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (data.length === 0) return; // Don't save empty data

    try {
      // Ensure we're saving complete data - verify all rows have all columns
      const completeData = data.map(row => {
        const completeRow: CSVRow = {};
        COLUMNS.forEach(col => {
          completeRow[col] = row[col] || '';
        });
        return completeRow;
      });
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completeData));
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

  const openCellViewModal = useCallback((row: number, col: number) => {
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;

    const columnName = COLUMNS[col];
    const value = String(hot.getDataAtCell(row, col) || '');
    const isEditable = columnName === 'Search Prompt' || columnName === 'Clarifying Answers';

    setCellViewModal({
      row,
      col,
      columnName,
      value,
      isEditable,
    });
    setEditedValue(value);
  }, []);

  const closeCellViewModal = useCallback(() => {
    setCellViewModal(null);
    setEditedValue('');
  }, []);

  // Check if a string is valid JSON
  const isJsonString = useCallback((str: string): boolean => {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Render JSON with collapsible tree structure
  const renderJson = useCallback((jsonString: string): JSX.Element => {
    return <CollapsibleJsonViewer jsonString={jsonString} />;
  }, []);

  // Helper function to sync Handsontable data to state and save to localStorage
  const syncTableDataToState = useCallback((immediate = false) => {
    const sync = () => {
      const hot = tableRef.current?.hotInstance;
      if (!hot || isInitialLoadRef.current) return;

      try {
        // Use getData() which returns the current data array directly
        // This is more reliable than getDataAtCell for getting all data at once
        const tableDataArray = hot.getData();
        const rowCount = tableDataArray.length;
        
        const newData: CSVRow[] = [];
        for (let i = 0; i < rowCount; i++) {
          const row: CSVRow = {};
          COLUMNS.forEach((col, colIndex) => {
            // Get value from the data array or fallback to getDataAtCell
            const value = tableDataArray[i]?.[colIndex] ?? hot.getDataAtCell(i, colIndex);
            row[col] = String(value || '');
          });
          newData.push(row);
        }
        
        // Only update if we have data and it's different
        if (newData.length > 0) {
          setData(newData);
        }
      } catch (error) {
        console.error('Error syncing table data to state:', error);
        // Fallback: try using getDataAtCell for each cell
        try {
          const newData: CSVRow[] = [];
          const rowCount = hot.countRows();
          for (let i = 0; i < rowCount; i++) {
            const row: CSVRow = {};
            COLUMNS.forEach((col, colIndex) => {
              row[col] = String(hot.getDataAtCell(i, colIndex) || '');
            });
            newData.push(row);
          }
          if (newData.length > 0) {
            setData(newData);
          }
        } catch (fallbackError) {
          console.error('Error in fallback sync:', fallbackError);
        }
      }
    };

    if (immediate) {
      sync();
    } else {
      // Use a small delay to ensure Handsontable has processed the update
      setTimeout(sync, 100);
    }
  }, []);

  const saveCellValue = useCallback(() => {
    if (!cellViewModal) return;

    const hot = tableRef.current?.hotInstance;
    if (!hot) return;

    hot.setDataAtCell(cellViewModal.row, cellViewModal.col, editedValue);
    syncTableDataToState();
    closeCellViewModal();
  }, [cellViewModal, editedValue, syncTableDataToState, closeCellViewModal]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      await showNotification({
        title: 'Copied',
        body: 'Content copied to clipboard',
        icon: '/favicon.ico'
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      await showNotification({
        title: 'Copy Failed',
        body: 'Failed to copy content to clipboard',
        icon: '/favicon.ico'
      });
    }
  }, [showNotification]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cellViewModal) {
        closeCellViewModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [cellViewModal, closeCellViewModal]);

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
        
        // Sync to state and save to localStorage
        syncTableDataToState();
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
            searchType: searchType,
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
        
        // Sync to state and save to localStorage
        syncTableDataToState();
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
            searchType: searchType,
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
        
        // Sync to state and save to localStorage
        syncTableDataToState();
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
            searchType: searchType,
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
        
        // Sync to state and save to localStorage
        syncTableDataToState();
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
        
        // Sync to state and save to localStorage
        syncTableDataToState();
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
        
        // Sync to state and save to localStorage
        syncTableDataToState();
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
      // Final sync to ensure all data is captured, even if individual syncs were missed
      setTimeout(() => {
        syncTableDataToState(true);
      }, 200);
    }
  }, [tokenPair, showNotification, savePageDataToStorage, searchType, syncTableDataToState]);

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

      // Value display area - make it clickable to view full content
      const valueArea = document.createElement('div');
      valueArea.style.flex = '1';
      valueArea.style.overflow = 'auto';
      valueArea.style.wordBreak = 'break-word';
      valueArea.style.fontSize = '11px';
      valueArea.style.maxHeight = '100px';
      valueArea.style.color = value ? 'inherit' : '#999';
      valueArea.style.cursor = 'pointer';
      valueArea.style.userSelect = 'none';
      valueArea.textContent = value || (columnName === 'Search Prompt' ? 'Enter search prompt...' : '');
      valueArea.title = 'Click, press F2, or double-click to view full content';
      valueArea.onclick = (e) => {
        e.stopPropagation();
        openCellViewModal(row, col);
      };
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
  }, [processingState, processStep, openCellViewModal]);

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
      editor: 'text', // Use text editor (supports multi-line content)
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

  const afterInitHandler = useCallback(() => {
    // Once table is initialized, update it with loaded data if available
    if (!dataLoaded || data.length === 0) return;
    
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;

    const currentTableData = hot.getData();
    const expectedTableData = data.map(row => COLUMNS.map(col => row[col] || ''));
    
    // Only update if data is different
    const dataChanged = JSON.stringify(currentTableData) !== JSON.stringify(expectedTableData);
    if (dataChanged) {
      hot.loadData(expectedTableData);
    }

    // Add double-click handler to open cell view modal
    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if double-click is on a cell (not on a button)
      if (target.closest('td') && !target.closest('button')) {
        const selected = hot.getSelected();
        if (selected && selected.length > 0) {
          const [row, col] = selected[0];
          openCellViewModal(row, col);
        }
      }
    };
    
    const tableElement = hot.rootElement;
    tableElement.addEventListener('dblclick', handleDblClick);
    // Store handler for cleanup
    (tableElement as any).__dblClickHandler = handleDblClick;
  }, [dataLoaded, data, openCellViewModal]);

  const beforeKeyDownHandler = useCallback((event: KeyboardEvent) => {
    const hot = tableRef.current?.hotInstance;
    if (!hot) return;

    const selected = hot.getSelected();
    if (!selected || selected.length === 0) return;

    const [row, col] = selected[0];

    // Handle F2 or Enter to open cell view modal
    if (event.key === 'F2' || (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      openCellViewModal(row, col);
      return false;
    }
  }, [openCellViewModal]);

  // Convert CSVRow[] to array of arrays for Handsontable
  const tableData = useMemo(() => {
    return data.map(row => COLUMNS.map(col => row[col] || ''));
  }, [data]);

  // Update Handsontable when data changes (after initial load and table is ready)
  useEffect(() => {
    if (!dataLoaded) return;
    if (data.length === 0) return;
    
    // Use a timeout to ensure the table instance is ready
    const timeoutId = setTimeout(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;

      // Get current table data
      const currentTableData = hot.getData();
      const expectedTableData = tableData;
      
      // Only update if data is different (to avoid unnecessary updates)
      const dataChanged = JSON.stringify(currentTableData) !== JSON.stringify(expectedTableData);
      if (dataChanged) {
        // Use loadData to update the table with new data
        // This ensures the table reflects the current state
        hot.loadData(expectedTableData);
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [tableData, data.length, dataLoaded]);

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
          <StyledLabel htmlFor="search-type-select">Search Type:</StyledLabel>
          <StyledSelect
            id="search-type-select"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as SearchType)}
            disabled={isLoading}
          >
            <option value="classic">Classic</option>
            <option value="sales_navigator">Sales Navigator</option>
            <option value="recruiter">Recruiter</option>
          </StyledSelect>
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
          afterInit={afterInitHandler}
          beforeKeyDown={beforeKeyDownHandler}
          manualRowResize={true}
          manualColumnResize={true}
          contextMenu={true}
          allowInsertRow={true}
          allowRemoveRow={true}
        />
      </StyledTableContainer>

      {cellViewModal && (
        <StyledModalOverlay onClick={closeCellViewModal}>
          <StyledModalContent onClick={(e) => e.stopPropagation()}>
            <StyledModalHeader>
              <StyledModalTitle>
                {cellViewModal.columnName} (Row {cellViewModal.row + 1})
              </StyledModalTitle>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!cellViewModal.isEditable && isJsonString(cellViewModal.value) && (
                  <Button
                    Icon={IconCopy}
                    title="Copy JSON"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(cellViewModal.value.trim());
                        const formatted = JSON.stringify(parsed, null, 2);
                        copyToClipboard(formatted);
                      } catch {
                        copyToClipboard(cellViewModal.value);
                      }
                    }}
                  />
                )}
                <StyledCloseButton onClick={closeCellViewModal}>×</StyledCloseButton>
              </div>
            </StyledModalHeader>
            <StyledModalBody>
              {cellViewModal.isEditable ? (
                <StyledTextArea
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  placeholder="Enter content..."
                />
              ) : isJsonString(cellViewModal.value) ? (
                renderJson(cellViewModal.value)
              ) : (
                <StyledPre>{cellViewModal.value || '(empty)'}</StyledPre>
              )}
            </StyledModalBody>
            <StyledModalFooter>
              {cellViewModal.isEditable && (
                <Button
                  title="Save"
                  onClick={saveCellValue}
                >
                  Save
                </Button>
              )}
              <Button
                title="Close"
                onClick={closeCellViewModal}
              >
                Close
              </Button>
            </StyledModalFooter>
          </StyledModalContent>
        </StyledModalOverlay>
      )}
    </StyledContainer>
  );
};

