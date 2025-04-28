import Handsontable from "handsontable";

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
  'profileUrl', 'linkedinUrl', 'linkedInUrl', 'githubUrl','personId', 'portfolioUrl','profilePhotoUrl','englishAudioIntroUrl',
  'resdexNaukriUrl', 'hiringNaukriUrl', 'website', 'websiteUrl',
];

const excludedFields = [
  'id', 'checkbox', 'name', 'candidateFieldValues','token', 'jobTitle', 'firstName', 'searchId','phoneNumbers','filterQueryHash','mayAlsoKnow','languages','englishLevel','baseQueryHash','creationDate','apnaSearchToken','lastName', 'uniqueKeyString', 'emailAddress', 'industries', 'profiles', 'jobProcess', 'locations','experience', 'experienceStats', 'lastUpdated','education','interests','skills','dataSources','allNumbers','jobName','uploadId','allMails','socialprofiles','tables','created','middleName','middleInitial','creationSource','contactDetails','queryId','socialProfiles','updatedAt'
];

export const TableColumns = ({ processedData, selectAllChecked, selectAllIndeterminate, onSelectAllChange }: { processedData: any[], selectAllChecked?: boolean, selectAllIndeterminate?: boolean, onSelectAllChange?: (checked: boolean) => void }) => {
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
    
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent row selection when clicking checkbox
      // Update the data source directly to trigger afterChange event
      instance.setDataAtRowProp(row, 'checkbox', !value);
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

  const urlRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    // Clear any previous content
    td.innerHTML = '';
    
    if (!value || value === 'N/A') {
      const div = document.createElement('div');
      Object.assign(div.style, truncatedCellStyle);
      div.textContent = 'N/A';
      td.appendChild(div);
      return td;
    }
    
    // Format URL if needed (make sure it has http/https prefix)
    let url = value;
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Create hyperlink element
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank'; // Open in new tab
    link.rel = 'noopener noreferrer'; // Security best practice
    link.textContent = value; // Display original value as text
    
    // Apply styling
    Object.assign(link.style, truncatedCellStyle);
    link.style.color = '#1976d2'; // Standard link color
    link.style.textDecoration = 'none'; // No underline by default
    
    // Add hover effect
    link.onmouseover = () => {
      link.style.textDecoration = 'underline';
    };
    link.onmouseout = () => {
      link.style.textDecoration = 'none';
    };
    
    // Stop propagation on all events to prevent table from handling them
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      // Let the default browser behavior handle the link
    });
    
    // Also stop mousedown event which triggers Handsontable selection
    link.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
    
    // And prevent selection handler from triggering on mouseup
    link.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
    
    td.appendChild(link);
    return td;
  };


  // Generate column definitions
  const columns: Handsontable.ColumnSettings[] = [];

  // Add checkbox column first
  columns.push({
    data: 'checkbox',
    type: 'checkbox',
    // Handsontable expects title as string; custom header must be set via colHeaders in DataTable.tsx
    title: '',
    width: 40,
    readOnly: false,
    renderer: checkboxRenderer,
    className: 'htCenter htMiddle',
  });

  // Add name column second (usually the most important)
  columns.push({
    data: 'name',
    title: 'Name',
    width: 200,
    renderer: simpleRenderer,
  });

  // Add other commonly used columns
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

  // Add remaining columns
  Array.from(allKeys)
    .filter(key => !excludedFields.includes(key))
    .sort()
    .forEach(key => {
      columns.push({
        data: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
        width: 150,
        renderer: urlFields.includes(key) ? urlRenderer : simpleRenderer,
      });
    });

  return columns;
};