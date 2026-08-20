import type {
  LinkedInSalesNavigatorAccountListSortBy,
  LinkedInSalesNavigatorSortOrder,
} from '../types/linkedin-search-parameter.type';

const SORT_BY_ALIASES: Record<string, LinkedInSalesNavigatorAccountListSortBy> =
  {
    date_added: 'DATE_ADDED',
    dateadded: 'DATE_ADDED',
    date: 'DATE_ADDED',
    datetime: 'DATE_ADDED',
    timestamp: 'DATE_ADDED',
    name: 'NAME',
  };

const SORT_ORDER_ALIASES: Record<string, LinkedInSalesNavigatorSortOrder> = {
  ascending: 'ASCENDING',
  asc: 'ASCENDING',
  descending: 'DESCENDING',
  desc: 'DESCENDING',
};

export const toUnipileV2AccountListId = (listId: string): string => {
  const trimmed = listId.trim();
  if (/^ACCOUNT_/i.test(trimmed)) {
    return trimmed.replace(/^account_/i, 'ACCOUNT_');
  }

  return `ACCOUNT_${trimmed}`;
};

export const normalizeSalesNavigatorAccountListSortBy = (
  value: unknown,
): LinkedInSalesNavigatorAccountListSortBy | undefined => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  return SORT_BY_ALIASES[value.trim().toLowerCase()];
};

export const normalizeSalesNavigatorAccountListSortOrder = (
  value: unknown,
): LinkedInSalesNavigatorSortOrder | undefined => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  return SORT_ORDER_ALIASES[value.trim().toLowerCase()];
};

export const isUnipileAccountListV2Enabled = (
  requestFlag?: boolean,
): boolean => {
  if (typeof requestFlag === 'boolean') {
    return requestFlag;
  }

  return process.env.UNIPILE_ACCOUNT_LIST_V2 === 'true';
};
