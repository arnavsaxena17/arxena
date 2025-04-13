import dayjs from 'dayjs';
import Handsontable from 'handsontable';
import { PersonNode } from 'twenty-shared';
import { ColumnRenderer } from './types';

// Add CSS styles at the top level
const truncatedCellStyle = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  display: 'block',
};

export const createTableColumns = (
  individuals: PersonNode[],
  handleCheckboxChange: (individualId: string) => void,
  selectedIds: string[],
  handleSelectAll: () => void,
): Handsontable.ColumnSettings[] => {
  // Define standard renderers
  const checkboxRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    // Clear any previous content
    td.innerHTML = '';
    
    // Get the individual for this row
    const individual = individuals[row];
    if (!individual) return td;
    
    // Create checkbox element
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedIds.includes(individual.id);
    checkbox.className = 'row-checkbox';
    
    // Add change event listener
    checkbox.addEventListener('change', () => {
      handleCheckboxChange(individual.id);
    });
    
    // Center the checkbox
    td.style.textAlign = 'center';
    td.appendChild(checkbox);
    
    return td;
  };
  
  const nameRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const individual = individuals[row];
    const name = `${individual.name.firstName} ${individual.name.lastName}`;
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = name;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const statusRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const individual = individuals[row];
    const status = individual.candidates?.edges[0]?.node?.candConversationStatus || 'N/A';
    const div = document.createElement('div');
    Object.assign(div.style, truncatedCellStyle);
    div.textContent = status;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const dateRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const individual = individuals[row];
    const date = individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt 
      ? dayjs(individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt).format('MMM D, HH:mm')
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
      width: 50,
      readOnly: false,
      renderer: checkboxRenderer,
      className: 'htCenter htMiddle',
    },
    {
      data: 'name',
      title: 'Name',
      type: 'text',
      width: 150,
      renderer: nameRenderer,
    },
    // {
    //   data: 'candidateStatus',
    //   title: 'Candidate Status',
    //   type: 'text',
    //   width: 150,
    //   renderer: statusRenderer,
    // },
    // {
    //   data: 'startDate',
    //   title: 'Start Date',
    //   type: 'date',
    //   width: 150,
    //   renderer: dateRenderer,
    // },
    // {
    //   data: 'status',
    //   title: 'Status',
    //   type: 'text',
    //   width: 150,
    //   renderer: simpleRenderer,
    // },
    // {
    //   data: 'salary',
    //   title: 'Salary',
    //   type: 'text',
    //   width: 150,
    //   renderer: simpleRenderer,
    // },
    // {
    //   data: 'city',
    //   title: 'City',
    //   type: 'text',
    //   width: 150,
    //   renderer: simpleRenderer,
    // },
    {
      data: 'jobTitle',
      title: 'Job Title',
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    },
  ];

  // Collect all unique field names from candidateFieldValues across all individuals
  const fieldNamesSet = new Set<string>();
  individuals.forEach(individual => {
    const candidateFieldEdges = individual.candidates?.edges[0]?.node?.candidateFieldValues?.edges;
    if (candidateFieldEdges) {
      candidateFieldEdges.forEach(edge => {
        if (edge.node?.candidateFields?.name) {
          // Convert snake_case to camelCase for consistent property naming
          const fieldName = edge?.node?.candidateFields?.name.replace(/_([a-z])/g, (match: string, letter: string) => letter.toUpperCase());
          fieldNamesSet.add(fieldName);
        }
      });
    }
  });

  // Create dynamic columns for all field names
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

  // Return combined fixed and dynamic columns
  return [...baseColumns, ...dynamicColumns];
};