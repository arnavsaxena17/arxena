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
  'id', 'checkbox', 'name', 'fullName','candidateFieldValues','token','hiringNaukriCookie','dataSource', 'personId','jobTitle', 'firstName', 'searchId','phoneNumbers','mobilePhone','filterQueryHash','mayAlsoKnow','languages','englishLevel','baseQueryHash','creationDate','apnaSearchToken','lastName', 'emailAddress', 'industries', 'profiles', 'jobProcess', 'locations','experience', 'experienceStats', 'lastUpdated','education','interests','skills','dataSources','allNumbers','jobName','uploadId','allMails','socialprofiles','tables','created','middleName','middleInitial','creationSource','contactDetails','queryId','socialProfiles','updatedAt'
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
    
  // Collect all unique keys from all entries
  const allKeys = new Set<string>();
  processedData.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });

  // Create checkbox renderer
  const checkboxRenderer: ColumnRenderer = (instance, td, row, column, prop, value, cellProperties) => {
    td.innerHTML = '';
    const rowData = instance.getSourceDataAtRow(row);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = value || false;
    checkbox.className = 'row-checkbox';
    td.style.textAlign = 'center';
    
    // Get the row element and toggle the selected-row class based on checkbox state
    const rowElement = td.parentElement;
    if (rowElement) {
      if (value) {
        rowElement.classList.add('selected-row');
      } else {
        rowElement.classList.remove('selected-row');
      }
    }
    
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent row selection when clicking checkbox
      // Update the data source directly to trigger afterChange event
      instance.setDataAtRowProp(row, 'checkbox', !value);
      
      // Toggle selected-row class on click
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
    
    // Cast rowData to any to safely access properties
    const rowData: any = instance.getSourceDataAtRow(row);
    const candidateId = rowData && typeof rowData === 'object' && 'id' in rowData ? rowData.id : null;
    const unreadCount = candidateId && unreadMessagesCounts[candidateId] ? unreadMessagesCounts[candidateId] : 0;
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    // container.style.gap = '8px';
    container.style.cursor = 'pointer';
    // container.style.padding = '2px';
    container.style.borderRadius = '4px';
    container.style.backgroundColor = '#f5f5f5';
    container.style.transition = 'background-color 0.2s ease';
    
    // Add hover effect
    container.onmouseover = () => {
      container.style.backgroundColor = '#e0e0e0';
    };
    container.onmouseout = () => {
      container.style.backgroundColor = '#f5f5f5';
    };
    
    const nameDiv = document.createElement('div');
    Object.assign(nameDiv.style, truncatedCellStyle);
    nameDiv.textContent = value !== undefined && value !== null ? String(value) : 'N/A';
    container.appendChild(nameDiv);
    
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

  const commonColumns = ['email', 'phone', 'status', 'source'];
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

  Array.from(allKeys)
    .filter(key => !excludedFields.includes(key))
    .sort()
    .forEach(key => {
      const isUrlField = urlFields.includes(key);
      const isDateField = key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt';
      columns.push({
        data: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
        width: 150,
        renderer: isUrlField ? urlRenderer : isDateField ? dateRenderer : simpleRenderer,
      });
    });

  return columns;
};