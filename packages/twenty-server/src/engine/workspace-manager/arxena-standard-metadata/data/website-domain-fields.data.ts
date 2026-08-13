import { type ArxenaFieldWithObject } from 'src/engine/workspace-manager/arxena-standard-metadata/data/arxena-metadata-types';

const selectOption = (
  value: string,
  label: string,
  color: string,
  position: number,
) => ({
  value,
  label,
  color,
  position,
});

export const WEBSITE_DOMAIN_STATUS_OPTIONS = [
  selectOption('PENDING', 'Pending', 'gray', 0),
  selectOption('ACTIVE', 'Active', 'green', 1),
  selectOption('INACTIVE', 'Inactive', 'orange', 2),
  selectOption('FAILED', 'Failed', 'red', 3),
];

export const WEBSITE_DOMAIN_TRACKING_LEVEL_OPTIONS = [
  selectOption('COMPANY', 'Company only', 'blue', 0),
];

export const getWebsiteDomainFieldsData = (
  objectsNameIdMap: Record<string, string>,
): ArxenaFieldWithObject[] => [
  {
    objectName: 'websiteDomain',
    field: {
      description: 'Normalized hostname (e.g. arxena.com)',
      icon: 'IconWorld',
      label: 'Domain',
      name: 'domain',
      objectMetadataId: objectsNameIdMap.websiteDomain,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteDomain',
    field: {
      description: 'Connection / tracking status for this domain',
      icon: 'IconStatusChange',
      label: 'Status',
      name: 'status',
      objectMetadataId: objectsNameIdMap.websiteDomain,
      type: 'SELECT',
      options: WEBSITE_DOMAIN_STATUS_OPTIONS,
    },
  },
  {
    objectName: 'websiteDomain',
    field: {
      description: 'Tracking level (company-only for v1)',
      icon: 'IconUsers',
      label: 'Tracking Level',
      name: 'trackingLevel',
      objectMetadataId: objectsNameIdMap.websiteDomain,
      type: 'SELECT',
      options: WEBSITE_DOMAIN_TRACKING_LEVEL_OPTIONS,
    },
  },
  {
    objectName: 'websiteDomain',
    field: {
      description: 'Last beacon received from this domain',
      icon: 'IconClock',
      label: 'Last Seen At',
      name: 'lastSeenAt',
      objectMetadataId: objectsNameIdMap.websiteDomain,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'websiteDomain',
    field: {
      description: 'Last connection or tracking error message',
      icon: 'IconAlertCircle',
      label: 'Last Error',
      name: 'lastError',
      objectMetadataId: objectsNameIdMap.websiteDomain,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteDomain',
    field: {
      description: 'Last successful connection test timestamp',
      icon: 'IconCheck',
      label: 'Verified At',
      name: 'verifiedAt',
      objectMetadataId: objectsNameIdMap.websiteDomain,
      type: 'DATE_TIME',
    },
  },
];
