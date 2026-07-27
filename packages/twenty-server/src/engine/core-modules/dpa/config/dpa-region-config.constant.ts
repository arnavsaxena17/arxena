import { DpaRegion } from 'src/engine/core-modules/dpa/enums/dpa-region.enum';
import { type DpaRegionConfig } from 'src/engine/core-modules/dpa/types/dpa.types';

export const DEFAULT_DPA_REGION: DpaRegion = DpaRegion.EU;

export const DPA_REGION_CONFIGS: Record<DpaRegion, DpaRegionConfig> = {
  [DpaRegion.EU]: {
    region: DpaRegion.EU,
    sccSectionActive: false,
    values: {
      PROCESSOR_ENTITY: 'Arxena, Inc.',
      PROCESSOR_LEGAL_FORM:
        'a corporation under the laws of Delaware, USA, offering services under the laws of France',
      PROCESSOR_ADDRESS:
        'For notices: contact privacy@arxena.com',
      HOSTING_REGION: 'EU (Frankfurt, Germany)',
      GOVERNING_LAW: 'France',
      DPO_NAME_AND_CONTACT: 'privacy@arxena.com',
    },
  },
  [DpaRegion.US]: {
    region: DpaRegion.US,
    sccSectionActive: true,
    values: {
      PROCESSOR_ENTITY: 'Arxena, Inc.',
      PROCESSOR_LEGAL_FORM:
        'a corporation under the laws of Delaware, USA',
      PROCESSOR_ADDRESS:
        'For notices: contact privacy@arxena.com',
      HOSTING_REGION: 'United States',
      GOVERNING_LAW: 'the State of Delaware, USA',
      DPO_NAME_AND_CONTACT: 'privacy@arxena.com',
    },
  },
};

export const TWENTY_PRESIGNED_SIGNATORY = {
  name: 'Arnav Saxena',
  title: 'Authorized Signatory',
};

export const getDpaRegionConfig = (region: DpaRegion): DpaRegionConfig =>
  DPA_REGION_CONFIGS[region] ?? DPA_REGION_CONFIGS[DEFAULT_DPA_REGION];
