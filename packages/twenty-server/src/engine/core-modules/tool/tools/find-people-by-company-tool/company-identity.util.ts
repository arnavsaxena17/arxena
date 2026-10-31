import { isNonEmptyString } from '@sniptt/guards';

import { isDefined } from 'twenty-shared/utils';

import { type ResolvedCompanyFromRawName } from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';
import {
  buildCompanyVariants,
  companyBrandKey,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-name-variants.util';

// One company, resolved once, in the shape every source needs. Before this
// each source derived its own set of name spellings: Bright Data re-worded
// "of <name>" from the raw text, Google quoted the first variant, Harvest
// re-resolved a LinkedIn URL per role and per tier. Resolution now happens
// once per company and the result is handed to all of them.
export type CompanyIdentity = {
  // The name to put in a query. The index's canonical name when it resolved
  // to one, otherwise the name the caller gave.
  canonicalName: string;
  // Every spelling that identifies this company, best first. Used for
  // matching a profile's employer and for the second-brand search.
  aliases: string[];
  domain?: string;
  linkedinUrl?: string;
  // The company index id, when the index knew the company.
  companyId?: string;
  // From the index, or the caller's input when the index had none.
  industry?: string;
  country?: string;
  // True when the company index matched. False means the name is a guess, so
  // a source error and an empty answer stay different things downstream.
  resolved: boolean;
};

export type CompanyIdentityTarget = {
  name: string;
  alternateNames?: string[];
  domain?: string;
  industry?: string;
};

const stripProtocolAndWww = (value: string): string =>
  value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0];

const uniqueNonEmpty = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const value of values) {
    if (!isNonEmptyString(value)) {
      continue;
    }

    const trimmed = value.trim();
    const key = trimmed.toLowerCase();

    if (key === '' || seen.has(key)) {
      continue;
    }

    seen.add(key);
    kept.push(trimmed);
  }

  return kept;
};

// The identity a lookup runs with. `resolved` is the index's answer when it
// had one; otherwise the target's own fields, so a company the index has never
// seen still gets one identity instead of four.
export const buildCompanyIdentity = ({
  target,
  resolved,
}: {
  target: CompanyIdentityTarget;
  resolved?: ResolvedCompanyFromRawName | null;
}): CompanyIdentity => {
  const indexResolved =
    isDefined(resolved) && resolved.resolved === true && resolved.lookupFailed !== true;

  const canonicalName =
    indexResolved && isNonEmptyString(resolved.name)
      ? resolved.name.trim()
      : target.name.trim();

  // The caller's spellings first: they are what the user and the tab use. The
  // index then adds the name it resolved to and its alternates, which is how a
  // legal name the caller never typed still matches a profile.
  const aliases = uniqueNonEmpty([
    target.name,
    canonicalName,
    ...(target.alternateNames ?? []),
    ...(indexResolved ? [resolved.name] : []),
    ...(indexResolved
      ? resolved.alternates.map((alternate) => alternate.name)
      : []),
  ]);

  const domain = uniqueNonEmpty([
    target.domain ? stripProtocolAndWww(target.domain) : undefined,
    indexResolved && isNonEmptyString(resolved.website)
      ? stripProtocolAndWww(resolved.website)
      : undefined,
  ])[0];

  return {
    canonicalName,
    aliases: aliases.length > 0 ? aliases : [canonicalName],
    ...(isNonEmptyString(domain) && { domain }),
    ...(indexResolved &&
      isNonEmptyString(resolved.linkedinUrl) && {
        linkedinUrl: resolved.linkedinUrl.trim(),
      }),
    ...(indexResolved &&
      isNonEmptyString(resolved.id) && { companyId: resolved.id }),
    ...(uniqueNonEmpty([
      target.industry,
      indexResolved ? resolved.industry : undefined,
    ])[0] !== undefined && {
      industry: uniqueNonEmpty([
        target.industry,
        indexResolved ? resolved.industry : undefined,
      ])[0],
    }),
    ...(indexResolved &&
      isNonEmptyString(resolved.country) && { country: resolved.country }),
    resolved: indexResolved,
  };
};

// The spellings a source may search with. The brand key collapses "Ltd." and a
// trailing country word, so a company costs one key however it is written.
export const identityVariants = (identity: CompanyIdentity): string[] =>
  buildCompanyVariants(identity.canonicalName, identity.aliases);

export const identityBrandKey = (identity: CompanyIdentity): string =>
  companyBrandKey(identity.canonicalName);
