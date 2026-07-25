import { Enrichment } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import Handsontable from "handsontable";
import type { TransformedCandidateForTable } from 'twenty-shared/arx';
import { formatToHumanReadableDateTime } from '~/utils/date-utils';

// Import STATUS_LABELS from CandidateInfoHeader

// Type for processed data items
export type ProcessedDataItem = {
  id: string;
  personId: string;
  name: string;
  phone: string;
  email: string;
  remarks: string;
  status: string;
  candConversationStatus: string;
  checkbox: boolean;
  startChat: boolean;
  startChatCompleted: boolean;
  jobTitle: string;
  updatedAt: string;
  stopChat: boolean;
  source: string;
  messagingChannel: string;
  resdexNaukriUrl: string;
  hiringNaukriUrl: string;
  linkedinUrl: string;
  lastMessage: string;
  hasCv: boolean;
  [key: string]: any; // For dynamic enrichment fields
};

// Union type for all candidate data sources
export type CandidateDataItem = (ProcessedDataItem | TransformedCandidateForTable) & { [key: string]: any };

const StyledSelectedRow = styled.tr`
  &.selected-row td {
    background-color: ${themeCssVariables.background.tertiary} !important;
  }
`;

// Define the renderer type similar to TableStateColumns.tsx
type ColumnRenderer = (
  instance: Handsontable.Core,
  td: HTMLTableCellElement,
  row: number,
  column: number,
  prop: string | number,
  value: any,
  cellProperties: Handsontable.CellProperties
) => HTMLTableCellElement;

const urlFields = ['profileUrl', 'linkedinUrl', 'githubUrl', 'portfolioUrl','profilePhotoUrl','englishAudioIntroUrl', 'resdexNaukriUrl', 'hiringNaukriUrl', 'website', 'websiteUrl','resumeDownloadUrl'];
const excludedFields = ['id', 'checkbox', 'people','attachments','emailMessages','whatsappMessages','videoInterview','tempId','_isFetched','whatsappProvider','location','company','campaign','name','profileUrl', 'uniqueId','hasCv','fullName','title','firstName','lastName','jobName','candidateReminders','dataSources','education','emailAddresses','experienceStats','jobProcessEvents','jobs','lastSeen','linkedinSpecificData','otherFields','token','hiringNaukriCookie','dataSource', 'personId', 'searchId','phoneNumbers','mobilePhone','filterQueryHash','mayAlsoKnow','languages','englishLevel','baseQueryHash','creationDate','apnaSearchToken', 'emailAddress', 'industries', 'profiles', 'jobProcess', 'locations', 'experienceStats', 'lastUpdated','interests','dataSources','allNumbers','uploadId','allMails','socialprofiles','tables','created','middleName','middleInitial','creationSource','contactDetails','queryId','socialProfiles'];
export const STATUS_LABELS: Record<string, string> = {
  NOT_INTERESTED: 'Not Interested',
  INTERESTED: 'Interested',
  CV_RECEIVED: 'CV Received',
  NOT_FIT: 'Not Fit',
  SCREENING: 'Screening',
  RECRUITER_INTERVIEW: 'Recruiter Interview',
  CV_SENT: 'CV Sent',
  CLIENT_INTERVIEW: 'Client Interview',
  NEGOTIATION: 'Negotiation',
};
export const CANDIDATE_CONVERSATION_STATUS_LABELS: Record<string, string> = {
  'ONLY_ADDED_NO_CONVERSATION': 'No Conversation',
  'CONVERSATION_STARTED_HAS_NOT_RESPONDED': 'Started, No Response',
  'SHARED_JD_HAS_NOT_RESPONDED': 'Shared JD, No Response',
  'CANDIDATE_REFUSES_TO_RELOCATE': 'Refuses Relocation',
  'STOPPED_RESPONDING_ON_QUESTIONS': 'Stopped Responding',
  'CANDIDATE_SALARY_OUT_OF_RANGE': 'Salary Out of Range',
  'CANDIDATE_IS_KEEN_TO_CHAT': 'Keen to Chat',
  'CANDIDATE_DECLINED_OPPORTUNITY': 'Declined Opportunity',
  'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT': 'Followed Up',
  'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION': 'Reluctant on Compensation',
  'CONVERSATION_CLOSED_TO_BE_CONTACTED': 'Closed to Contact'
};

const CV_AVAILABILITY_OPTIONS = ['CV Available', 'CV Not found'] as const;

export const MESSAGING_CHANNEL_OPTIONS = [
  'baileys',
  'whatsapp-unipile',
  'linkedin',
  'linkedin-sock'
];

/** Fits longest option (whatsapp-unipile) on one line with dropdown padding */
const MESSAGING_CHANNEL_COLUMN_WIDTH = 190;

const COLUMN_TITLE_OVERRIDES: Record<string, string> = {
  candConversationStatus: 'Bot Status',
  cvAvailability: 'CV',
};

const getColumnTitle = (key: string) =>
  COLUMN_TITLE_OVERRIDES[key] ?? (key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim());


// Function to check if a field is an enrichment field
export const isAiFilterField = (fieldName: string, aiFilters: Enrichment[]) => {
  // Check if fieldName matches any output field from AI filter configs
  const enrichments = aiFilters;
  return enrichments.some(enrichment => 
    enrichment?.fields?.some((field: any) => field.name === fieldName)
  );
};

/** True when value is safe to show in a grid cell (not object/array/JSON blob). Allows string, boolean, number, Date, nullish. */
const isScalarTableCellValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return false;
  if (typeof value === 'object') return false;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.length === 0) return true;
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (typeof parsed === 'object' && parsed !== null) return false;
      } catch {
        // not JSON — treat as plain string
      }
    }
    return true;
  }
  return false;
};

/** Hide column if any row has array, object, or JSON-encoded object/array string. */
const columnHasOnlyScalarValues = (columnName: string, processedData: CandidateDataItem[]): boolean =>
  processedData.every((item) => isScalarTableCellValue(item[columnName]));

// Function to check if a column has all empty or 'N/A' values
const hasAllEmptyValues = (columnName: string, processedData: CandidateDataItem[]): boolean => {
  if (!processedData.length) return true;
  
  // Special cases: always show these columns even if they have default values
  const alwaysShowColumns = ['jobTitle','jobCompanyName','locationName','status', 'candConversationStatus', 'checkbox', 'name','remarks', 'hasCv', 'cvAvailability', 'startChat', 'startChatCompleted', 'stopChat', 'relevanceScore', 'relevanceLabel', 'messagingChannel'];
  if (alwaysShowColumns.includes(columnName)) {
    return false;
  }
  
  return processedData.every(item => {
    const value = item[columnName];
    // For boolean values, we should show the column even if all values are false
    if (typeof value === 'boolean') {
      return false; // Always show boolean columns
    }
    // Empty array counts as empty (e.g. experience: [])
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    // Check for empty or default values
    return value === undefined || value === null || value === '' || value === 'N/A';
  });
};

// Style for enrichment fields
const enrichmentFieldStyle = {
  backgroundColor: '#f0f7ff', // Light blue background
  fontStyle: 'italic',
  position: 'relative'
};

export const TableColumns = ({ 
  processedData, 
  selectAllChecked, 
  selectAllIndeterminate, 
  onSelectAllChange,
  unreadMessagesCounts = {},
  enrichments = []
}: { 
  processedData: CandidateDataItem[], 
  selectAllChecked?: boolean, 
  selectAllIndeterminate?: boolean, 
  onSelectAllChange?: (checked: boolean) => void,
  unreadMessagesCounts?: Record<string, number>,
  enrichments?: Enrichment[]
}) => {
  if (!processedData.length) return [];
  console.log("these are the enrichments in table columns", enrichments);
  console.log("enrichments length:", enrichments.length);
  const allKeys = new Set<string>();
  processedData.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });


  const checkboxRenderer: ColumnRenderer = (instance, td, row, column, prop, value, cellProperties) => {
    td.innerHTML = '';
    // Get the physical row index after sorting
    const physicalRow = instance.toPhysicalRow(row);
    const rowData = instance.getSourceDataAtRow(physicalRow);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = value || false;
    checkbox.className = 'row-checkbox';
    td.style.textAlign = 'center';
    
    const rowElement = td.parentElement;
    if (rowElement) {
      if (value) {
        rowElement.classList.add('selected-row');
      } else {
        rowElement.classList.remove('selected-row');
      }
    }
    
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      // Use physical row index when setting data
      instance.setDataAtRowProp(physicalRow, 'checkbox', !value);
      if (rowElement) {
        rowElement.classList.toggle('selected-row');
      }
    });
    
    td.appendChild(checkbox);
    return td;
  };

  // Create truncated cell style
  const truncatedCellStyle = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    width: '100%'
  };

  // Simple renderer for text cells
  const simpleRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = value !== undefined && value !== null ? String(value) : 'N/A';
    td.innerHTML = '';
    td.appendChild(div);

    // Apply enrichment field styling if the field is from enrichments
    if (isAiFilterField(String(prop), enrichments)) {
      Object.assign(td.style, enrichmentFieldStyle);
      
      // Add an indicator dot
      const indicator = document.createElement('div');
      indicator.style.position = 'absolute';
      indicator.style.top = '2px';
      indicator.style.right = '2px';
      indicator.style.width = '6px';
      indicator.style.height = '6px';
      // indicator.style.borderRadius = '50%';
      // indicator.style.backgroundColor = '#2563eb';
      td.appendChild(indicator);
    }

    return td;
  };

  // Relevance score renderer - displays as percentage with color coding
  const relevanceScoreRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    
    if (value !== undefined && value !== null && typeof value === 'number') {
      const percentage = Math.round(value * 100);
      div.textContent = `${percentage}%`;
      
      // Color coding based on score
      if (value >= 0.8) {
        div.style.color = '#10b981'; // Green for highly relevant
        div.style.fontWeight = '600';
      } else if (value >= 0.5) {
        div.style.color = '#f59e0b'; // Orange for somewhat relevant
      } else {
        div.style.color = '#ef4444'; // Red for less relevant
      }
    } else {
      div.textContent = 'N/A';
      div.style.color = '#9ca3af'; // Gray for N/A
    }
    
    td.appendChild(div);
    return td;
  };

  // Relevance label renderer - displays human-readable labels
  const relevanceLabelRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    
    const labelMap: Record<string, string> = {
      'highly_relevant': 'Highly Relevant',
      'somewhat_relevant': 'Somewhat Relevant',
      'less_relevant': 'Less Relevant'
    };
    
    if (value && typeof value === 'string' && labelMap[value]) {
      div.textContent = labelMap[value];
      
      // Color coding based on label
      if (value === 'highly_relevant') {
        div.style.color = '#10b981';
        div.style.fontWeight = '600';
      } else if (value === 'somewhat_relevant') {
        div.style.color = '#f59e0b';
      } else {
        div.style.color = '#ef4444';
      }
    } else {
      div.textContent = 'N/A';
      div.style.color = '#9ca3af';
    }
    
    td.appendChild(div);
    return td;
  };

  // Array renderer for match/mismatch reasons - displays as comma-separated list
  const arrayRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    
    if (Array.isArray(value) && value.length > 0) {
      div.textContent = value.join(', ');
      div.title = value.join('\n'); // Show full list on hover
    } else {
      div.textContent = 'N/A';
      div.style.color = '#9ca3af';
    }
    
    td.appendChild(div);
    return td;
  };

  // Name renderer with unread message count
  const nameRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    // Get physical row index for proper data access after sorting/filtering
    const physicalRow = instance.toPhysicalRow(row);
    const rowData = instance.getSourceDataAtRow(physicalRow) as { 
      id?: string;
      name?: string;
      hasCv?: boolean;
      startChat?: boolean;
      hiringNaukriUrl?: string | { primaryLinkUrl?: string };
      resdexNaukriUrl?: string | { primaryLinkUrl?: string };
      linkedinUrl?: string | { primaryLinkUrl?: string };
    };

    
    const candidateId = rowData && typeof rowData === 'object' && 'id' in rowData ? rowData.id : null;
    const unreadCount = candidateId && unreadMessagesCounts[candidateId] ? unreadMessagesCounts[candidateId] : 0;
    const hasCv = rowData?.hasCv;
    // console.log('This is the rowData::', rowData?.hasCv);
    // console.log('This is the rowData::', rowData);
    const hasStartedChat = rowData?.startChat;

    // Extract profile URL in priority order: hiringNaukriUrl > resdexNaukriUrl > linkedinUrl
    const getUrlValue = (url: string | { primaryLinkUrl?: string } | undefined): string => {
      if (!url) return '';
      if (typeof url === 'string') return url.trim();
      if (typeof url === 'object' && url.primaryLinkUrl) return url.primaryLinkUrl.trim();
      return '';
    };

    const profileUrl = 
      getUrlValue(rowData?.hiringNaukriUrl) ||
      getUrlValue(rowData?.resdexNaukriUrl) ||
      getUrlValue(rowData?.linkedinUrl) ||
      '';
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.cursor = 'pointer';
    container.style.borderRadius = '4px';
    container.style.backgroundColor = '#f5f5f5';
    container.style.transition = 'background-color 0.2s ease';
    container.onmouseover = () => {
      container.style.backgroundColor = '#e0e0e0';
    };
    container.onmouseout = () => {
      container.style.backgroundColor = '#f5f5f5';
    };
    
    const nameDiv = document.createElement('div');
    Object.assign(nameDiv.style, truncatedCellStyle);
    const originalName = rowData.name !== undefined && rowData.name !== null ? String(rowData.name) : 'N/A';
    
    // Check if this is a LinkedIn Member and transform to "Out of Network Profile"
    const isLinkedInMember = originalName === 'Linkedin Member' || originalName === 'LinkedIn Member';
    const displayName = isLinkedInMember ? 'Out of Network Profile' : originalName;
    
    // Special styling for "Out of Network Profile"
    if (isLinkedInMember) {
      nameDiv.style.fontStyle = 'italic';
      nameDiv.style.color = '#6b7280'; // Muted gray color
      nameDiv.style.display = 'flex';
      nameDiv.style.alignItems = 'center';
      nameDiv.style.gap = '6px';
      
      // Add lock icon to indicate restricted access
      const iconSvg = document.createElement('span');
      iconSvg.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="#6b7280" style="flex-shrink: 0;"><path d="M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10A2,2 0 0,1 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/></svg>';
      nameDiv.appendChild(iconSvg);
      
      const textSpan = document.createElement('span');
      textSpan.textContent = displayName;
      nameDiv.appendChild(textSpan);
      
      nameDiv.title = 'LinkedIn profile is out of your network';
    } else {
      nameDiv.textContent = displayName;
    }
    
    container.appendChild(nameDiv);

    // Add CV availability icon
    const cvIcon = document.createElement('div');
    cvIcon.style.display = 'flex';
    cvIcon.style.alignItems = 'center';
    cvIcon.style.justifyContent = 'center';
    cvIcon.style.marginLeft = '8px';
    cvIcon.style.marginRight = '8px';
    cvIcon.style.width = '16px';
    cvIcon.style.height = '16px';
    cvIcon.innerHTML = hasCv 
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="green"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="gray"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>';
    cvIcon.title = hasCv ? 'CV Available' : 'No CV Available';
    if (hasCv) {
      container.appendChild(cvIcon);
    }

    // Add chat status icon
    if (hasStartedChat) {
      const chatIcon = document.createElement('div');
      chatIcon.style.display = 'flex';
      chatIcon.style.alignItems = 'center';
      chatIcon.style.justifyContent = 'center';
      chatIcon.style.marginLeft = '8px';
      chatIcon.style.marginRight = '8px';
      chatIcon.style.width = '16px';
      chatIcon.style.height = '16px';
      chatIcon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#1976d2"><path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M6,9H18V11H6M14,14H6V12H14M18,8H6V6H18"/></svg>';
      chatIcon.title = 'Contacted';
      container.appendChild(chatIcon);
    }

    // Add profile URL hyperlink icon if available
    if (profileUrl) {
      const linkIcon = document.createElement('a');
      linkIcon.href = profileUrl;
      linkIcon.target = '_blank';
      linkIcon.rel = 'noopener noreferrer';
      linkIcon.style.display = 'flex';
      linkIcon.style.alignItems = 'center';
      linkIcon.style.justifyContent = 'center';
      linkIcon.style.marginLeft = '8px';
      linkIcon.style.marginRight = '8px';
      linkIcon.style.width = '16px';
      linkIcon.style.height = '16px';
      linkIcon.style.cursor = 'pointer';
      linkIcon.style.textDecoration = 'none';
      linkIcon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#1976d2"><path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/></svg>';
      linkIcon.title = 'Open Profile';
      linkIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      linkIcon.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      linkIcon.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      container.appendChild(linkIcon);
    }
    
    if (unreadCount > 0) {
      const badge = document.createElement('div');
      badge.textContent = String(unreadCount);
      badge.style.backgroundColor = 'black';
      badge.style.color = 'white';
      badge.style.borderRadius = '50%';
      badge.style.width = '20px';
      badge.style.height = '20px';
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.fontSize = '12px';
      badge.style.fontWeight = 'bold';
      badge.style.minWidth = '20px';
      badge.style.flexShrink = '0';
      container.appendChild(badge);
    }
    
    td.appendChild(container);
    return td;
  };

  const urlRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    if (!value || value === 'N/A' || typeof value !== 'string') {
      const div = document.createElement('div');
      Object.assign(div.style, truncatedCellStyle);
      div.textContent = value !== undefined && value !== null ? String(value) : 'N/A';
      td.appendChild(div);
      return td;
    }
    
    // Format URL if needed (make sure it has http/https prefix)
    let url = value;
    if (typeof url === 'string' && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Create hyperlink element
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = value;
    
    Object.assign(link.style, truncatedCellStyle);
    link.style.color = '#1976d2';
    link.style.textDecoration = 'none';
    
    link.onmouseover = () => {
      link.style.textDecoration = 'underline';
    };
    link.onmouseout = () => {
      link.style.textDecoration = 'none';
    };
    
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
    
    link.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
    
    link.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
    
    td.appendChild(link);
    return td;
  };

  const dateRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    
    // Check if value is a valid date string or Date object
    if (value && (typeof value === 'string' || value instanceof Date)) {
      try {
        div.textContent = formatToHumanReadableDateTime(value);
      } catch (error) {
        console.warn(`Failed to format date for field ${String(prop)}:`, value, error);
        div.textContent = 'Invalid Date';
      }
    } else {
      // Log when dateRenderer receives non-date values for debugging
      if (value && value !== 'N/A' && value !== '') {
        console.warn(`dateRenderer received non-date value for field ${String(prop)}:`, value);
        // If it's an array or object, provide more specific error message
        if (Array.isArray(value)) {
          console.warn(`Field ${String(prop)} contains an array with ${value.length} items`);
        } else if (typeof value === 'object') {
          console.warn(`Field ${String(prop)} contains an object:`, value);
        }
      }
      div.textContent = 'N/A';
    }
    
    td.appendChild(div);
    return td;
  };

  const booleanToggleRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.cursor = 'pointer';
    
    const icon = document.createElement('span');
    icon.textContent = value ? '✓' : '✗';
    icon.style.fontSize = '16px';
    icon.style.color = value ? '#2E7D32' : '#D32F2F';
    
    container.addEventListener('click', (e) => {
      e.stopPropagation();
      instance.setDataAtRowProp(row, String(prop), !value);
    });
    
    container.appendChild(icon);
    td.appendChild(container);
    return td;
  };

  const chatColumns = [
    'startChat',
    'startChatCompleted',
    'startMeetingSchedulingChat',
    'startMeetingSchedulingChatCompleted',
    'startVideoInterviewChat',
    'startVideoInterviewChatCompleted',
    'stopChat'
  ];

  // Status mapping
   
  const columns: Handsontable.ColumnSettings[] = [];

  columns.push({
    data: 'checkbox',
    type: 'checkbox',
    title: '',
    width: 40,
    readOnly: false,
    renderer: checkboxRenderer,
    className: 'htCenter htMiddle',
  });

  columns.push({
    data: 'name',
    title: 'Name',
    width: 200,
    readOnly: true,
    renderer: nameRenderer,
  });


  const statusRenderer: ColumnRenderer = (instance, td, row, column, prop, value, cellProperties) => {
    // First call the dropdown renderer to maintain dropdown functionality
    Handsontable.renderers.DropdownRenderer(instance, td, row, column, prop, value, cellProperties);
    
    // Then update the displayed text to show the friendly label
    if (value) {
      if (prop === 'candConversationStatus' && CANDIDATE_CONVERSATION_STATUS_LABELS[value]) {
        td.textContent = CANDIDATE_CONVERSATION_STATUS_LABELS[value];
      } else if (prop === 'status' && STATUS_LABELS[value]) {
        td.textContent = STATUS_LABELS[value];
      }
    }
    return td;
  };

  const cvAvailabilityRenderer: ColumnRenderer = (instance, td, row, column, prop, value, cellProperties) => {
    // Use dropdown renderer so the value shows consistently with other dropdown columns.
    Handsontable.renderers.DropdownRenderer(instance, td, row, column, prop, value, cellProperties);
    return td;
  };

  const messagingChannelRenderer: ColumnRenderer = (instance, td, row, column, prop, value, cellProperties) => {
    Handsontable.renderers.DropdownRenderer(instance, td, row, column, prop, value, cellProperties);
    td.style.whiteSpace = 'nowrap';
    return td;
  };


  // First, add enrichment columns before common columns
  // Only include enrichment fields that actually exist in the data and are not empty
  const aiFilterFields = Array.from(allKeys).filter(key =>
    !excludedFields.includes(key) && 
    !hasAllEmptyValues(key, processedData) &&
    columnHasOnlyScalarValues(key, processedData) &&
    isAiFilterField(key, enrichments)
  );

  // Add AI filter columns first
  aiFilterFields.forEach(column => {
    columns.push({
      data: column,
      title: column.charAt(0).toUpperCase() + column.slice(1),
      width: 150,
      renderer: simpleRenderer,
      type: 'text'
    });
    allKeys.delete(column);
  });
  console.log("Available keys in processed data:", Array.from(allKeys));
  console.log("AI filter fields found in data:", aiFilterFields);
  console.log("Total columns after enrichment fields:", columns.length);

  const commonColumns = ['jobTitle','jobCompanyName','locationName','remarks','candConversationStatus','status','email', 'phone', 'lastMessage', 'messagingChannel'];
  commonColumns.forEach(column => {
    if (allKeys.has(column) && !excludedFields.includes(column) && !hasAllEmptyValues(column, processedData) && columnHasOnlyScalarValues(column, processedData)) {
      const isStatusField = column === 'status' || column === 'candConversationStatus';
      const isMessagingChannelField = column === 'messagingChannel';
      
      columns.push({
        data: column,
        title: getColumnTitle(column),
        width: isMessagingChannelField ? MESSAGING_CHANNEL_COLUMN_WIDTH : 150,
        renderer: column === 'lastMessage' ? dateRenderer : 
                 isStatusField ? statusRenderer :
                 isMessagingChannelField ? messagingChannelRenderer : 
                 simpleRenderer,
        type: isStatusField || isMessagingChannelField ? 'dropdown' : 'text',
        source: column === 'status' ? Object.values(STATUS_LABELS) as string[] : 
                column === 'candConversationStatus' ? Object.values(CANDIDATE_CONVERSATION_STATUS_LABELS) as string[] :
                isMessagingChannelField ? MESSAGING_CHANNEL_OPTIONS : undefined,
        editor: isStatusField || isMessagingChannelField ? 'dropdown' : undefined
      });
      allKeys.delete(column);
    }
  });

  // Add relevance columns after status and before other columns
  const relevanceColumns = ['relevanceScore', 'relevanceLabel', 'matchReasons', 'mismatchReasons'];
  relevanceColumns.forEach(column => {
    if (allKeys.has(column) && !excludedFields.includes(column) && !hasAllEmptyValues(column, processedData) && columnHasOnlyScalarValues(column, processedData)) {
      const isRelevanceScoreField = column === 'relevanceScore';
      const isRelevanceLabelField = column === 'relevanceLabel';
      const isArrayField = column === 'matchReasons' || column === 'mismatchReasons';
      
      columns.push({
        data: column,
        title: getColumnTitle(column),
        width: isRelevanceScoreField ? 100 :
               isRelevanceLabelField ? 140 :
               isArrayField ? 200 : 150,
        renderer: isRelevanceScoreField ? relevanceScoreRenderer :
                  isRelevanceLabelField ? relevanceLabelRenderer :
                  isArrayField ? arrayRenderer : simpleRenderer,
        type: 'text'
      });
      allKeys.delete(column);
    }
  });


  const smallFields = chatColumns.concat(['inferredSalary', 'inferredYearsExperience']);
  Array.from(allKeys)
    .filter(key => !excludedFields.includes(key))
    .filter(key => !hasAllEmptyValues(key, processedData))
    .filter(key => columnHasOnlyScalarValues(key, processedData))
    .filter(key => !isAiFilterField(key, enrichments)) // Exclude enrichment fields as they're already processed
    // .sort()
    .forEach(key => {
      const isUrlField = urlFields.includes(key);
      const isDateField = key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt' || key === 'lastMessage';
      const isChatField = chatColumns.includes(key);
      const isStatusField = key === 'candConversationStatus' || key === 'status';
      const isMessagingChannelField = key === 'messagingChannel';
      const isCvAvailabilityField = key === 'cvAvailability';
      
      // Relevance score fields
      const isRelevanceScoreField = key === 'relevanceScore';
      const isRelevanceLabelField = key === 'relevanceLabel';
      const isArrayField = key === 'matchReasons' || key === 'mismatchReasons';

      // Check if the field contains arrays or objects that shouldn't use dateRenderer
      const sampleValue = processedData.find(item => item[key] !== undefined && item[key] !== null)?.[key];
      const isArrayOrObject = Array.isArray(sampleValue) || (sampleValue && typeof sampleValue === 'object' && !(sampleValue instanceof Date));
      
      // Don't use dateRenderer for arrays or objects
      const shouldUseDateRenderer = isDateField && !isArrayOrObject;

      // Debug logging for problematic fields
      if (isArrayOrObject && isDateField) {
        console.warn(`Field "${key}" is marked as date field but contains array/object:`, sampleValue);
      }

      // Additional safety check: if any sample value is an array or object, don't use dateRenderer
      const hasArrayOrObjectValues = processedData.some(item => {
        const val = item[key];
        return val !== undefined && val !== null && (Array.isArray(val) || (typeof val === 'object' && !(val instanceof Date)));
      });
      
      const finalShouldUseDateRenderer = shouldUseDateRenderer && !hasArrayOrObjectValues;

      // Determine the appropriate renderer
      let renderer: ColumnRenderer = simpleRenderer;
      if (isChatField) {
        renderer = booleanToggleRenderer;
      } else if (isUrlField) {
        renderer = urlRenderer;
      } else if (finalShouldUseDateRenderer) {
        renderer = dateRenderer;
      } else if (isStatusField) {
        renderer = statusRenderer;
      } else if (isMessagingChannelField) {
        renderer = messagingChannelRenderer;
      } else if (isCvAvailabilityField) {
        renderer = cvAvailabilityRenderer;
      } else if (isRelevanceScoreField) {
        renderer = relevanceScoreRenderer;
      } else if (isRelevanceLabelField) {
        renderer = relevanceLabelRenderer;
      } else if (isArrayField) {
        renderer = arrayRenderer;
      }

      columns.push({
        data: key,
        title: getColumnTitle(key),
        width: isChatField ? 40 : 
               isRelevanceScoreField ? 100 :
               isRelevanceLabelField ? 140 :
               isArrayField ? 200 :
               isMessagingChannelField ? MESSAGING_CHANNEL_COLUMN_WIDTH :
               isCvAvailabilityField ? 160 :
               smallFields.includes(key) ? 40 : 150,
        renderer: renderer,
        type: isStatusField || isMessagingChannelField || isCvAvailabilityField ? 'dropdown' : 'text',
        source: isStatusField ? (key === 'candConversationStatus' ? 
          Object.values(CANDIDATE_CONVERSATION_STATUS_LABELS) as string[] : 
          Object.values(STATUS_LABELS) as string[]) :
          isMessagingChannelField ? MESSAGING_CHANNEL_OPTIONS :
          isCvAvailabilityField ? [...CV_AVAILABILITY_OPTIONS] :
          undefined,
        editor: isStatusField || isMessagingChannelField || isCvAvailabilityField ? 'dropdown' : undefined
      });
    });

  return columns;
};