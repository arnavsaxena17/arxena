/**
 * Constructs the search parameter key from search type and category
 * @param searchType - The search type (classic, sales_navigator, recruiter)
 * @param searchCategory - The search category (people, companies, posts, jobs)
 * @returns The constructed parameter key (e.g., 'classicPeopleSearch')
 */
export function constructSearchParamKey(
  searchType: string,
  searchCategory: string,
): string {
  const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase(),
  );
  const capitalizedCategory =
    searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
  return `${camelCaseSearchType}${capitalizedCategory}Search`;
}

