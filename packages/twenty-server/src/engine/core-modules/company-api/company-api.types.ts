import type { CompanyDataSourceAlias } from '../constants/company-data-source-aliases';
import type { UnipileLinkedinProduct } from 'src/engine/core-modules/linkedin-search/utils/unipile-linkedin-product.util';

export type CompanySearchHit = {
  id: string;
  name: string;
  website: string;
  linkedinUrl: string;
  industry: string;
};

export type CompanySearchResponse = {
  status: 'ok';
  dataSource: Exclude<CompanyDataSourceAlias, 'auto'>;
  unipileProduct?: UnipileLinkedinProduct;
  total: number;
  items: CompanySearchHit[];
};

export type CompanyDataSourcesStatusResponse = {
  status: 'ok';
  sources: Array<{
    alias: CompanyDataSourceAlias;
    label: string;
    description: string;
    configured: boolean;
  }>;
};
