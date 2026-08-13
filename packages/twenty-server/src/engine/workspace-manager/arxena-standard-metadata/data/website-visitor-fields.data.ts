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

export const WEBSITE_VISITOR_CONFIDENCE_OPTIONS = [
  selectOption('HIGH', 'High', 'green', 0),
  selectOption('MEDIUM', 'Medium', 'yellow', 1),
  selectOption('LOW', 'Low', 'orange', 2),
  selectOption('NONE', 'None', 'gray', 3),
];

export const getWebsiteVisitorFieldsData = (
  objectsNameIdMap: Record<string, string>,
): ArxenaFieldWithObject[] => [
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Resolved company name from IP',
      icon: 'IconBuilding',
      label: 'Company Name',
      name: 'companyName',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Resolved company domain from IP',
      icon: 'IconWorld',
      label: 'Company Domain',
      name: 'companyDomain',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Last seen visitor IP (consent-gated at beacon)',
      icon: 'IconNetwork',
      label: 'IP',
      name: 'ip',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Visitor country from geo resolution',
      icon: 'IconMapPin',
      label: 'Country',
      name: 'country',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Visitor city from geo resolution',
      icon: 'IconMapPin',
      label: 'City',
      name: 'city',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'ASN number from IP resolution',
      icon: 'IconNumber',
      label: 'ASN',
      name: 'asn',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'ASN owner / network holder',
      icon: 'IconBuilding',
      label: 'ASN Owner',
      name: 'asnOwner',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'IP→company resolution confidence',
      icon: 'IconChartBar',
      label: 'Confidence',
      name: 'confidence',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'SELECT',
      options: WEBSITE_VISITOR_CONFIDENCE_OPTIONS,
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Resolution source (ipinfo, ripe, rapidapi, …)',
      icon: 'IconDatabase',
      label: 'Source',
      name: 'source',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Last page path visited',
      icon: 'IconLink',
      label: 'Page Path',
      name: 'pagePath',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Last full page URL visited',
      icon: 'IconLink',
      label: 'Page URL',
      name: 'pageUrl',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'HTTP referrer of last visit',
      icon: 'IconArrowBackUp',
      label: 'Referrer',
      name: 'referrer',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'TEXT',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Number of tracked visits for this identity',
      icon: 'IconNumber',
      label: 'Visit Count',
      name: 'visitCount',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'NUMBER',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'First time this visitor was seen',
      icon: 'IconClock',
      label: 'First Seen At',
      name: 'firstSeenAt',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'DATE_TIME',
    },
  },
  {
    objectName: 'websiteVisitor',
    field: {
      description: 'Most recent visit timestamp',
      icon: 'IconClock',
      label: 'Last Seen At',
      name: 'lastSeenAt',
      objectMetadataId: objectsNameIdMap.websiteVisitor,
      type: 'DATE_TIME',
    },
  },
];
