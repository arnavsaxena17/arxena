import { MouseEvent } from 'react';
import styled from '@emotion/styled';

import { FieldLinkValue } from '@/object-record/record-field/types/FieldMetadata';
import { RoundedLink } from '@/ui/navigation/link/components/RoundedLink';
import {
  LinkType,
  SocialLink,
} from '@/ui/navigation/link/components/SocialLink';
import { checkUrlType } from '~/utils/checkUrlType';
import { getAbsoluteUrl } from '~/utils/url/getAbsoluteUrl';
import { getUrlHostName } from '~/utils/url/getUrlHostName';

import { EllipsisDisplay } from './EllipsisDisplay';

const StyledRawLink = styled(RoundedLink)`
  a {
    font-size: ${({ theme }) => theme.font.size.md};
    white-space: nowrap;
  }
`;

type LinkDisplayProps = {
  value?: FieldLinkValue;
};

export const LinkDisplay = ({ value }: LinkDisplayProps) => {
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const absoluteUrl = getAbsoluteUrl(value?.url || '');
  const displayedValue = value?.label || getUrlHostName(absoluteUrl);
  const type = checkUrlType(absoluteUrl);

  if (type === LinkType.LinkedIn || type === LinkType.Twitter) {
    return (
      <EllipsisDisplay>
        <SocialLink href={absoluteUrl} onClick={handleClick} type={type}>
          {displayedValue}
        </SocialLink>
      </EllipsisDisplay>
    );
  }
  return (
    <EllipsisDisplay>
      <StyledRawLink href={absoluteUrl} onClick={handleClick}>
        {displayedValue}
      </StyledRawLink>
    </EllipsisDisplay>
  );
};
