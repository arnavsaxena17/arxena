import styled from '@emotion/styled';
import { MouseEvent } from 'react';

import { checkUrlType } from '~/utils/checkUrlType';
import { isLinkedInUrl, reconstructLinkedInUrlForDisplay } from '~/utils/linkedinUrlUtils';

import { LinkType, RoundedLink, SocialLink } from 'twenty-ui';
import { EllipsisDisplay } from './EllipsisDisplay';

const StyledRawLink = styled(RoundedLink)`
  overflow: hidden;

  a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

type URLDisplayProps = {
  value: string | null;
};

export const URLDisplay = ({ value }: URLDisplayProps) => {
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  // Reconstruct LinkedIn URLs for display if needed
  const displayUrl = value && isLinkedInUrl(value) ? reconstructLinkedInUrlForDisplay(value) : value;
  
  const absoluteUrl = displayUrl
    ? displayUrl.startsWith('http')
      ? displayUrl
      : 'https://' + displayUrl
    : '';

  const displayedValue = displayUrl ?? '';

  const type = checkUrlType(absoluteUrl);

  if (type === LinkType.LinkedIn || type === LinkType.Twitter) {
    return (
      <EllipsisDisplay>
        <SocialLink
          href={absoluteUrl}
          onClick={handleClick}
          type={type}
          label={displayedValue}
        />
      </EllipsisDisplay>
    );
  }
  return (
    <EllipsisDisplay>
      <StyledRawLink
        href={absoluteUrl}
        onClick={handleClick}
        label={displayedValue}
      />
    </EllipsisDisplay>
  );
};
