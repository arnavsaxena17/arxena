import { useMemo } from 'react';
import { LinkType, RoundedLink, SocialLink } from 'twenty-ui';

import { FieldLinksValue } from '@/object-record/record-field/types/FieldMetadata';
import { ExpandableList } from '@/ui/layout/expandable-list/components/ExpandableList';
import { isDefined } from 'twenty-shared';
import { checkUrlType } from '~/utils/checkUrlType';
import { isLinkedInUrl, reconstructLinkedInUrlForDisplay } from '~/utils/linkedinUrlUtils';
import { getAbsoluteUrl } from '~/utils/url/getAbsoluteUrl';
import { getUrlHostname } from '~/utils/url/getUrlHostname';

type LinksDisplayProps = {
  value?: FieldLinksValue;
};

export const LinksDisplay = ({ value }: LinksDisplayProps) => {
  const links = useMemo(
    () =>
      [
        value?.primaryLinkUrl
          ? {
              url: value.primaryLinkUrl,
              label: value.primaryLinkLabel,
            }
          : null,
        ...(value?.secondaryLinks ?? []),
      ]
        .filter(isDefined)
        .map(({ url, label }) => {
          // Reconstruct LinkedIn URLs for display if needed
          const displayUrl = isLinkedInUrl(url) ? reconstructLinkedInUrlForDisplay(url) : url;
          const absoluteUrl = getAbsoluteUrl(displayUrl);
          return {
            url: absoluteUrl,
            label: label || getUrlHostname(absoluteUrl),
            type: checkUrlType(absoluteUrl),
          };
        }),
    [value?.primaryLinkLabel, value?.primaryLinkUrl, value?.secondaryLinks],
  );

  return (
    <ExpandableList>
      {links.map(({ url, label, type }, index) =>
        type === LinkType.LinkedIn || type === LinkType.Twitter ? (
          <SocialLink key={index} href={url} type={type} label={label} />
        ) : (
          <RoundedLink key={index} href={url} label={label} />
        ),
      )}
    </ExpandableList>
  );
};
