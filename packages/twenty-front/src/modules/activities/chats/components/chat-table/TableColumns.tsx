import dayjs from 'dayjs';
import Handsontable from 'handsontable';
import { PersonNode } from 'twenty-shared';
import { ColumnRenderer } from './types';

export const createTableColumns = (
  individuals: PersonNode[],
  handleCheckboxChange: (individualId: string) => void
): Handsontable.ColumnSettings[] => {
  const checkboxRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = value;
    checkbox.addEventListener('change', () => {
      const individual = individuals[row];
      handleCheckboxChange(individual.id);
    });
    td.appendChild(checkbox);
    return td;
  };

  const nameRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const individual = individuals[row];
    const name = `${individual.name.firstName} ${individual.name.lastName}`;
    td.textContent = name;
    return td;
  };

  const statusRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const individual = individuals[row];
    const status = individual.candidates?.edges[0]?.node?.candConversationStatus || 'N/A';
    td.textContent = status;
    return td;
  };

  const dateRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const individual = individuals[row];
    const date = individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt 
      ? dayjs(individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt).format('MMM D, HH:mm')
      : 'N/A';
    td.textContent = date;
    return td;
  };

  const simpleRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const individual = individuals[row];
    const fieldValue = individual[prop as keyof PersonNode];
    td.textContent = fieldValue ? String(fieldValue) : 'N/A';
    return td;
  };

  return [
    {
      data: 'checkbox',
      type: 'checkbox',
      title: 'Checkbox',
      width: 40,
      renderer: checkboxRenderer,
    },
    {
      data: 'name',
      title: 'Name',
      type: 'text',
      width: 150,
      renderer: nameRenderer,
    },
    {
      data: 'candidateStatus',
      title: 'Candidate Status',
      type: 'text',
      width: 150,
      renderer: statusRenderer,
    },
    {
      data: 'startDate',
      title: 'Start Date',
      type: 'date',
      width: 150,
      renderer: dateRenderer,
    },
    {
      data: 'status',
      title: 'Status',
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    },
    {
      data: 'salary',
      title: 'Salary',
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    },
    {
      data: 'city',
      title: 'City',
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    },
    {
      data: 'jobTitle',
      title: 'Job Title',
      type: 'text',
      width: 150,
      renderer: simpleRenderer,
    },
  ];
}; 