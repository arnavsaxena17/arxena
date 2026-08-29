import { type ArxenaFieldWithObject } from 'src/engine/workspace-manager/arxena-standard-metadata/data/arxena-metadata-types';

export const getWorkspaceProfileFieldsData = (
  objectsNameIdMap: Record<string, string>,
): ArxenaFieldWithObject[] => [
  {
    objectName: 'workspaceProfile',
    field: {
      description: 'Your company name for Outreach',
      icon: 'IconBuilding',
      label: 'Company Name',
      name: 'companyName',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'workspaceProfile',
    field: {
      description: 'Your company domain (usually signup work email domain)',
      icon: 'IconWorld',
      label: 'Company Domain',
      name: 'companyDomain',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'workspaceProfile',
    field: {
      description: 'Your company industry',
      icon: 'IconBuildingFactory',
      label: 'Industry',
      name: 'industry',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'workspaceProfile',
    field: {
      description: 'Short company summary / blurb',
      icon: 'IconNotes',
      label: 'Summary',
      name: 'summary',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'workspaceProfile',
    field: {
      description: 'Your company employee range',
      icon: 'IconUsers',
      label: 'Employee Range',
      name: 'employeeRange',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'workspaceProfile',
    field: {
      description: 'Your company HQ / primary geo',
      icon: 'IconMapPin',
      label: 'HQ',
      name: 'hq',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'workspaceProfile',
    field: {
      description:
        'Company details JSON (LinkedIn / Sales Nav profile, companies index wiki hit, Apollo, and bootstrap metadata)',
      icon: 'IconJson',
      label: 'Company Details JSON',
      name: 'enrichmentJson',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'workspaceProfile',
    field: {
      description:
        'Default ICP JSON (buyerTitles and locations) shared across outreach projects',
      icon: 'IconJson',
      label: 'ICP Spec',
      name: 'icpSpec',
      objectMetadataId: objectsNameIdMap.workspaceProfile,
      type: 'TEXT',
    },
  },
];
