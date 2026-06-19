export type SuperImposeLinkedInFacetSelection = {
  id: string;
  title: string;
  pictureUrl?: string;
};

export type SuperImposeTargetCompany = SuperImposeLinkedInFacetSelection & {
  slug: string;
  linkedinCompanyUrl: string;
  profileUrl?: string;
  industry?: string;
  locationLabel?: string;
  headcount?: string;
};

export type SuperImposeTargetLocation = SuperImposeLinkedInFacetSelection;

export type SuperImposeAutocompleteItem = {
  id: string;
  title: string;
  pictureUrl?: string;
  profileUrl?: string;
  slug?: string;
  industry?: string;
  locationLabel?: string;
  headcount?: string;
};

export const buildSuperImposeTargetCompanyFromAutocomplete = (
  item: SuperImposeAutocompleteItem,
  resolveSlug: (raw: string) => string,
): SuperImposeTargetCompany => {
  const slug = resolveSlug(item.slug?.trim() || item.id);
  const linkedinCompanyUrl =
    item.profileUrl?.trim() ||
    `https://www.linkedin.com/company/${slug}/`;

  return {
    id: item.id,
    title: item.title,
    pictureUrl: item.pictureUrl,
    slug,
    linkedinCompanyUrl,
    profileUrl: item.profileUrl,
    industry: item.industry,
    locationLabel: item.locationLabel,
    headcount: item.headcount,
  };
};

export const buildSuperImposeTargetLocationFromAutocomplete = (
  item: SuperImposeAutocompleteItem,
): SuperImposeTargetLocation => ({
  id: item.id,
  title: item.title,
  pictureUrl: item.pictureUrl,
});

export const isDifferentSuperImposeTargetCompany = (input: {
  backgroundCompanyId: string;
  backgroundCompanyName?: string;
  targetCompany: SuperImposeTargetCompany | null;
  resolveSlug: (raw: string) => string;
}): boolean => {
  if (!input.targetCompany) {
    return false;
  }

  const backgroundSlug = input.resolveSlug(input.backgroundCompanyId);
  const selectedSlug = input.resolveSlug(input.targetCompany.slug);
  const backgroundName = (input.backgroundCompanyName ?? '').trim().toLowerCase();
  const selectedName = input.targetCompany.title.trim().toLowerCase();

  return selectedSlug !== backgroundSlug || selectedName !== backgroundName;
};
