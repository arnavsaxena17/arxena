import { createState } from 'twenty-ui';
import { CustomDomainValidRecords } from '~/generated/graphql';

export const customDomainRecordsState =
  createState<CustomDomainValidRecords | null>({
    key: 'customDomainRecordsState',
    defaultValue: null,
  });
