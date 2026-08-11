import { type ArxenaFieldWithObject } from 'src/engine/workspace-manager/arxena-standard-metadata/data/arxena-metadata-types';

export const getGtmWorkspaceProfileFieldsData = (
  objectsNameIdMap: Record<string, string>,
): ArxenaFieldWithObject[] => [
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description: 'Seller company name for GTM Command',
      icon: 'IconBuilding',
      label: 'Company Name',
      name: 'companyName',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description: 'Seller company domain (usually signup work email domain)',
      icon: 'IconWorld',
      label: 'Company Domain',
      name: 'companyDomain',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description: 'Seller company industry',
      icon: 'IconBuildingFactory',
      label: 'Industry',
      name: 'industry',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description: 'Short seller company summary / blurb',
      icon: 'IconNotes',
      label: 'Summary',
      name: 'summary',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description: 'Seller company employee range',
      icon: 'IconUsers',
      label: 'Employee Range',
      name: 'employeeRange',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description: 'Seller company HQ / primary geo',
      icon: 'IconMapPin',
      label: 'HQ',
      name: 'hq',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description:
        'Company details JSON (LinkedIn / Sales Nav profile, companies index wiki hit, Apollo, and bootstrap metadata)',
      icon: 'IconJson',
      label: 'Company Details JSON',
      name: 'enrichmentJson',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'RAW_JSON',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description: 'Default ICP segment label shared across GTM runs',
      icon: 'IconTags',
      label: 'ICP Segment',
      name: 'icpSegment',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description:
        'Default ICP JSON (std_function / std_grade targets) shared across GTM runs',
      icon: 'IconJson',
      label: 'ICP Spec',
      name: 'icpSpec',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description:
        'Natural-language definition of the default ICP (who we sell to / why)',
      icon: 'IconNotes',
      label: 'ICP Blurb',
      name: 'icpBlurb',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description:
        'Natural-language brief used to find target companies for this ICP',
      icon: 'IconSearch',
      label: 'Company Search Blurb',
      name: 'companySearchBlurb',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  {
    objectName: 'gtmWorkspaceProfile',
    field: {
      description:
        'Natural-language brief used to find buyers/personas at target companies',
      icon: 'IconUserSearch',
      label: 'People Search Blurb',
      name: 'peopleSearchBlurb',
      objectMetadataId: objectsNameIdMap.gtmWorkspaceProfile,
      type: 'TEXT',
    },
  },
  // Project — optional run overrides for ICP blurb + search blurbs
  {
    objectName: 'project',
    field: {
      description:
        'Optional run override for ICP blurb (inherit workspace profile when empty)',
      icon: 'IconNotes',
      label: 'ICP Blurb',
      name: 'icpBlurb',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description:
        'Optional run override for company search blurb (inherit workspace profile when empty)',
      icon: 'IconSearch',
      label: 'Company Search Blurb',
      name: 'companySearchBlurb',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
  {
    objectName: 'project',
    field: {
      description:
        'Optional run override for people search blurb (inherit workspace profile when empty)',
      icon: 'IconUserSearch',
      label: 'People Search Blurb',
      name: 'peopleSearchBlurb',
      objectMetadataId: objectsNameIdMap.project,
      type: 'TEXT',
    },
  },
];
