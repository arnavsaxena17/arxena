import { useState } from 'react';
import { isNonEmptyString, isUndefined } from '@sniptt/guards';
import clsx from 'clsx';

import { Nullable, stringToHslColor } from '@ui/utilities';


// /Users/arnavsaxena/arxena/twenty/packages/twenty-front/src/utils/index.ts

import styles from './Avatar.module.css';
import React from 'react';

export type AvatarType = 'squared' | 'rounded';

export type AvatarSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

export type AvatarProps = {
  avatarUrl?: string | null;
  className?: string;
  size?: AvatarSize;
  placeholder: string | undefined;
  entityId?: string;
  type?: Nullable<AvatarType>;
  color?: string;
  backgroundColor?: string;
  onClick?: () => void;
};

const propertiesBySize = {
  xl: {
    fontSize: '16px',
    width: '40px',
  },
  lg: {
    fontSize: '13px',
    width: '24px',
  },
  md: {
    fontSize: '12px',
    width: '16px',
  },
  sm: {
    fontSize: '10px',
    width: '14px',
  },
  xs: {
    fontSize: '8px',
    width: '12px',
  },
};



export const Avatar = ({
  avatarUrl,
  size = 'md',
  placeholder,
  entityId = placeholder,
  onClick,
  type = 'squared',
  color,
  backgroundColor,
}: AvatarProps) => {
  const [isInvalidAvatarUrl, setIsInvalidAvatarUrl] = useState(false);

  const noAvatarUrl = !isNonEmptyString(avatarUrl);

  const placeholderChar = placeholder?.[0]?.toLocaleUpperCase();

  const showPlaceholder = noAvatarUrl || isInvalidAvatarUrl;

  const handleImageError = () => {
    setIsInvalidAvatarUrl(true);
  };
  const sanitizeURL = (link: string) => {
    // console.log("Link:", link)
    const updatedLink = link?.replace(/(https?:\/\/)|(www\.)/g, '').replace(/\/$/, '').replace(/(http?:\/\/)|(www\.)/g, '').replace('localhost:3000/files/', '').replace("/api/favicon-proxy?domain=","").replace('app.arxena.com/app/files/', '')
    // console.log("Updated Link:", updatedLink)
    return link ? updatedLink : '';
  };
  
  
  const getFaviconUrl = (domain: string): string => {
    const sanitizedDomain = sanitizeURL(domain);
    // console.log("sanitizedDomain:",sanitizedDomain)
    if (process.env.NODE_ENV === 'development') {
      return `/api/favicon-proxy?domain=${encodeURIComponent(sanitizedDomain)}`;
    }
    // In production, use Google's service directly with a fallback
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sanitizedDomain)}&sz=32`;
  
  };

  
  const imageUrl = React.useMemo(() => {
    if (avatarUrl) {
      return getFaviconUrl(avatarUrl);
    }
    return avatarUrl || 'NONE';
  }, [avatarUrl]);



  const fixedColor = color ?? stringToHslColor(entityId ?? '', 75, 25);
  const fixedBackgroundColor =
    backgroundColor ?? stringToHslColor(entityId ?? '', 75, 85);

  const showBackgroundColor = showPlaceholder;

  return (
    <div className={clsx({ [styles.avatar]: true, [styles.rounded]: type === 'rounded', [styles.avatarOnClick]: !isUndefined(onClick), })}
      onClick={onClick}
      style={{ color: fixedColor, backgroundColor: showBackgroundColor ? fixedBackgroundColor : 'none', width: propertiesBySize[size].width, height: propertiesBySize[size].width, fontSize: propertiesBySize[size].fontSize, }}>
      {showPlaceholder ? placeholderChar : <img  src={imageUrl} className={styles.avatarImage} onError={handleImageError} alt="" />}
    </div>
  );
};
