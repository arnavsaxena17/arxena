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

export const TableColumns = ({ processedData }: { processedData: any[] }) => {
  if (!processedData.length) return [];
    
  // Collect all unique keys from all entries
  const allKeys = new Set<string>();
  processedData.forEach(item => {
    Object.keys(item).forEach(key => allKeys.add(key));
  });

  // Define excluded fields that shouldn't be displayed as columns
  const excludedFields = ['id'];

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

  // Generate column definitions
  const columns: Handsontable.ColumnSettings[] = [];

  // Add checkbox column first
  columns.push({
    data: 'checkbox',
    type: 'checkbox',
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
    if (allKeys.has(column)) {
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
    .filter(key => !excludedFields.includes(key) && key !== 'checkbox')
    .sort()
    .forEach(key => {
      columns.push({
        data: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
        width: 150,
        renderer: simpleRenderer,
      });
    });

  return columns;
};