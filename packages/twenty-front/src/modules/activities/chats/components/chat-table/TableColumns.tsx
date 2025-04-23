import dayjs from 'dayjs';
import Handsontable from 'handsontable';
import { CandidateNode } from 'twenty-shared';
import { ColumnRenderer } from './types';

// Add CSS styles at the top level
const truncatedCellStyle = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  display: 'block',
};

// Define fields that should be excluded from automatic column generation
const excludedFields = [
  'id', 'checkbox', 'name', 'candidateFieldValues','token', 'jobTitle', 'firstName','phone', 'searchId','phoneNumbers','filterQueryHash','mayAlsoKnow','languages','englishLevel','baseQueryHash','creationDate','apnaSearchToken','lastName', 'uniqueKeyString', 'emailAddress', 'industries', 'profiles', 'jobProcess', 'locations','experience', 'experienceStats', 'lastUpdated','education','interests','skills','dataSources','allNumbers','jobName','uploadId','allMails','socialprofiles','tables','created','middleName','middleInitial','creationSource','contactDetails','queryId','socialProfiles','updatedAt'
];

const urlFields = [
  'profileUrl', 'linkedinUrl', 'linkedInUrl', 'githubUrl', 'portfolioUrl','profilePhotoUrl','englishAudioIntroUrl',
  'resdexNaukriUrl', 'hiringNaukriUrl', 'website', 'websiteUrl',
];

/**
 * Unselect all selected candidates from the table
 * @param setSelectedIds Function to update the selected IDs state
 */
export const unselect = (setSelectedIds: (ids: string[]) => void) => {
  setSelectedIds([]);
};

/**
 * Configure context menu for the table
 * @param candidates List of candidates
 * @param setSelectedIds Function to update selected IDs
 * @param selectedIds Currently selected IDs
 * @returns Context menu configuration
 */
export const createContextMenu = (
  candidates: CandidateNode[],
  setSelectedIds: (ids: string[]) => void,
  selectedIds: string[],
) => {
  console.log('[CREATE_CONTEXT_MENU] Creating context menu with selectedIds:', selectedIds);
  
  return {
    items: {
      copy: {
        name: 'Copy',
      },
      unselect_all: {
        name: 'Unselect All',
        callback: () => {
          console.log('[CONTEXT_MENU] Unselect All clicked');
          unselect(setSelectedIds);
        },
      },
      unselect_selected_rows: {
        name: 'Unselect Selected Rows',
        callback: function(key: string, selection: any[]) {
          console.log('[UNSELECT] === Unselect Selected Rows called ===');
          console.log('[UNSELECT] Current selection ranges:', JSON.stringify(selection));
          console.log('[UNSELECT] Currently selected IDs:', selectedIds);
          
          if (!selection || selection.length === 0) {
            console.log('[UNSELECT] No selection found');
            return;
          }
          
          // Get all rows in the current selection range
          const rowsToUnselect = new Set<number>();
          
          // Process all selected ranges (in case of multi-selection with Ctrl key)
          for (const range of selection) {
            const startRow = Math.min(range.start.row, range.end.row);
            const endRow = Math.max(range.start.row, range.end.row);
            
            console.log(`[UNSELECT] Processing range: rows ${startRow} to ${endRow}`);
            
            // Add all rows in the range to the set of rows to unselect
            for (let row = startRow; row <= endRow; row++) {
              rowsToUnselect.add(row);
            }
          }
          
          console.log('[UNSELECT] Rows to unselect indices:', Array.from(rowsToUnselect));
          
          // Find candidate IDs to unselect
          const idsToUnselect = new Set<string>();
          
          // Only unselect rows that are currently selected
          rowsToUnselect.forEach(row => {
            if (row >= 0 && row < candidates.length) {
              const candidate = candidates[row];
              if (candidate) {
                console.log(`[UNSELECT] Row ${row} candidate: id=${candidate.id}, name=${candidate.name || 'unnamed'}`);
                
                if (candidate.id && selectedIds.includes(candidate.id)) {
                  console.log(`[UNSELECT] Row ${row} (${candidate.name || 'unnamed'}) IS selected - adding to unselect list`);
                  idsToUnselect.add(candidate.id);
                } else {
                  console.log(`[UNSELECT] Row ${row} (${candidate.name || 'unnamed'}) is NOT selected - skipping`);
                }
              } else {
                console.log(`[UNSELECT] Row ${row} has no candidate data`);
              }
            } else {
              console.log(`[UNSELECT] Row ${row} is out of bounds - candidates length: ${candidates.length}`);
            }
          });
          
          if (idsToUnselect.size > 0) {
            console.log('[UNSELECT] IDs to unselect:', Array.from(idsToUnselect));
            
            // Create a NEW array with only IDs we want to keep
            const idsToKeep = selectedIds.filter(id => !idsToUnselect.has(id));
            console.log('[UNSELECT] IDs to keep selected after unselect:', idsToKeep);
            
            // IMPORTANT: Directly call setSelectedIds instead of returning the array
            console.log('[UNSELECT] Directly calling setSelectedIds with IDs to keep');
            setSelectedIds([...idsToKeep]);
          } else {
            console.log('[UNSELECT] No candidates to unselect in this range');
          }
        },
        disabled: function() {
          return selectedIds.length === 0;
        }
      },
      select_row: {
        name: 'Select This Row',
        callback: function(key: string, selection: any[]) {
          // Get the row index from the selection
          const row = selection[0].start.row;
          if (row >= 0 && row < candidates.length) {
            const candidate = candidates[row];
            if (candidate && candidate.id) {
              // Add this candidate to selection
              // We need to create a new array with both previous IDs and new ID
              const newIds = [...selectedIds, candidate.id];
              setSelectedIds(newIds);
            }
          }
        }
      },
      export_to_csv: {
        name: 'Export to CSV',
        callback: function() {
          // This needs to be implemented based on your application's export functionality
          console.log('Export to CSV triggered');
          // You would typically call an export function here
        }
      },
      separator1: { name: '---------' },
      row_below: {
        name: 'Insert row below',
        disabled: true // Disabled for demonstration
      },
      remove_row: {
        name: 'Remove row',
        disabled: true // Disabled for demonstration
      }
    }
  };
};

export const createTableColumns = (
  candidates: CandidateNode[],
  handleCheckboxChange: (candidateId: string) => void,
  selectedIds: string[],
  handleSelectAll: () => void,
  setSelectedIds?: (ids: string[]) => void, // Added parameter for unselect functionality
): Handsontable.ColumnSettings[] => {
  // Define standard renderers
  const checkboxRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    // Clear any previous content
    td.innerHTML = '';
    
    // Get the individual for this row
    const candidate = candidates[row];
    if (!candidate) return td;
    
    // Create checkbox element
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedIds.includes(candidate.id);
    checkbox.className = 'row-checkbox';
    
    // Add change event listener
    checkbox.addEventListener('change', () => {
      handleCheckboxChange(candidate.id);
    });
    
    // Center the checkbox
    td.style.textAlign = 'center';
    td.appendChild(checkbox);
    
    return td;
  };
  
  const nameRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = candidates[row];
    
    // Use the provided value if it exists (e.g., from edited data)
    // Otherwise, construct from the individual object
    const nameValue = value || (candidate ? `${candidate.name}` : 'N/A');
    
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = nameValue;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const statusRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = candidates[row];
    const status = candidate?.candConversationStatus || 'N/A';
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = status;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const dateRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = candidates[row];
    const date = candidate?.whatsappMessages?.edges[0]?.node?.createdAt 
      ? dayjs(candidate.whatsappMessages.edges[0].node.createdAt).format('MMM D, HH:mm')
      : 'N/A';
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = date;
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

  const simpleRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = value !== undefined && value !== null ? String(value) : 'N/A';
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  // Renderers for contact info from people object
  const phoneRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = candidates[row];
    
    // Use the provided value if it exists (e.g., from edited data)
    // Otherwise, construct from the candidate object
    const phoneNumber = value || candidate?.people?.phones?.primaryPhoneNumber || 'N/A';
    
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = phoneNumber;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };
  
  const emailRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = candidates[row];
    
    // Use the provided value if it exists (e.g., from edited data)
    // Otherwise, construct from the candidate object
    const email = value || candidate?.people?.emails?.primaryEmail || 'N/A';
    
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = email;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  // Base columns that always exist
  const baseColumns: Handsontable.ColumnSettings[] = [
    {
      data: 'checkbox',
      title: '', // Empty title - will be handled by afterGetColHeader hook
      width: 80,
      readOnly: false,
      renderer: checkboxRenderer,
      className: 'htCenter htMiddle',
    },
    {
      data: 'name',
      title: 'Full Name',
      type: 'text',
      width: 150,
      renderer: nameRenderer,
    },
  ];

  // Add contact info columns
  const contactColumns: Handsontable.ColumnSettings[] = [
    {
      data: 'phone',
      title: 'Phone Number',
      type: 'text',
      width: 150,
      renderer: phoneRenderer,
      readOnly: false,
      editor: 'text'
    },
    {
      data: 'email',
      title: 'Email',
      type: 'text',
      width: 200,
      renderer: emailRenderer,
      readOnly: false,
      editor: 'text'
    },
  ];

  // Profile title and company columns
  const profileColumns: Handsontable.ColumnSettings[] = [
    {
      data: 'jobTitle',
      title: 'Profile Title',
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    },
    {
      data: 'company',
      title: 'Job Company',
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    },
  ];

  // Collect all unique field names from candidateFieldValues across all candidates
  const fieldNamesSet = new Set<string>();
  
  // Also collect base data field names
  const baseDataFieldNamesSet = new Set<string>();
  
  candidates.forEach(candidate => {
    // Process candidateFieldValues
    const candidateFieldEdges = candidate.candidateFieldValues?.edges;
    if (candidateFieldEdges) {
      candidateFieldEdges.forEach(edge => {
        if (edge.node?.candidateFields?.name) {
          const fieldName = edge?.node?.candidateFields?.name.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
          if (!excludedFields.includes(fieldName)) {
            fieldNamesSet.add(fieldName);
          }
        }
      });
    }
    
    // Process base data properties
    if (candidate) {
      // Type assertion with proper conversion through unknown first
      const candidateObj = candidate as unknown as Record<string, unknown>;
      
      // Get properties from the candidate to determine base data fields
      Object.keys(candidateObj).forEach(key => {
        if (!excludedFields.includes(key) && typeof candidateObj[key] !== 'object') {
          baseDataFieldNamesSet.add(key);
        }
      });
      
      // Also add chat control fields we know exist in baseData
      const chatControlFields = [
        'startChat', 'startChatCompleted', 
        'stopChat', 'stopChatCompleted', 'phoneNumber',
        'startMeetingSchedulingChat', 'startMeetingSchedulingChatCompleted',
        'stopMeetingSchedulingChat', 'stopMeetingSchedulingChatCompleted',
        'startVideoInterviewChat', 'startVideoInterviewChatCompleted',
        'stopVideoInterviewChat', 'stopVideoInterviewChatCompleted'
      ];
      
      chatControlFields.forEach(field => {
        baseDataFieldNamesSet.add(field);
      });
    }
  });


  // Create dynamic columns for candidateFieldValues fields
  const dynamicColumns = Array.from(fieldNamesSet).map(fieldName => {
    // Format the title: convert camelCase to Title Case With Spaces
    const formattedTitle = fieldName
      // Insert space before capital letters and uppercase the first letter
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
    
    // Check if this field should be rendered as URL
    const isUrl = urlFields.some(urlField => 
      fieldName.toLowerCase().includes(urlField.toLowerCase())
    );
    
    return {
      data: fieldName,
      title: formattedTitle,
      type: 'text',
      width: 150,
      renderer: isUrl ? urlRenderer : simpleRenderer,
    };
  });
  
  // Create dynamic columns for base data fields
  const baseDataColumns = Array.from(baseDataFieldNamesSet).map(fieldName => {
    // Format the title: convert camelCase to Title Case With Spaces
    const formattedTitle = fieldName
      // Insert space before capital letters and uppercase the first letter
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
    
    // Check if this field should be rendered as URL
    const isUrl = urlFields.some(urlField => 
      fieldName.toLowerCase().includes(urlField.toLowerCase())
    );
    
    return {
      data: fieldName,
      title: formattedTitle,
      type: 'text',
      width: 150,
      renderer: isUrl ? urlRenderer : simpleRenderer,
    };
  });

  console.log("base columns:", baseColumns)
  console.log("base baseDataColumns:", baseDataColumns)
  console.log("base dynamicColumns:", dynamicColumns)

  // Return combined fixed and dynamic columns in the requested order
  return [
    ...baseColumns,       // checkbox, full name
    contactColumns[0],    // phone number
    ...profileColumns,    // profile title, job company
    contactColumns[1],    // email
    ...dynamicColumns,
    ...baseDataColumns.filter(col => 
      // Filter out any duplicates that might already be in profileColumns
      col.data !== 'jobTitle' && col.data !== 'company'
    )
  ];
};