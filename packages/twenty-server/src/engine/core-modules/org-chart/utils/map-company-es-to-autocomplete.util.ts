import { CompanyEsDocument } from '../services/companies-es.service';
import { CompanyAutocompleteItem } from '../services/pdl-autocomplete.service';

const locationNameFromCompanyEsDocument = (
  item: CompanyEsDocument,
): string | undefined => {
  const parts = [item.locality, item.region, item.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(', ');
};

export const mapCompanyEsDocumentsToAutocompleteItems = (
  items: CompanyEsDocument[],
): CompanyAutocompleteItem[] =>
  items
    .filter((item) => Boolean(item.name?.trim() || item.id?.trim()))
    .map((item) => {
      const name = item.name?.trim() || item.id?.trim() || '';
      const id = item.id?.trim() || name;
      return {
        name,
        meta: {
          id,
          website: item.website,
          industry: item.industry,
          location_name: locationNameFromCompanyEsDocument(item),
          linkedin_url: item.linkedin_url,
        },
        count: item.count_org ?? 0,
      };
    });
