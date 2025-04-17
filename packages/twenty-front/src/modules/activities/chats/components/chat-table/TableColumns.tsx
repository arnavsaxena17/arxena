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
  'id', 'checkbox', 'name', 'candidateFieldValues', 'jobTitle',
  // Add any other fields you want to exclude
];

export const createTableColumns = (
  candidates: CandidateNode[],
  handleCheckboxChange: (candidateId: string) => void,
  selectedIds: string[],
  handleSelectAll: () => void,
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

  const simpleRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = value !== undefined && value !== null ? String(value) : 'N/A';
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
    // {
    //   data: 'name',
    //   title: 'Name',
    //   type: 'text',
    //   width: 150,
    //   renderer: nameRenderer,
    // },
    // {
    //   data: 'jobTitle',
    //   title: 'Job Title',
    //   type: 'text',
    //   width: 150,
    //   renderer: simpleRenderer,
    // },
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
          // Convert snake_case to camelCase for consistent property naming
          const fieldName = edge?.node?.candidateFields?.name.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
          fieldNamesSet.add(fieldName);
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
        'stopChat', 'stopChatCompleted',
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
    
    return {
      data: fieldName,
      title: formattedTitle,
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    };
  });
  
  // Create dynamic columns for base data fields
  const baseDataColumns = Array.from(baseDataFieldNamesSet).map(fieldName => {
    // Format the title: convert camelCase to Title Case With Spaces
    const formattedTitle = fieldName
      // Insert space before capital letters and uppercase the first letter
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
    
    return {
      data: fieldName,
      title: formattedTitle,
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    };
  });

  console.log("base columns:", baseColumns)
  console.log("base baseDataColumns:", baseDataColumns)
  console.log("base dynamicColumns:", dynamicColumns)

  // Return combined fixed and dynamic columns
  return [...baseColumns, ...dynamicColumns, ...baseDataColumns, ];
};