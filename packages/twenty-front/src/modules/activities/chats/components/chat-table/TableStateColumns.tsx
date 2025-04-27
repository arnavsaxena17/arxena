import { ColumnRenderer } from "@/activities/chats/components/chat-table/types";
import { truncatedCellStyle } from "@/activities/chats/components/SingleJobView";
import dayjs from "dayjs";
import Handsontable from "handsontable";


export const TableStateColumns = ({ tableState }: { tableState : any}) => {
  // Make sure rendered cells don't interfere with scrolling
  const appliedCellStyle = {
    ...truncatedCellStyle,
    maxHeight: '100%'
  };
  
  const checkboxRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    const candidate = tableState.candidates[row];
    if (!candidate) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'row-checkbox';
      td.style.textAlign = 'center';
      td.appendChild(checkbox);
      return td;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = tableState.selectedIds.includes(candidate.id);
    checkbox.className = 'row-checkbox';
    td.style.textAlign = 'center';
    td.appendChild(checkbox);
    return td;
  };
  
  const nameRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = tableState.candidates[row];
    const nameValue = value || (candidate ? `${candidate.name}` : 'N/A');
    const div = document.createElement('div');
    Object.assign(div.style, appliedCellStyle);
    div.textContent = nameValue;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const statusRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = tableState.candidates[row];
    const status = candidate?.candidateFieldValues?.edges[0]?.node?.name || 'N/A';
    const div = document.createElement('div');
    Object.assign(div.style, appliedCellStyle);
    div.textContent = status;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const dateRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = tableState.candidates[row];
    const date = candidate?.whatsappMessages?.edges[0]?.node?.createdAt 
      ? dayjs(candidate.whatsappMessages.edges[0].node.createdAt).format('MMM D, HH:mm')
      : 'N/A';
    const div = document.createElement('div');
    Object.assign(div.style, appliedCellStyle);
    div.textContent = date;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const urlRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    td.innerHTML = '';
    if (!value || value === 'N/A') {
      const div = document.createElement('div');
      Object.assign(div.style, appliedCellStyle);
      div.textContent = 'N/A';
      td.appendChild(div);
      return td;
    }
    
    let url = value;
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = value;
    
    Object.assign(link.style, appliedCellStyle);
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



  const simpleRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const div = document.createElement('div');
    Object.assign(div.style, appliedCellStyle);
    div.textContent = value !== undefined && value !== null ? String(value) : 'N/A';
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const phoneRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = tableState.data[row];
    
    const phoneNumber = value || candidate?.people?.phones?.primaryPhoneNumber || 'N/A';
    
    const div = document.createElement('div');
    Object.assign(div.style, appliedCellStyle);
    div.textContent = phoneNumber;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };
  
  const emailRenderer: ColumnRenderer = (instance, td, row, column, prop, value) => {
    const candidate = tableState.data[row];
    const email = value || candidate?.people?.emails?.primaryEmail || 'N/A';
    const div = document.createElement('div');
    Object.assign(div.style, appliedCellStyle);
    div.textContent = email;
    td.innerHTML = '';
    td.appendChild(div);
    return td;
  };

  const baseColumns: Handsontable.ColumnSettings[] = [
    {
      data: 'checkbox',
      title: '',
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

  return {
    baseColumns,
    contactColumns,
    profileColumns,
    checkboxRenderer,
    nameRenderer,
    statusRenderer,
    dateRenderer,
    urlRenderer,
    simpleRenderer,
    phoneRenderer,
    emailRenderer,
  };
};
