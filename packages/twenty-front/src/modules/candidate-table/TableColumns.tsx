import styled from '@emotion/styled';
import Handsontable from "handsontable";
import { formatToHumanReadableDateTime } from '~/utils/date-utils';

const StyledSelectedRow = styled.tr`
  &.selected-row td {
    background-color: ${({ theme }) => theme.background.tertiary} !important;
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

const urlFields = [
  'profileUrl', 'linkedinUrl', 'linkedInUrl', 'githubUrl', 'portfolioUrl','profilePhotoUrl','englishAudioIntroUrl',
  'resdexNaukriUrl', 'hiringNaukriUrl', 'website', 'websiteUrl','resumeDownloadUrl'
];

const excludedFields = [
  'id', 'checkbox', 'name','profileUrl', 'hasCv','fullName','jobName','candidateFieldValues','token','hiringNaukriCookie','dataSource', 'personId', 'firstName', 'searchId','phoneNumbers','mobilePhone','filterQueryHash','mayAlsoKnow','languages','englishLevel','baseQueryHash','creationDate','apnaSearchToken','lastName', 'emailAddress', 'industries', 'profiles', 'jobProcess', 'locations','experience', 'experienceStats', 'lastUpdated','education','interests','dataSources','allNumbers','uploadId','allMails','socialprofiles','tables','created','middleName','middleInitial','creationSource','contactDetails','queryId','socialProfiles',
];

export const TableColumns = ({ 
  processedData, 
  selectAllChecked, 
  selectAllIndeterminate, 
  onSelectAllChange,
  unreadMessagesCounts = {}
}: { 
  processedData: any[], 
  selectAllChecked?: boolean, 
  selectAllIndeterminate?: boolean, 
  onSelectAllChange?: (checked: boolean) => void,
  unreadMessagesCounts?: Record<string, number>
}) => {
  if (!processedData.length) return [];
    
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
    };

    
    const candidateId = rowData && typeof rowData === 'object' && 'id' in rowData ? rowData.id : null;
    const unreadCount = candidateId && unreadMessagesCounts[candidateId] ? unreadMessagesCounts[candidateId] : 0;
    const hasCv = rowData?.hasCv;
    
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
    nameDiv.textContent = rowData.name !== undefined && rowData.name !== null ? String(rowData.name) : 'N/A';
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
    if (value) {
      div.textContent = formatToHumanReadableDateTime(value);
    } else {
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
    renderer: nameRenderer,
  });

  const commonColumns = ['jobTitle','jobCompanyName','locationName','remarks','email', 'phone', 'status', 'lastMessage'];
  commonColumns.forEach(column => {
    if (allKeys.has(column) && !excludedFields.includes(column)) {
      columns.push({
        data: column,
        title: column.charAt(0).toUpperCase() + column.slice(1),
        width: 150,
        renderer: simpleRenderer,
      });
      allKeys.delete(column);
    }
  });


  const smallFields = chatColumns.concat(['inferredSalary', 'inferredYearsExperience']);
  Array.from(allKeys)
    .filter(key => !excludedFields.includes(key))
    .sort()
    .forEach(key => {
      const isUrlField = urlFields.includes(key);
      const isDateField = key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt' || key === 'lastMessage';
      const isChatField = chatColumns.includes(key);
      columns.push({
        data: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
        width: isChatField ? 40 : smallFields.includes(key) ? 40 : 150,
        renderer: isChatField ? booleanToggleRenderer : isUrlField ? urlRenderer : isDateField ? dateRenderer : simpleRenderer,
      });
    });

  return columns;
};